import { VoiceState } from 'discord.js';
import { customVcChannelIdList } from '../module/voiceCreateData.js';
import { logger } from '../utils/log.js';
import {
  resetChannelDetails,
  setChannelDetails,
} from '../module/voiceController.js';

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
    customVcChannelIdList.includes(newState.channelId)
  ) {
    if (!newState.channel) return; // ボイスチャンネルが取得できない場合は処理を終了

    if (newState.channel.members.size === 1) {
      // -----------------------------------------------------------------------------------------------------------
      // 初めてVCに入った場合、入った人をオーナーにしてチャンネルを初期化する処理
      // -----------------------------------------------------------------------------------------------------------
      // チャンネルの詳細を設定
      await setChannelDetails(member.user, newState.channel).catch((error) => {
        logger.error(error);
      });
    }
  }

  // -----------------------------------------------------------------------------------------------------------
  // VCに誰もいない場合、チャンネルを削除する処理
  // -----------------------------------------------------------------------------------------------------------
  if (
    oldState.channelId !== newState.channelId &&
    oldState.channelId &&
    customVcChannelIdList.includes(oldState.channelId)
  ) {
    if (!oldState.channel) return; // ボイスチャンネルが取得できない場合は処理を終了

    if (oldState.channel.members.size === 0) {
      // チャンネルの詳細をリセット
      await resetChannelDetails(oldState.channel).catch((error) => {
        logger.error(error);
      });
    }
  }
}
