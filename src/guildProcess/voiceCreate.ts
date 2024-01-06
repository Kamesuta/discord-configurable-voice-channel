import { VoiceState } from 'discord.js';
import {
  createChannelEmbed,
  userBlackListMenu,
  userBlackReleaseListMenu,
  operationMenu,
  voiceChannelId,
  allowUserPermisson,
  allowCreateUserPermisson,
} from '../module/voiceCreateData.js';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/log.js';
import { setChannelDetails } from '../module/voiceController.js';

const prisma = new PrismaClient();
// デフォルトであるボイスチャンネル
const defaultChannelList: string[] = [
  '1189494772637900841', // 自動作成
];

/**
 * ボイスチャンネル作成機能
 * VC作成チャンネルにアクセス -> VC作成(権限管理) -> VC移動
 * [仕様: VCに30秒間誰もいない場合は自動削除]
 * @param oldState 移動前のステータス
 * @param newState 移動後のステータス
 */
export function onVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState,
): void {
  const member = newState.member ?? oldState.member;
  if (!member) return; // メンバーが取得できない場合は処理を終了

  const userName = member.displayName; // サーバーのニックネームを取得
  const userId = member.user.id;

  const defaultChannelName = `自動作成-${userName}`; // デフォルトのチャンネル名
  const deleteMap = new Map<string, NodeJS.Timeout>();
  // -----------------------------------------------------------------------------------------------------------
  // VC作成チャンネルに入った場合の処理
  // -----------------------------------------------------------------------------------------------------------
  if (
    oldState.channelId !== voiceChannelId &&
    newState.channelId === voiceChannelId
  ) {
    const voiceChannel = newState.channel; // VC作成ボイスチャンネルを取得
    if (!voiceChannel) return; // ボイスチャンネルが取得できない場合は処理を終了

    voiceChannel
      .clone({
        // VC作成ボイスチャンネルと同じカテゴリーに新しいボイスチャンネルを作成
        name: defaultChannelName,
        permissionOverwrites: [
          {
            id: userId,
            allow: [allowCreateUserPermisson, allowUserPermisson],
          },
        ],
      })
      .then((newVoiceChannel) => {
        newState
          .setChannel(newVoiceChannel) // 作成したボイスチャンネルに移動
          .then(async () => {
            await setChannelDetails(member.user, newVoiceChannel); // チャンネルの詳細を設定
          })
          .catch((error: Error) => {
            logger.error(error);
            void newVoiceChannel.send('移動に失敗しました');
          });
      })
      .catch((error: Error) => {
        logger.error(error);
      });
  }
  // -----------------------------------------------------------------------------------------------------------
  // VCに誰もいない場合、チャンネルを削除する処理
  // -----------------------------------------------------------------------------------------------------------
  if (oldState.channelId && oldState.channelId !== newState.channelId) {
    try {
      for (let i = 0; i < defaultChannelList.length; i++) {
        // デフォルトで存在しているボイスチャンネルを除外する
        if (defaultChannelList[i] === oldState.channelId) return;
      }
      if (oldState.channel?.members.size === 0) {
        // チャンネルに誰もいない場合
        const timeout = setTimeout(() => {
          // 30秒後に削除する予約を作成
          void oldState.channel?.delete();
          if (oldState.channel) {
            deleteMap.delete(oldState.channel.id);
          }
        }, 30 * 1000);
        deleteMap.set(oldState.channel.id, timeout); // マップに予約を保存
      }
    } catch (error) {
      logger.warn(error);
    }
  }
  // -----------------------------------------------------------------------------------------------------------
  // VCに入り直した場合、チャンネルを削除する予約をキャンセルする処理
  // -----------------------------------------------------------------------------------------------------------
  if (newState.channelId && newState.channelId !== oldState.channelId) {
    try {
      for (let i = 0; i < defaultChannelList.length; i++) {
        // デフォルトで存在しているボイスチャンネルを除外する
        if (defaultChannelList[i] === newState.channelId) return;
      }
      if (deleteMap.has(newState.channelId)) {
        // マップに予約がある場合
        clearTimeout(deleteMap.get(newState.channelId)); // 予約をキャンセル
        deleteMap.delete(newState.channelId);
      }
    } catch (error) {
      logger.warn(error);
    }
  }
}
