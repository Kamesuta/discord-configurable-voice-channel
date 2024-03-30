import { VoiceBasedChannel, VoiceState } from 'discord.js';

import { config } from './utils/config.js';
import { logger } from './utils/log.js';
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
    config.customVcList.find(
      (channelEntry) => channelEntry.channelId === newChannel?.id,
    )
  ) {
    if (!newChannel) return; // ボイスチャンネルが取得できない場合は処理を終了

    try {
      if (newChannel.members.size === 1) {
        // -----------------------------------------------------------------------------------------------------------
        // 初めてVCに入った場合、入った人をオーナーにしてチャンネルを初期化する処理
        // -----------------------------------------------------------------------------------------------------------
        // チャンネルの詳細を設定
        await editChannelPermission(newChannel, member.user);
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
    config.customVcList.find(
      (channelEntry) => channelEntry.channelId === oldChannel?.id,
    )
  ) {
    if (!oldChannel) return; // ボイスチャンネルが取得できない場合は処理を終了

    try {
      // VCの全メンバー (コンフィグに入ったBotを除く)
      const membersAll = oldChannel.members;
      const members = membersAll.filter(
        (member) => !config.readBotList.some((bot) => bot.botId === member.id),
      );

      if (members.size === 0) {
        // 人がいない場合
        // チャンネルの詳細をリセット
        await editChannelPermission(oldChannel, undefined);
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
        await editChannelPermission(oldChannel, undefined);
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
