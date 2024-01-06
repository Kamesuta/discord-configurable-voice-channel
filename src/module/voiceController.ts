import {
  EmbedBuilder,
  ActionRowBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuInteraction,
  OverwriteResolvable,
  VoiceBasedChannel,
  Message,
  User,
  APIEmbedField,
} from 'discord.js';
import { config } from '../utils/config.js';
import { PrismaClient } from '@prisma/client';
import {
  allowCreateUserPermisson,
  allowUserPermisson,
  createChannelEmbed,
  denyUserPermisson,
  operationMenu,
  userBlackListMenu,
  userBlackReleaseListMenu,
} from '../module/voiceCreateData.js';

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

/**
 * VCコントローラーで用いるインタラクションの型
 */
export type MenuInteraction =
  | StringSelectMenuInteraction
  | UserSelectMenuInteraction
  | ModalSubmitInteraction;

/**
 * チャンネルの設定を更新するための処理
 * @param ownerUser ユーザー
 * @param channel チャンネル
 * @param message メッセージ(ない場合は新規投稿)
 */
export async function setChannelDetails(
  ownerUser: User,
  channel: VoiceBasedChannel,
  message?: Message,
): Promise<void> {
  const allUsers = await prisma.blackLists.findMany({
    where: {
      userId: String(ownerUser.id),
    },
  });

  // チャンネルの設定
  const channelName = channel.name;
  const channelUserLimit = channel.userLimit;
  const channelUserLimitText =
    channelUserLimit === 0 ? '無制限' : `${channelUserLimit}人`;
  const channelBitRate = Number(channel.bitrate) / 1000;

  // ブロックしているユーザーリストの文字列を作成
  const blockUserList: string =
    allUsers.length > 0
      ? allUsers.map((user) => `<@${user.blockUserId}>`).join('\n')
      : 'なし';

  // -----------------------------------------------------------------------------------------------------------
  // チャンネルの設定メッセージを更新する処理
  // -----------------------------------------------------------------------------------------------------------
  const embedFields: APIEmbedField[] = [
    {
      name: '現在の設定',
      value: `チャンネル名: ${channelName}\nユーザー人数制限: ${channelUserLimitText}\nビットレート: ${channelBitRate}kbps`,
    },
    { name: 'ブロックしているユーザー', value: blockUserList },
  ];
  if (message) {
    await message.edit({
      embeds: [editChannelEmbed.setFields(...embedFields)],
    });
  } else {
    await channel.send({
      content: `<@${ownerUser.id}>`,
      embeds: [createChannelEmbed.setFields(...embedFields)],
      components: [userBlackListMenu, userBlackReleaseListMenu, operationMenu],
    });
  }

  // チャンネル権限オーバーライド
  const overwrites: OverwriteResolvable[] = [
    {
      id: ownerUser,
      allow: [allowUserPermisson, allowCreateUserPermisson],
    },
  ];
  // -----------------------------------------------------------------------------------------------------------
  // ブロックしているユーザーがいた場合、チャンネルを表示しない
  // -----------------------------------------------------------------------------------------------------------
  for (const user of allUsers) {
    // ユーザーをフェッチしないと内部でresolveに失敗してエラーが出る
    const blockUser = await channel.client.users.fetch(user.blockUserId);
    if (blockUser) {
      overwrites.push({
        id: blockUser,
        deny: [denyUserPermisson],
      });
    }
  }
  // -----------------------------------------------------------------------------------------------------------
  // チャンネルの権限をセットする
  // -----------------------------------------------------------------------------------------------------------
  await channel.permissionOverwrites.set(overwrites);
}
