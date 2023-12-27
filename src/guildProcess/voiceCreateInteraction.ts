import {
  EmbedBuilder,
  ActionRowBuilder,
  Interaction,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
  VoiceChannel,
  UserSelectMenuInteraction,
  PermissionsBitField,
  ChannelType,
} from 'discord.js';
import { config } from '../utils/config.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const editChannelEmbed: EmbedBuilder = new EmbedBuilder()
  .setColor(parseInt(config.botColor.replace('#', ''), 16))
  .setTitle('ボイスチャンネルの設定を変更しました')
  .setDescription('設定を行いたい場合、下のメニューから設定を行ってください。');

const changeNameModal: ModalBuilder = new ModalBuilder()
  .setCustomId('changeNameModal')
  .setTitle('チャンネル名の変更');
const changeNameInput: TextInputBuilder = new TextInputBuilder()
  .setMaxLength(20)
  .setMinLength(1)
  .setCustomId('changeNameInput')
  .setLabel('変更するチャンネル名を入力してください')
  .setPlaceholder('20文字までです')
  .setStyle(TextInputStyle.Short);

const changePeopleLimitedModal: ModalBuilder = new ModalBuilder()
  .setCustomId('changePeopleLimitedModal')
  .setTitle('人数制限の変更');
const changePeopleLimitedInput: TextInputBuilder = new TextInputBuilder()
  .setMaxLength(2)
  .setMinLength(1)
  .setCustomId('changePeopleLimitedInput')
  .setLabel('変更する人数を入力してください')
  .setPlaceholder('0~99人までです(0人の場合は無制限になります)')
  .setStyle(TextInputStyle.Short);

const changeBitRateModal: ModalBuilder = new ModalBuilder()
  .setCustomId('changeBitRateModal')
  .setTitle('ビットレートの変更');

const changeBitRateInput: TextInputBuilder = new TextInputBuilder()
  .setMaxLength(3)
  .setMinLength(1)
  .setCustomId('changeBitRateInput')
  .setLabel('変更するビットレート数を入力してください')
  .setPlaceholder('8~384Kbpsまでです(64kbps以下は非推奨です)')
  .setStyle(TextInputStyle.Short);

const changeNameRow: ActionRowBuilder<TextInputBuilder> =
  new ActionRowBuilder<TextInputBuilder>().addComponents(changeNameInput);
changeNameModal.addComponents(changeNameRow);

const changePeopleLimitedRow: ActionRowBuilder<TextInputBuilder> =
  new ActionRowBuilder<TextInputBuilder>().addComponents(
    changePeopleLimitedInput,
  );
changePeopleLimitedModal.addComponents(changePeopleLimitedRow);

const changeBitRateRow: ActionRowBuilder<TextInputBuilder> =
  new ActionRowBuilder<TextInputBuilder>().addComponents(changeBitRateInput);
changeBitRateModal.addComponents(changeBitRateRow);

type MenuInteraction =
  | StringSelectMenuInteraction
  | UserSelectMenuInteraction
  | ModalSubmitInteraction;

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
          switch (operationPage) {
            case 'name': // 名前
              await interaction.showModal(changeNameModal);
              break;
            case 'peopleLimited': // 人数制限
              await interaction.showModal(changePeopleLimitedModal);
              break;
            case 'bitrate': // ビットレート
              await interaction.showModal(changeBitRateModal);
              break;
          }
          break;
        }

        // -----------------------------------------------------------------------------------------------------------
        // チャンネル名の変更
        // -----------------------------------------------------------------------------------------------------------
        case 'changeNameModal': {
          if (!(await validatePermission(interaction))) return;
          if (!interaction.isModalSubmit()) return;

          await interaction.deferReply({ ephemeral: true });
          const channelName =
            interaction.fields.getTextInputValue('changeNameInput');
          await channel.setName(channelName);
          await updateChannelDetails(interaction);
          await interaction.editReply({
            content: `チャンネルの名前を${channelName}に変更しました`,
          });
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
              userId: String(interaction.user.id),
            },
          });
          for (let i = 0; i < selectedMemberNum; i++) {
            const blockUserId: string = String(interaction.values[i]);
            // Prismaを使ってBlackListsテーブルにレコードを作成
            if (
              allUsers.find((user) => String(user.blockUserId) === blockUserId)
            ) {
              errorUsers.push(blockUserId);
            } else {
              await prisma.blackLists.create({
                data: {
                  userId: String(userId),
                  blockUserId: String(blockUserId),
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
              userId: String(interaction.user.id),
            },
          });
          for (let i = 0; i < interaction.values.length; i++) {
            const blockUserId: string = String(interaction.values[i]);
            for (let i = 0; i < allUsers.length; i++) {
              if (String(allUsers[i].blockUserId) === blockUserId) {
                await prisma.blackLists.deleteMany({
                  where: {
                    userId: String(userId),
                    blockUserId: String(blockUserId),
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
  const allUsers = await prisma.blackLists.findMany({
    // メッセージを更新するためにデータを再度取得する
    where: {
      userId: String(interaction.user.id),
    },
  });
  const channelName = (interaction.channel as VoiceChannel).name;
  const channelUserLimit = (interaction.channel as VoiceChannel)?.userLimit;
  const channelUserLimitText =
    channelUserLimit === 0 ? '無制限' : `${channelUserLimit}人`;
  const channelBitRate =
    Number((interaction.channel as VoiceChannel)?.bitrate) / 1000;

  let blockUserList: string = 'なし';

  for (let i = 0; i < allUsers.length; i++) {
    // ユーザーのブロックリストを全て取得して出力
    if (blockUserList === 'なし') blockUserList = '';
    blockUserList += `<@${String(allUsers[i].blockUserId)}>\n`;
  }
  // -----------------------------------------------------------------------------------------------------------
  // チャンネルの設定メッセージを更新する処理
  // -----------------------------------------------------------------------------------------------------------
  await interaction.message?.edit({
    embeds: [
      editChannelEmbed.setFields(
        {
          name: '現在の設定',
          value: `チャンネル名: ${channelName}\nユーザー人数制限: ${channelUserLimitText}\nビットレート: ${channelBitRate}kbps`,
        },
        { name: 'ブロックしているユーザー', value: blockUserList },
      ),
    ],
  });
}
