import { VoiceState } from 'discord.js';
import {
  createChannelEmbed,
  userBlackListMenu,
  userBlackReleaseListMenu,
  operationMenu,
  publicButton,
  voiceChannelId,
  memberRoleId,
  allowUserPermisson,
  denyUserPermisson,
  allowCreateUserPermisson,
} from '../module/voiceCreateData.js';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/log.js';

const prisma = new PrismaClient();
// デフォルトであるボイスチャンネル
const defaultChannelList: string[] = [
  '1161720349587669073', // 自動作成
  '1043089821947678720', // 作業1
  '1117728041532137494', // 作業2
  '993406228346707988', // ゲーム1
  '993406391924568154', // ゲーム2
  '993406601807536160', // 色々1
  '1022153462806478860', // 色々2
  '1068464214311714816', // 色々3
  '1068465168746553385', // 色々4
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
  const newMember = newState.member;
  const oldMember = oldState.member;
  const userName = newMember
    ? `${newState.member?.user.displayName}`
    : oldMember
    ? `${oldState.member?.user.displayName}`
    : 'unknown user';
  const userId = newMember
    ? `${newState.member?.user.id}`
    : oldMember
    ? `${oldState.member?.user.id}`
    : '';
  const defaultChannelName = `自動作成-${userName}`; // デフォルトのチャンネル名
  const deleteMap = new Map<string, NodeJS.Timeout>();
  // -----------------------------------------------------------------------------------------------------------
  // VC作成チャンネルに入った場合の処理
  // -----------------------------------------------------------------------------------------------------------
  if (
    oldState.channelId !== voiceChannelId &&
    newState.channelId === voiceChannelId
  ) {
    const voiceChannel = newState.channel; // 特定のボイスチャンネルを取得
    voiceChannel
      ?.clone({
        // 特定のボイスチャンネルと同じカテゴリーに新しいボイスチャンネルを作成
        name: defaultChannelName,
        permissionOverwrites: [
          {
            id: userId,
            allow: [allowCreateUserPermisson, allowUserPermisson],
          },
          {
            id: memberRoleId,
            deny: [denyUserPermisson],
          },
        ],
      })
      .then((newVoiceChannel) => {
        newState
          .setChannel(newVoiceChannel) // 作成したボイスチャンネルに移動
          .then(async () => {
            const channelName: string | undefined = newState.channel?.name;
            let channelUserLimit: number | string | undefined =
              newState.channel?.userLimit;
            if (channelUserLimit === 0) {
              channelUserLimit = '無制限';
            } else {
              channelUserLimit = `${channelUserLimit}人`;
            }
            const channelBitRate = Number(newState.channel?.bitrate) / 1000;
            let blockUserList = 'なし';

            const allUsers = await prisma.blackLists.findMany({
              where: {
                userId: String(newMember?.id),
              },
            });
            for (let i = 0; i < allUsers.length; i++) {
              if (blockUserList === 'なし') blockUserList = '';
              blockUserList += `<@${String(allUsers[i].blockUserId)}>\n`;
            }
            await newVoiceChannel.send({
              // 移動が成功したらメッセージを送信
              content: `<@${userId}>`,
              embeds: [
                createChannelEmbed.setFields(
                  {
                    name: '現在の設定',
                    value: `チャンネル名: ${channelName}\nユーザー人数制限: ${channelUserLimit}\nビットレート: ${channelBitRate}kbps`,
                  },
                  { name: 'ブロックしているユーザー', value: blockUserList },
                ),
              ],
              components: [
                userBlackListMenu,
                userBlackReleaseListMenu,
                operationMenu,
                publicButton,
              ],
            });
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
