import { VoiceState } from 'discord.js';
import { customVcChannelIdList } from '../module/voiceCreateData.js';
import { logger } from '../utils/log.js';
import {
  resetChannelDetails,
  setChannelDetails,
} from '../module/voiceController.js';

// チャンネルを解放するまでの時間
const channelFreeTime = 10 * 1000;

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

  const deleteMap = new Map<string, NodeJS.Timeout>();

  // -----------------------------------------------------------------------------------------------------------
  // VC作成チャンネルに入った場合の処理
  // -----------------------------------------------------------------------------------------------------------
  if (
    oldState.channelId !== newState.channelId &&
    newState.channelId &&
    customVcChannelIdList.includes(newState.channelId)
  ) {
    const newChannel = newState.channel;
    if (!newChannel) return; // ボイスチャンネルが取得できない場合は処理を終了

    try {
      // マップに予約がある場合
      if (deleteMap.has(newChannel.id)) {
        // -----------------------------------------------------------------------------------------------------------
        // VCに入り直した場合、チャンネルを削除する予約をキャンセルする処理
        // -----------------------------------------------------------------------------------------------------------
        clearTimeout(deleteMap.get(newChannel.id)); // 予約をキャンセル
        deleteMap.delete(newChannel.id);
      } else if (newChannel.members.size === 1) {
        // -----------------------------------------------------------------------------------------------------------
        // 初めてVCに入った場合、入った人をオーナーにしてチャンネルを初期化する処理
        // -----------------------------------------------------------------------------------------------------------
        // チャンネルの詳細を設定
        await setChannelDetails(member.user, newChannel);
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
    !customVcChannelIdList.includes(oldState.channelId)
  ) {
    const oldChannel = oldState.channel;
    if (!oldChannel) return; // ボイスチャンネルが取得できない場合は処理を終了

    try {
      if (oldChannel.members.size === 0) {
        // チャンネルに誰もいない場合
        const timeout = setTimeout(() => {
          // チャンネルの詳細をリセット
          void resetChannelDetails(oldChannel);
          deleteMap.delete(oldChannel.id);
        }, channelFreeTime);
        deleteMap.set(oldChannel.id, timeout); // マップに予約を保存
      }
    } catch (error) {
      logger.warn(error);
    }
  }
}
