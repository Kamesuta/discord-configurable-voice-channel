import { PrismaClient } from '@prisma/client';
import {
  EmbedBuilder,
  ActionRowBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
  VoiceBasedChannel,
  User,
  UserSelectMenuBuilder,
  ButtonBuilder,
  PermissionsBitField,
  ButtonStyle,
  OverwriteType,
  GuildMember,
  OverwriteResolvable,
  MessageComponentInteraction,
} from 'discord.js';

import { config, getChannelEntry } from './utils/config.js';
import {
  allowUserApprovalChannelPermisson,
  denyUserApprovalChannelPermisson,
  isApprovalChannel,
  setApprovalWaitChannel,
} from './voiceApproval.js';
import {
  allowCreateUserPermisson,
  allowUserPermisson,
  getDenyOverwrites,
  getOwnCategoryPermission,
} from './voiceBlackList.js';

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
const userListMenu: ActionRowBuilder<UserSelectMenuBuilder> =
  new ActionRowBuilder<UserSelectMenuBuilder>().setComponents(
    new UserSelectMenuBuilder()
      .setCustomId('userListMenu')
      .setPlaceholder('操作するユーザーを選択')
      .setMaxValues(10)
      .setMinValues(1),
  );
/**
 * 部屋操作系ボタンの行
 */
const roomButtonRow: ActionRowBuilder<ButtonBuilder> =
  new ActionRowBuilder<ButtonBuilder>().setComponents(
    // 許可制VCをON/OFFするためのボタン
    new ButtonBuilder()
      .setCustomId('roomToggleApproval')
      .setLabel('許可制VC ON/OFF')
      .setEmoji({
        name: '🔒',
      })
      .setStyle(ButtonStyle.Primary),
    // 許可制VCをON/OFFするためのボタン
    new ButtonBuilder()
      .setCustomId('roomLimitPeople')
      .setLabel('人数制限')
      .setEmoji({
        name: '🛡️',
      })
      .setStyle(ButtonStyle.Primary),
    // 許可制VCをON/OFFするためのボタン
    new ButtonBuilder()
      .setCustomId('roomTransferOwnership')
      .setLabel('オーナー譲渡')
      .setEmoji({
        name: '👑',
      })
      .setStyle(ButtonStyle.Primary),
  );

/**
 * ユーザー操作系ボタンの行
 */
const userButtonMenu1: ActionRowBuilder<ButtonBuilder> =
  new ActionRowBuilder<ButtonBuilder>().setComponents(
    // ブロックユーザー確認ボタン
    new ButtonBuilder()
      .setCustomId('userShowBlackList')
      .setLabel('ブロック確認')
      .setEmoji({
        name: '📝',
      })
      .setStyle(ButtonStyle.Success),
    // ブロックボタン
    new ButtonBuilder()
      .setCustomId('userBlock')
      .setLabel('ブロック')
      .setEmoji({
        name: '🙅‍♀️',
      })
      .setStyle(ButtonStyle.Success),
    // ブロックユーザー解除ボタン
    new ButtonBuilder()
      .setCustomId('userUnblock')
      .setLabel('ブロック解除')
      .setEmoji({
        name: '🙆‍♀️',
      })
      .setStyle(ButtonStyle.Success),
  );

/**
 * ユーザー操作系ボタンの行
 */
const userButtonMenu2: ActionRowBuilder<ButtonBuilder> =
  new ActionRowBuilder<ButtonBuilder>().setComponents(
    // ユーザーキックボタン
    new ButtonBuilder()
      .setCustomId('userKick')
      .setLabel('キック')
      .setEmoji({
        name: '🦶',
      })
      .setStyle(ButtonStyle.Success),
    // ユーザーミュートボタン
    new ButtonBuilder()
      .setCustomId('userMute')
      .setLabel('ミュート')
      .setEmoji({
        name: '🔇',
      })
      .setStyle(ButtonStyle.Success),
    // ユーザーミュート解除ボタン
    new ButtonBuilder()
      .setCustomId('userUnmute')
      .setLabel('ミュート解除')
      .setEmoji({
        name: '🔊',
      })
      .setStyle(ButtonStyle.Success),
  );

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
 * 人数制限の変更を行う際のモーダル
 */
export const changePeopleLimitedModal: ModalBuilder = new ModalBuilder()
  .setCustomId('dialogChangePeopleLimit')
  .setTitle('人数制限の変更');
/**
 * 人数制限の変更を行う際のテキストボックス
 */
const changePeopleLimitedInput: TextInputBuilder = new TextInputBuilder()
  .setMaxLength(2)
  .setMinLength(1)
  .setCustomId('dialogInputPeopleLimit')
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
export const transferOwnershipEmbed: EmbedBuilder = new EmbedBuilder()
  .setColor(parseInt(config.botColor.replace('#', ''), 16))
  .setTitle('VCのオーナーの変更')
  .setDescription(
    '他の人にVCの管理権限を渡します\n設定を行いたい場合、下のメニューから設定を行ってください。',
  );
/**
 * 譲渡するユーザーを選択するためのセレクトメニュー
 */
export const transferOwnershipMenu: ActionRowBuilder<UserSelectMenuBuilder> =
  new ActionRowBuilder<UserSelectMenuBuilder>().setComponents(
    new UserSelectMenuBuilder()
      .setCustomId('dialogTransferOwnership')
      .setPlaceholder('VCの管理権限を譲渡するユーザーを選択')
      .setMaxValues(1)
      .setMinValues(1),
  );

/**
 * VCコントローラーで用いるインタラクションの型
 */
export type MenuInteraction =
  | MessageComponentInteraction
  | ModalSubmitInteraction;

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
        roomButtonRow,
        userListMenu,
        userButtonMenu1,
        userButtonMenu2,
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
    const approvedOverwrites: OverwriteResolvable[] = [
      ...channel.permissionOverwrites.cache.values(),
    ].filter((permission) =>
      permission.allow.has(allowUserApprovalChannelPermisson),
    );

    // 既に参加しているユーザーを許可
    for (const member of channel.members.values()) {
      approvedOverwrites.push({
        id: member.id,
        allow: [allowUserPermisson],
      });
    }

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
      permissionOverwrites: inheritOverwrites,
    });

    // 参加待ちチャンネルを削除
    await setApprovalWaitChannel(channel, [], false);
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
  const member = await fetchInteractionMember(interaction);
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

/**
 * インタラクションを実行したメンバーを取得
 * @param interaction インタラクション
 * @returns メンバー
 */
export async function fetchInteractionMember(
  interaction: MenuInteraction,
): Promise<GuildMember | undefined> {
  return (
    (await interaction.guild?.members.fetch(interaction.user)) ?? undefined
  );
}
