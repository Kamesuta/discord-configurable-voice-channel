import { PrismaClient } from '@prisma/client';
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
  User,
  ButtonInteraction,
  UserSelectMenuBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  PermissionsBitField,
  ButtonStyle,
  OverwriteType,
  GuildMember,
} from 'discord.js';

import { config, getChannelEntry } from './utils/config.js';
import { isApprovalChannel, setApprovalWaitChannel } from './voiceApproval.js';

import { client } from './index.js';

/**
 * データベースのインスタンス
 */
export const prisma = new PrismaClient();

/**
 * ボイスチャンネルを作成時に送る埋め込みメッセージ
 */
const controlPannelEmbed: EmbedBuilder = new EmbedBuilder()
  .setColor(parseInt(config.botColor.replace('#', ''), 16))
  .setTitle('🟣VC操作パネル')
  .setDescription(
    '一番最初にVCに入った人(VCのオーナー)は、このパネルでVCの管理を行うことが出来ます。\n設定を行いたい場合、下のメニューから設定を行ってください。',
  );

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
 * ボタンの行
 */
const buttonRow: ActionRowBuilder<ButtonBuilder> =
  new ActionRowBuilder<ButtonBuilder>().setComponents(
    // ブロックユーザー確認ボタン
    new ButtonBuilder()
      .setCustomId('showBlackList')
      .setLabel('ブロックユーザー確認')
      .setEmoji({
        name: '📝',
      })
      .setStyle(ButtonStyle.Success),
    // 許可制VCをON/OFFするためのボタン
    new ButtonBuilder()
      .setCustomId('toggleApproval')
      .setLabel('許可制VCをON/OFF')
      .setEmoji({
        name: '🔒',
      })
      .setStyle(ButtonStyle.Primary),
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
          label: 'VCのオーナーの変更',
          description: 'VCの管理権限を他の人に渡します',
          value: 'owner_change',
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
 * 許可制VCの許可された人の権限
 */
export const allowUserApprovalChannelPermisson: bigint[] = [
  PermissionsBitField.Flags.Connect, // 接続
];

/**
 * ボイスチャンネルを使用させなくさせるための権限
 */
const denyUserPermisson: bigint[] = [
  PermissionsBitField.Flags.ViewChannel, // チャンネルを見る
];

/**
 * 許可制VCのデフォルト権限
 */
const denyUserApprovalChannelPermisson: bigint[] = [
  PermissionsBitField.Flags.Connect, // 接続
];

/**
 * チャンネルに初めて入った際の埋め込みメッセージ
 */
export const createChannelEmbed: EmbedBuilder = new EmbedBuilder()
  .setColor(parseInt(config.botColor.replace('#', ''), 16))
  .setTitle('VCへようこそ！')
  .setDescription(
    `あなたがVCに入った最初の人です！\n<#${config.controlPanelChannelId}>でVCの人数制限やメンバーのブロック設定が行なえます！`,
  );
/**
 * チャンネルオーナーがいなくなった際の埋め込みメッセージ
 * @param user 退出したユーザー
 * @returns 埋め込みメッセージ
 */
export const noChannelOwnerEmbed = (user: User): EmbedBuilder =>
  new EmbedBuilder()
    .setColor(parseInt(config.botColor.replace('#', ''), 16))
    .setTitle('VCのオーナーが退出しました')
    .setDescription(
      `<@${user.id}>が退出したため、新しいオーナーを選出できます。\n新しいオーナーを設定するためには<#${config.controlPanelChannelId}>の「チャンネル設定」から「VCのオーナーを変更」を選択してください。`,
    );
/**
 * チャンネルが解散した際の埋め込みメッセージ
 */
export const freeChannelEmbed: EmbedBuilder = new EmbedBuilder()
  .setColor(parseInt(config.botColor.replace('#', ''), 16))
  .setTitle('VCが解散しました')
  .setDescription('人がいなくなったため、VCが誰でも使えるようになりました');
/**
 * チャンネルが読み上げBotのみになった際の埋め込みメッセージ
 */
export const onlyBotKickEmbed: EmbedBuilder = new EmbedBuilder()
  .setColor(parseInt(config.botColor.replace('#', ''), 16))
  .setTitle('読み上げBotのみになりました')
  .setDescription('読み上げBotのみになったためBotが切断されました');
/**
 * VCを譲渡する際の埋め込みメッセージ
 * @param user 譲渡されたユーザー
 * @returns 埋め込みメッセージ
 */
export const transferedOwnershipEmbed = (user: User): EmbedBuilder =>
  new EmbedBuilder()
    .setColor(parseInt(config.botColor.replace('#', ''), 16))
    .setTitle('VCのオーナーが替わりました')
    .setDescription(
      `今後は<@${user.id}>が<#${config.controlPanelChannelId}>で人数制限やブロック設定を行うことが出来ます`,
    );

/**
 * ブロックしているユーザーを表示する際の埋め込みメッセージ
 */
const showBlackListEmbed: EmbedBuilder = new EmbedBuilder()
  .setColor(parseInt(config.botColor.replace('#', ''), 16))
  .setTitle('ブロックしているユーザー');

/**
 * 許可制VCをON/OFFする際のメッセージ
 * @param enabled 許可制VCがONかOFFか
 * @returns 埋め込みメッセージ
 */
export const toggleApprovalEmbed = (enabled: boolean): EmbedBuilder =>
  new EmbedBuilder()
    .setColor(parseInt(config.botColor.replace('#', ''), 16))
    .setTitle('許可制VCの設定が変更されました')
    .setDescription(
      `許可制VCが${
        enabled ? 'ON' : 'OFF'
      }になりました\n「↓ 参加待機」VCに入るとリクエスト通知が来ます`,
    );

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
 * VCのオーナーの変更を行う際のモーダル
 */
const transferOwnershipEmbed: EmbedBuilder = new EmbedBuilder()
  .setColor(parseInt(config.botColor.replace('#', ''), 16))
  .setTitle('VCのオーナーの変更')
  .setDescription(
    '他の人にVCの管理権限を渡します\n設定を行いたい場合、下のメニューから設定を行ってください。',
  );
/**
 * 譲渡するユーザーを選択するためのセレクトメニュー
 */
const transferOwnershipMenu: ActionRowBuilder<UserSelectMenuBuilder> =
  new ActionRowBuilder<UserSelectMenuBuilder>().setComponents(
    new UserSelectMenuBuilder()
      .setCustomId('transferOwnership')
      .setPlaceholder('VCの管理権限を譲渡するユーザーを選択')
      .setMaxValues(1)
      .setMinValues(1),
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
 */
export async function updateControlPanel(): Promise<void> {
  // -----------------------------------------------------------------------------------------------------------
  // チャンネルを取得
  // -----------------------------------------------------------------------------------------------------------
  const panelChannel = client.channels.resolve(config.controlPanelChannelId);
  if (!panelChannel?.isTextBased()) {
    throw new Error('VC操作パネルを投稿するチャンネルが見つかりませんでした。');
  }
  const panelMessage = config.controlPanelMessageId
    ? await panelChannel.messages.fetch(config.controlPanelMessageId)
    : undefined;

  // -----------------------------------------------------------------------------------------------------------
  // チャンネルの設定をパネルに反映する
  // -----------------------------------------------------------------------------------------------------------
  if (!panelMessage) {
    await panelChannel.send({
      embeds: [controlPannelEmbed],
      components: [
        userBlackListMenu,
        userBlackReleaseListMenu,
        buttonRow,
        operationMenu,
      ],
    });
  }
}

/**
 * VCのオーナーを取得する
 * @param channel チャンネル
 * @returns オーナー
 */
export function getChannelOwner(
  channel: VoiceBasedChannel,
): GuildMember | undefined {
  // チャンネルのオーナーを取得
  const ownerUser = channel.permissionOverwrites.cache.find(
    // 優先スピーカー権限を持っているユーザーを取得
    (permission) =>
      permission.type === OverwriteType.Member &&
      permission.allow.has(PermissionsBitField.Flags.PrioritySpeaker),
  );
  if (!ownerUser) return undefined;
  return channel.guild.members.resolve(ownerUser.id) ?? undefined;
}

/**
 * チャンネルの権限設定を更新する
 * @param channel チャンネル
 * @param ownerUser ユーザー
 * @param approval 許可制VCかどうか
 */
export async function editChannelPermission(
  channel: VoiceBasedChannel,
  ownerUser: User | undefined,
  approval?: boolean,
): Promise<void> {
  // コンフィグからchannelEntryを取得します
  const channelEntry = getChannelEntry(channel.id);
  if (!channelEntry) return;

  // 親カテゴリから継承した権限を取得
  const inheritOverwrites = getOwnCategoryPermission(channel);

  if (ownerUser) {
    // 入る権限がeveryoneについているか確認
    if (approval === undefined) {
      approval = isApprovalChannel(channel);
    }

    // 許可制VCの場合、許可されたユーザーを取得
    const approvedOverwrites = [
      ...channel.permissionOverwrites.cache.values(),
    ].filter((permission) =>
      permission.allow.has(allowUserApprovalChannelPermisson),
    );

    // ブロックしているユーザーがいた場合、チャンネルを表示しない
    const denyOverwrites = await getDenyOverwrites(ownerUser);

    // チャンネルの権限をセットする
    await channel.permissionOverwrites.set([
      ...inheritOverwrites,
      ...approvedOverwrites,
      {
        // 許可制VCかどうか
        id: channel.guild.roles.everyone,
        deny: approval ? [denyUserApprovalChannelPermisson] : [],
      },
      {
        // オーナーの権限
        id: ownerUser,
        allow: [allowUserPermisson, allowCreateUserPermisson],
      },
      ...denyOverwrites,
    ]);

    // 参加待ちチャンネルを作成/削除
    await setApprovalWaitChannel(channel, denyOverwrites, approval);
  } else {
    // チャンネルの権限をリセットする
    await channel.edit({
      userLimit: channelEntry.maxUser,
      permissionOverwrites: [...inheritOverwrites],
    });

    // 参加待ちチャンネルを削除
    await setApprovalWaitChannel(channel, [], false);
  }
}

/**
 * ブロックしているユーザーがいた場合、チャンネルを表示しない
 * @param ownerUser ユーザー
 * @returns ブロックされているユーザーの権限
 */
async function getDenyOverwrites(
  ownerUser: User,
): Promise<OverwriteResolvable[]> {
  const overwrites: OverwriteResolvable[] = [];

  // ブロックしているユーザーを取得
  const allUsers = await prisma.blackLists.findMany({
    where: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      user_id: String(ownerUser.id),
    },
  });

  for (const user of allUsers) {
    // ユーザーをフェッチしないと内部でresolveに失敗してエラーが出る
    const blockUser = await client.users.fetch(user.block_user_id);
    if (blockUser) {
      overwrites.push({
        id: blockUser,
        deny: [denyUserPermisson],
      });
    }
  }

  return overwrites;
}

/**
 * チャンネルのカテゴリのBot自身の権限を取得
 * @param channel チャンネル
 * @returns 権限
 */
export function getOwnCategoryPermission(
  channel: VoiceBasedChannel,
): OverwriteResolvable[] {
  const me = channel.guild.members.me;
  if (!channel.parent || !me) return [];

  // カテゴリの上書き権限を取得
  return [...channel.parent.permissionOverwrites.cache.values()].filter(
    (permission) =>
      me.id === permission.id || me.roles.cache.has(permission.id),
  );
}

/**
 * ブロックしているユーザーを確認
 * @param interaction インタラクション
 * @param user ユーザー
 */
export async function showBlackList(
  interaction: MenuInteraction,
  user: User,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const allUsers = await prisma.blackLists.findMany({
    where: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      user_id: String(user.id),
    },
  });

  // ブロックしているユーザーリストの文字列を作成
  const blockUserList: string =
    allUsers.length > 0
      ? allUsers.map((user) => `<@${user.block_user_id}>`).join('\n')
      : 'なし';

  // リプライを送信
  await interaction.editReply({
    embeds: [
      showBlackListEmbed.setDescription(blockUserList).setAuthor({
        name: user.username,
        iconURL: user.avatarURL() ?? undefined,
      }),
    ],
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
    case 'peopleLimited_change': {
      // 人数制限
      await interaction.showModal(changePeopleLimitedModal);
      break;
    }

    case 'owner_change': {
      // VCのオーナーの変更
      await interaction.reply({
        embeds: [transferOwnershipEmbed],
        components: [transferOwnershipMenu],
        ephemeral: true,
      });
      break;
    }
  }
}

/**
 * 入っている管理権限のあるVCのチャンネルを取得 (権限チェックも行う)
 * @param interaction インタラクション
 * @param isTransferOwnership オーナー譲渡中かどうか (オーナー譲渡中はオーナーが居ない場合に権限チェックを行わない)
 * @returns チャンネル
 */
export async function getConnectedEditableChannel(
  interaction: MenuInteraction,
  isTransferOwnership: boolean = false,
): Promise<VoiceBasedChannel> {
  // メンバーを取得
  const member = await interaction.guild?.members.fetch(interaction.user);
  if (!member) {
    throw new Error('メンバーが見つかりませんでした');
  }
  // 入っているVCのチャンネルを取得
  const channel = member.voice.channel;
  if (!channel) {
    // VCに入っていない場合、例外をthrowする
    throw new Error(
      `VCに入っていないため、<#${interaction.channelId}>のパネルは使用できません。\nVCに入ってからもう一度実行してください`,
    );
  }
  // カスタムVCのチャンネルでない場合、例外をthrowする
  if (!getChannelEntry(channel.id)) {
    throw new Error(
      `このチャンネルでは、<#${interaction.channelId}>のパネルは使用できません\n他のVCに入ってからもう一度実行してください`,
    );
  }

  // 自分がチャンネルの設定権限があるか確認
  if (
    !channel
      .permissionsFor(interaction.user)
      ?.has(PermissionsBitField.Flags.PrioritySpeaker)
  ) {
    // 設定権限がない場合

    // オーナー譲渡中でない場合、権限はないためエラー
    // オーナー譲渡中の場合、オーナーがこのチャンネルにいない場合はエラー
    if (
      !isTransferOwnership ||
      getChannelOwner(channel)?.voice.channel === channel
    ) {
      throw new Error('あなたにはチャンネルの設定をする権限がありません');
    }
  }

  return channel;
}
