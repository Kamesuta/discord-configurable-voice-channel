import { VoiceState } from 'discord.js';

import { config } from './utils/config.js';
import { logger } from './utils/log.js';
import {
  createChannelEmbed,
  editChannelPermission,
  freeChannelEmbed,
  getChannelOwner,
  noChannelOwnerEmbed,
  updateControlPanel,
  onlyBotKickEmbed,
} from './voiceController.js';

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

  // -----------------------------------------------------------------------------------------------------------
  // VC作成チャンネルに入った場合の処理
  // -----------------------------------------------------------------------------------------------------------
  if (
    oldState.channelId !== newState.channelId &&
    newState.channelId &&
    config.customVcList.find(
      (channelEntry) => channelEntry.channelId === newState.channelId,
    )
  ) {
    if (!newState.channel) return; // ボイスチャンネルが取得できない場合は処理を終了

    try {
      if (newState.channel.members.size === 1) {
        // -----------------------------------------------------------------------------------------------------------
        // 初めてVCに入った場合、入った人をオーナーにしてチャンネルを初期化する処理
        // -----------------------------------------------------------------------------------------------------------
        // チャンネルの詳細を設定
        await editChannelPermission(newState.channel, member.user);
        await updateControlPanel();

        // メッセージを投稿
        await newState.channel.send({
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
    oldState.channelId !== newState.channelId &&
    oldState.channelId &&
    config.customVcList.find(
      (channelEntry) => channelEntry.channelId === oldState.channelId,
    )
  ) {
    if (!oldState.channel) return; // ボイスチャンネルが取得できない場合は処理を終了

    try {
      // VCの全メンバー (コンフィグに入ったBotを除く)
      const membersAll = oldState.channel.members;
      const members = membersAll.filter(
        (member) => !config.readBotList.some((bot) => bot.botId === member.id),
      );

      if (members.size === 0) {
        // 人がいない場合
        // チャンネルの詳細をリセット
        await editChannelPermission(oldState.channel, undefined);
        await updateControlPanel();

        // VCの人(Bot以外)がいなくなった場合 → 解散
        if (oldState.channel.members.size === 0) {
          // 人もBotも全員いなくなった場合
          // メッセージを投稿
          await oldState.channel.send({
            embeds: [freeChannelEmbed],
          });
        } else {
          // 最後のBotをキックする際にメッセージを投稿
          if (oldState.channel.members.size === 1) {
            await oldState.channel.send({
              embeds: [onlyBotKickEmbed],
            });
          }
          // 人がいなくなったがBotがいる場合
          const botMember = oldState.channel.members.first();
          if (botMember) {
            await botMember.voice.disconnect();
          }
        }
      } else if (getChannelOwner(oldState.channel) === member) {
        // オーナーがいない場合はメッセージを投稿
        await oldState.channel.send({
          embeds: [noChannelOwnerEmbed(member.user)],
        });
      }
    } catch (error) {
      logger.error(error);
    }
  }
}
