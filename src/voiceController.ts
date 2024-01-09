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
  ButtonInteraction,
  UserSelectMenuBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  PermissionsBitField,
  ButtonStyle,
} from 'discord.js';
import { config } from './utils/config.js';
import { PrismaClient } from '@prisma/client';

/**
 * データベースのインスタンス
 */
export const prisma = new PrismaClient();

/**
 * ボイスチャンネルを作成時に送る埋め込みメッセージ
 */
const createChannelEmbed: EmbedBuilder = new EmbedBuilder()
  .setColor(parseInt(config.botColor.replace('#', ''), 16))
  .setTitle('カスタムVCを作成しました。')
  .setDescription('設定を行いたい場合、下のメニューから設定を行ってください。');

/**
 * ブロックするユーザーを選択するためのセレクトメニュー
 */
const userBlackListMenu: ActionRowBuilder<UserSelectMenuBuilder> =
  new ActionRowBuilder<UserSelectMenuBuilder>().setComponents(
    new UserSelectMenuBuilder()
      .setCustomId('userBlackList')
      .setPlaceholder('ブロックするユーザーを選択')
      .setMaxValues(10)
      .setMinValues(1),
  );

/**
 * ブロックしているユーザーを解除選択するためのセレクトメニュー
 */
const userBlackReleaseListMenu: ActionRowBuilder<UserSelectMenuBuilder> =
  new ActionRowBuilder<UserSelectMenuBuilder>().setComponents(
    new UserSelectMenuBuilder()
      .setCustomId('userBlackReleaseList')
      .setPlaceholder('ブロックを解除するユーザーを選択')
      .setMaxValues(10)
      .setMinValues(1),
  );

/**
 * ブロックしているユーザーを確認するためのボタン
 */
const showBlackListButton: ActionRowBuilder<ButtonBuilder> =
  new ActionRowBuilder<ButtonBuilder>().setComponents(
    new ButtonBuilder()
      .setCustomId('showBlackList')
      .setLabel('ブロックユーザー確認')
      .setStyle(ButtonStyle.Success),
  );

/**
 * 設定を選択するためのセレクトメニュー
 */
const operationMenu: ActionRowBuilder<StringSelectMenuBuilder> =
  new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setCustomId('operationMenu')
      .setPlaceholder('チャンネルの設定')
      .setMaxValues(1)
      .setMinValues(1)
      .addOptions(
        {
          label: '人数制限',
          description: '人数制限の人数を変更できます(0~99)',
          value: 'peopleLimited_change',
        },
        {
          label: 'ビットレート',
          description: 'ビットレート(音質)を変更できます(8~384)',
          value: 'bitrate_change',
        },
      ),
  );

/**
 * ボイスチャンネルを使用するユーザーの権限
 */
const allowUserPermisson: bigint[] = [
  PermissionsBitField.Flags.ViewChannel, // チャンネルを見る
];

/**
 * ボイスチャンネルを作成したユーザーの追加管理権限
 */
const allowCreateUserPermisson: bigint[] = [
  PermissionsBitField.Flags.PrioritySpeaker, // 優先スピーカー
];

/**
 * ボイスチャンネルを使用させなくさせるための権限
 */
const denyUserPermisson: bigint[] = [
  PermissionsBitField.Flags.ViewChannel, // チャンネルを見る
];

/**
 * チャンネルの設定を更新する際の埋め込みメッセージ
 */
const editChannelEmbed: EmbedBuilder = new EmbedBuilder()
  .setColor(parseInt(config.botColor.replace('#', ''), 16))
  .setTitle('カスタムVCの設定を変更しました')
  .setDescription('設定を行いたい場合、下のメニューから設定を行ってください。');
/**
 * チャンネルが解散した際の埋め込みメッセージ
 */
const freeChannelEmbed: EmbedBuilder = new EmbedBuilder()
  .setColor(parseInt(config.botColor.replace('#', ''), 16))
  .setTitle('カスタムVCが解散しました')
  .setDescription('人がいなくなったため、VCが誰でも使えるようになりました');
/**
 * ブロックしているユーザーを表示する際の埋め込みメッセージ
 */
const showBlackListEmbed: EmbedBuilder = new EmbedBuilder()
  .setColor(parseInt(config.botColor.replace('#', ''), 16))
  .setTitle('ブロックしているユーザー');

/**
 * 人数制限の変更を行う際のモーダル
 */
const changePeopleLimitedModal: ModalBuilder = new ModalBuilder()
  .setCustomId('changePeopleLimitedModal')
  .setTitle('人数制限の変更');
/**
 * 人数制限の変更を行う際のテキストボックス
 */
const changePeopleLimitedInput: TextInputBuilder = new TextInputBuilder()
  .setMaxLength(2)
  .setMinLength(1)
  .setCustomId('changePeopleLimitedInput')
  .setLabel('変更する人数を入力してください')
  .setPlaceholder('0~99人までです(0人の場合は無制限になります)')
  .setStyle(TextInputStyle.Short);
// モーダルにコンポーネントを追加
changePeopleLimitedModal.addComponents(
  new ActionRowBuilder<TextInputBuilder>().addComponents(
    changePeopleLimitedInput,
  ),
);

/**
 * ビットレートの変更を行う際のモーダル
 */
const changeBitRateModal: ModalBuilder = new ModalBuilder()
  .setCustomId('changeBitRateModal')
  .setTitle('ビットレートの変更');
/**
 * ビットレートの変更を行う際のテキストボックス
 */
const changeBitRateInput: TextInputBuilder = new TextInputBuilder()
  .setMaxLength(3)
  .setMinLength(1)
  .setCustomId('changeBitRateInput')
  .setLabel('変更するビットレート数を入力してください')
  .setPlaceholder('8~384Kbpsまでです(64kbps以下は非推奨です)')
  .setStyle(TextInputStyle.Short);
// モーダルにコンポーネントを追加
changeBitRateModal.addComponents(
  new ActionRowBuilder<TextInputBuilder>().addComponents(changeBitRateInput),
);

/**
 * VCコントローラーで用いるインタラクションの型
 */
export type MenuInteraction =
  | StringSelectMenuInteraction
  | UserSelectMenuInteraction
  | ModalSubmitInteraction
  | ButtonInteraction;

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
      // eslint-disable-next-line @typescript-eslint/naming-convention
      user_id: String(ownerUser.id),
    },
  });

  // チャンネルの設定
  const channelUserLimit = channel.userLimit;
  const channelUserLimitText =
    channelUserLimit === 0 ? '無制限' : `${channelUserLimit}人`;
  const channelBitRate = Number(channel.bitrate) / 1000;

  // -----------------------------------------------------------------------------------------------------------
  // チャンネルの設定メッセージを更新する処理
  // -----------------------------------------------------------------------------------------------------------
  const embedFields: APIEmbedField[] = [
    {
      name: '現在の設定',
      value: `ユーザー人数制限: ${channelUserLimitText}\nビットレート: ${channelBitRate}kbps`,
    },
  ];
  if (message) {
    await message.edit({
      embeds: [editChannelEmbed.setFields(...embedFields)],
    });
  } else {
    await channel.send({
      content: `<@${ownerUser.id}>`,
      embeds: [createChannelEmbed.setFields(...embedFields)],
      components: [
        userBlackListMenu,
        userBlackReleaseListMenu,
        showBlackListButton,
        operationMenu,
      ],
    });
  }

  // チャンネル権限オーバーライド
  const inherit = channel.parent?.permissionOverwrites.cache.values() ?? [];
  const overwrites: OverwriteResolvable[] = [
    ...inherit,
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
    const blockUser = await channel.client.users.fetch(user.block_user_id);
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

  // -----------------------------------------------------------------------------------------------------------
  // ブロックされたユーザーが既にVCにいる場合、VCから退出させる
  // -----------------------------------------------------------------------------------------------------------
  const blockedConnectedMembers = channel.members.filter((member) =>
    allUsers.find((user) => member.id === user.block_user_id),
  );
  for (const [_, member] of blockedConnectedMembers) {
    await member.voice.disconnect();
  }
}

/**
 * チャンネルの設定を初期化する
 * @param channel チャンネル
 */
export async function resetChannelDetails(
  channel: VoiceBasedChannel,
): Promise<void> {
  // -----------------------------------------------------------------------------------------------------------
  // チャンネルの権限をリセットする
  // -----------------------------------------------------------------------------------------------------------
  const inherit = channel.parent?.permissionOverwrites.cache.values() ?? [];
  await channel.edit({
    userLimit: 0,
    bitrate: 64000,
    permissionOverwrites: [...inherit],
  });

  // -----------------------------------------------------------------------------------------------------------
  // 解散メッセージを送信する
  // -----------------------------------------------------------------------------------------------------------
  await channel.send({
    embeds: [freeChannelEmbed],
  });
}

/**
 * ブロックしているユーザーを確認
 * @param interaction インタラクション
 */
export async function showBlackList(
  interaction: MenuInteraction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const allUsers = await prisma.blackLists.findMany({
    where: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      user_id: String(interaction.user.id),
    },
  });

  // ブロックしているユーザーリストの文字列を作成
  const blockUserList: string =
    allUsers.length > 0
      ? allUsers.map((user) => `<@${user.block_user_id}>`).join('\n')
      : 'なし';

  // リプライを送信
  await interaction.editReply({
    embeds: [showBlackListEmbed.setDescription(blockUserList)],
  });
}

/**
 * ボタンが押されたときの処理
 * @param interaction インタラクション
 * @param operationPage ページ
 */
export async function onOperationMenu(
  interaction: StringSelectMenuInteraction,
  operationPage: string,
): Promise<void> {
  switch (operationPage) {
    case 'peopleLimited': // 人数制限
      await interaction.showModal(changePeopleLimitedModal);
      break;
    case 'bitrate': // ビットレート
      await interaction.showModal(changeBitRateModal);
      break;
  }
}
