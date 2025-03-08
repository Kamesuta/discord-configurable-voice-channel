import { VoiceBasedChannel, VoiceState } from 'discord.js';

import { config, getChannelEntry } from './utils/config.js';
import { logger } from './utils/log.js';
import {
  getApprovalRelatedVoiceChannel,
  approvalRequestEmbed,
  approvalRequestButtonRow,
  approvalRequestTips,
  allowUserApprovalChannelPermisson,
} from './voiceApproval.js';
import {
  createChannelEmbed,
  editChannelPermission,
  freeChannelEmbed,
  getChannelOwner,
  noChannelOwnerEmbed,
  onlyBotKickEmbed,
} from './voiceController.js';
import { onVoiceStatusChange, setVoiceStatus } from './voiceStatusHandler.js';

/**
 * ボイスチャンネル作成機能
 * VC作成チャンネルにアクセス -> VC作成(権限管理) -> VC移動
 * [仕様: VCに30秒間誰もいない場合は自動削除]
 * @param oldState 移動前のステータス
 * @param newState 移動後のステータス
 */
export async function onVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState,
): Promise<void> {
  const member = newState.member ?? oldState.member;
  if (!member) return; // メンバーが取得できない場合は処理を終了

  // チャンネルを取得
  const oldChannel = oldState.channel;
  const newChannel = newState.channel;

  // -----------------------------------------------------------------------------------------------------------
  // VC作成チャンネルに入った場合の処理
  // -----------------------------------------------------------------------------------------------------------
  if (
    oldChannel?.id !== newChannel?.id &&
    newChannel?.id &&
    getChannelEntry(newChannel.id)
  ) {
    try {
      if (newChannel.members.size === 1) {
        // -----------------------------------------------------------------------------------------------------------
        // 初めてVCに入った場合、入った人をオーナーにしてチャンネルを初期化する処理
        // -----------------------------------------------------------------------------------------------------------
        // チャンネルの詳細を設定
        await editChannelPermission(newChannel, {
          ownerUser: member.user,
        });
        await onVoiceStatusChange(newChannel);

        // メッセージを投稿
        await newChannel.send({
          content: `<@${member.id}> VCへようこそ！`,
          embeds: [createChannelEmbed],
        });
      }
    } catch (error) {
      logger.error(error);
    }
  }

  // -----------------------------------------------------------------------------------------------------------
  // VCに誰もいない場合、チャンネルを削除する処理
  // -----------------------------------------------------------------------------------------------------------
  if (
    oldChannel?.id !== newChannel?.id &&
    oldChannel?.id &&
    getChannelEntry(oldChannel.id)
  ) {
    try {
      // VCの全メンバー (コンフィグに入ったBotを除く)
      const membersAll = oldChannel.members;
      const members = membersAll.filter(
        (member) => !config.readBotList.some((bot) => bot.botId === member.id),
      );

      if (members.size === 0) {
        // 人がいない場合
        // チャンネルの詳細をリセット
        await editChannelPermission(oldChannel, {
          ownerUser: null, // オーナーを削除
        });
        await onVoiceStatusChange(oldChannel, null);

        // VCの人(Bot以外)がいなくなった場合 → 解散
        if (oldChannel.members.size === 0) {
          // 人もBotも全員いなくなった場合
          if (!(await deleteNotificationIfNoMessage(oldChannel))) {
            // メッセージを投稿
            await oldChannel.send({
              embeds: [freeChannelEmbed],
            });
          }

          // ステータスが残ってしまう不具合があるため、ここでステータスを削除しておく
          await setVoiceStatus(oldChannel, null);
        } else {
          // 最後のBotをキックする際にメッセージを投稿
          if (oldChannel.members.size === 1) {
            await oldChannel.send({
              embeds: [onlyBotKickEmbed],
            });
          }
          // 人がいなくなったがBotがいる場合
          const botMember = oldChannel.members.first();
          if (botMember) {
            await botMember.voice.disconnect();
          }
        }
      } else if (getChannelOwner(oldChannel) === member) {
        // オーナーがいない場合はチャンネルを解放する
        await editChannelPermission(oldChannel, {
          ownerUser: null, // オーナーを削除
        });
        await onVoiceStatusChange(oldChannel, undefined, 'オーナーなし');

        // オーナーがいない場合はメッセージを投稿
        await oldChannel.send({
          embeds: [noChannelOwnerEmbed(member.user)],
        });
      }
    } catch (error) {
      logger.error(error);
    }
  }

  // -----------------------------------------------------------------------------------------------------------
  // 待機VCに入った場合の処理
  // -----------------------------------------------------------------------------------------------------------
  if (oldChannel?.id !== newChannel?.id && newChannel?.id) {
    try {
      // 本VCの情報を取得
      const channel = await getApprovalRelatedVoiceChannel(newChannel);
      if (channel) {
        // 既に本VCの権限がある場合
        const overwrite = [...channel.permissionOverwrites.cache.values()].find(
          (permission) =>
            permission.id === member.id &&
            permission.allow.has(allowUserApprovalChannelPermisson),
        );

        if (overwrite) {
          // 既に権限がある場合は移動
          await member.voice.setChannel(channel);
        } else {
          // メッセージを投稿
          const owner = getChannelOwner(channel);
          await channel.send({
            content: `<@${owner?.id}> 参加リクエストが来ました！`,
            embeds: [approvalRequestEmbed(member.user, false)],
            components: [approvalRequestButtonRow],
          });

          // お待ち下さいメッセージを投稿
          await newChannel.send({
            content: `<@${member.id}> 許可制VCへようこそ！\n<@${owner?.id}> が参加リクエストを承認するとVCに入れます。\n承認までしばらくお待ちください～！`,
            allowedMentions: { users: [member.id] },
          });
        }
      }
    } catch (error) {
      logger.error(error);
    }
  }

  // -----------------------------------------------------------------------------------------------------------
  // 待機VCから出た場合の処理
  // -----------------------------------------------------------------------------------------------------------
  if (oldChannel?.id !== newChannel?.id && oldChannel?.id) {
    try {
      // 本VCの情報を取得
      const channel = await getApprovalRelatedVoiceChannel(oldChannel);
      if (channel) {
        // 直近10件のメッセージを取得
        const messages = await channel.messages.fetch({ limit: 10 });

        // 直近10件のメッセージからこのBotのメッセージで、抜けた人にメンションを送っているメッセージを見つける
        const requestMessage = messages.find(
          (message) =>
            message.author.id === channel.client.user?.id &&
            message.embeds[0].footer?.text === approvalRequestTips,
        );

        if (channel.id === newChannel?.id) {
          // 待機VCから関連付けられたVCに移動した場合はメッセージを✅️に変更
          await requestMessage?.edit({
            embeds: [approvalRequestEmbed(member.user, true)],
          });
        } else {
          // 抜けた人は興味がないため、メッセージを削除
          await requestMessage?.delete();
        }
      }
    } catch (error) {
      logger.error(error);
    }
  }
}

/**
 * ボイスチャンネル作成から終了までの間に一度もチャットがない場合、メッセージを削除する
 * @param channel チャンネル
 * @returns メッセージが送信されていない場合(=削除した場合)はtrueを返す
 */
async function deleteNotificationIfNoMessage(
  channel: VoiceBasedChannel,
): Promise<boolean> {
  // 直近10件のメッセージを取得
  const messages = await channel.messages.fetch({ limit: 10 });

  // 直近10件のメッセージからこのBotの「ようこそ」メッセージを見つける
  const startMessage = messages.find(
    (message) =>
      message.author.id === channel.client.user?.id &&
      message.embeds[0].title === createChannelEmbed.data.title,
  );
  if (!startMessage) return false;

  // 「ようこそ」以降のメッセージを取得
  const messagesAfterStartMessage = messages.filter(
    (message) => message.id > startMessage.id,
  );

  // Bot以外のメッセージが含まれている場合、無視
  if (messagesAfterStartMessage.some((message) => !message.author.bot))
    return false;

  // このBotのメッセージを取得
  const announceMessages = messagesAfterStartMessage.filter(
    (message) => message.author.id === channel.client.user?.id,
  );
  // メッセージを削除
  await startMessage.delete();
  for (const message of announceMessages.values()) {
    await message.delete();
  }

  return true;
}
