import { Interaction, PermissionsBitField, ChannelType } from 'discord.js';
import {
  MenuInteraction,
  onOperationMenu,
  prisma,
  setChannelDetails,
} from '../module/voiceController.js';

/**
 * ボイスチャンネル作成のインタラクション処理
 * @param interaction インタラクション
 */
export async function onVoiceCreateInteraction(
  interaction: Interaction,
): Promise<void> {
  try {
    if (
      !interaction.isStringSelectMenu() &&
      !interaction.isModalSubmit() &&
      !interaction.isUserSelectMenu()
    )
      return;

    const channel = interaction.channel;

    if (channel && channel.type === ChannelType.GuildVoice) {
      switch (interaction.customId) {
        // -----------------------------------------------------------------------------------------------------------
        // チャンネルの設定
        // -----------------------------------------------------------------------------------------------------------
        case 'operationMenu': {
          if (!(await validatePermission(interaction))) return;
          if (!interaction.isStringSelectMenu()) return;

          const operationPage = interaction.values[0].split('_')[0];
          await onOperationMenu(interaction, operationPage);
          break;
        }

        // -----------------------------------------------------------------------------------------------------------
        // 人数制限の変更
        // -----------------------------------------------------------------------------------------------------------
        case 'changePeopleLimitedModal': {
          if (!(await validatePermission(interaction))) return;
          if (!interaction.isModalSubmit()) return;

          const channelUserLimit = Number(
            interaction.fields.getTextInputValue('changePeopleLimitedInput'),
          );
          if (Number.isNaN(channelUserLimit)) {
            await interaction.reply({
              content: '数字を入れてください',
              ephemeral: true,
            });
          } else if (channelUserLimit > 99) {
            await interaction.reply({
              content: '変更できる人数制限の値は0~99人までです',
              ephemeral: true,
            });
          } else {
            await interaction.deferReply({ ephemeral: true });
            await channel.setUserLimit(channelUserLimit);
            await updateChannelDetails(interaction);
            await interaction.editReply({
              content: `チャンネルの人数制限を${channelUserLimit}人に変更しました`,
            });
          }
          break;
        }

        // -----------------------------------------------------------------------------------------------------------
        // ビットレートの変更
        // -----------------------------------------------------------------------------------------------------------
        case 'changeBitRateModal': {
          if (!(await validatePermission(interaction))) return;
          if (!interaction.isModalSubmit()) return;

          const channelBitRate = Number(
            interaction.fields.getTextInputValue('changeBitRateInput'),
          );
          if (Number.isNaN(channelBitRate)) {
            await interaction.reply({
              content: '数字を入れてください',
              ephemeral: true,
            });
          } else if (channelBitRate < 8 || channelBitRate > 384) {
            await interaction.reply({
              content: '変更できるビットレートの値は8~384kbpsまでです',
              ephemeral: true,
            });
          } else {
            await interaction.deferReply({ ephemeral: true });
            await channel.setBitrate(channelBitRate * 1000);
            await updateChannelDetails(interaction);
            await interaction.editReply({
              content: `チャンネルのビットレートを${channelBitRate}kbpsに変更しました`,
            });
          }
          break;
        }

        // -----------------------------------------------------------------------------------------------------------
        // ユーザーをブロックする処理
        // -----------------------------------------------------------------------------------------------------------
        case 'userBlackList': {
          if (!(await validatePermission(interaction))) return;
          if (!interaction.isUserSelectMenu()) return;

          await interaction.deferReply({ ephemeral: true });
          const userId: string = String(interaction.user.id);
          const errorUsers: string[] = [];
          const selectedMemberNum = interaction.values.length;
          // チャンネルがボイスチャンネルかどうか確認
          const allUsers = await prisma.blackLists.findMany({
            where: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              user_id: String(interaction.user.id),
            },
          });
          for (let i = 0; i < selectedMemberNum; i++) {
            const blockUserId: string = String(interaction.values[i]);
            // Prismaを使ってBlackListsテーブルにレコードを作成
            if (
              allUsers.find(
                (user) => String(user.block_user_id) === blockUserId,
              )
            ) {
              errorUsers.push(blockUserId);
            } else {
              await prisma.blackLists.create({
                data: {
                  /* eslint-disable @typescript-eslint/naming-convention */
                  user_id: String(userId),
                  block_user_id: String(blockUserId),
                  /* eslint-enable @typescript-eslint/naming-convention */
                },
              });
            }
          }
          await updateChannelDetails(interaction);
          if (errorUsers.length > 0) {
            const errorUsersString = errorUsers
              .map((userId) => `<@${userId}>`)
              .join(', ');
            await interaction.editReply({
              content: `選択した${
                selectedMemberNum - errorUsers.length
              }人のユーザーのブロックが完了しました。 ${errorUsersString} は既にブロックされているためブロックできませんでした`,
            });
          } else {
            await interaction.editReply({
              content: `選択した${selectedMemberNum}人のユーザーのブロックが完了しました`,
            });
          }
          break;
        }

        // -----------------------------------------------------------------------------------------------------------
        // ユーザーのブロックを解除する処理
        // -----------------------------------------------------------------------------------------------------------
        case 'userBlackReleaseList': {
          if (!(await validatePermission(interaction))) return;
          if (!interaction.isUserSelectMenu()) return;

          await interaction.deferReply({ ephemeral: true });
          const userId: string = String(interaction.user.id);
          // チャンネルがボイスチャンネルかどうか確認
          const allUsers = await prisma.blackLists.findMany({
            where: {
              // eslint-disable-next-line @typescript-eslint/naming-convention
              user_id: String(interaction.user.id),
            },
          });
          for (let i = 0; i < interaction.values.length; i++) {
            const blockUserId: string = String(interaction.values[i]);
            for (let i = 0; i < allUsers.length; i++) {
              if (String(allUsers[i].block_user_id) === blockUserId) {
                await prisma.blackLists.deleteMany({
                  where: {
                    /* eslint-disable @typescript-eslint/naming-convention */
                    user_id: String(userId),
                    block_user_id: String(blockUserId),
                    /* eslint-enable @typescript-eslint/naming-convention */
                  },
                });
              }
            }
          }
          await updateChannelDetails(interaction);
          await interaction.editReply({
            content: '選択したユーザーのブロック解除が完了しました',
          });
          break;
        }
      }
    }
  } catch (error) {
    console.log(error);
  }
}

/**
 * 権限チェックを行う。権限が足りなかったらリプライを送信してfalseを返す
 * @param interaction インタラクション
 * @returns 権限があればtrue、なければfalse
 */
async function validatePermission(
  interaction: MenuInteraction,
): Promise<boolean> {
  if (
    !interaction.memberPermissions?.has(
      PermissionsBitField.Flags.ManageChannels,
    )
  ) {
    await interaction.reply({
      content: 'あなたにはチャンネルの設定をする権限がありません',
      ephemeral: true,
    });
    return false;
  }
  return true;
}

/**
 * チャンネルの設定を更新するための処理
 * @param interaction インタラクション
 */
async function updateChannelDetails(
  interaction: MenuInteraction,
): Promise<void> {
  // チャンネルの設定
  const channel = interaction.channel;
  if (!channel?.isVoiceBased()) return; // ボイスチャンネル以外は処理を終了

  // VCコントローラーのメッセージを取得
  const message = interaction.message;
  if (!message) return;

  // チャンネルの設定を更新
  await setChannelDetails(interaction.user, channel, message);
}
