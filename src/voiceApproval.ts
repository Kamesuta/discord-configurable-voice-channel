import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  GuildMember,
  Message,
  OverwriteResolvable,
  PermissionsBitField,
  User,
  VoiceBasedChannel,
} from 'discord.js';

import { config, getChannelEntry } from './utils/config.js';
import {
  denyUserPermisson,
  editBlockUsers,
  getCategoryRolePermission,
} from './voiceBlackList.js';
import {
  editChannelPermission,
  fetchInteractionMember,
  getConnectedEditableChannel,
  MenuInteraction,
  prisma,
} from './voiceController.js';

import { client } from './index.js';

/**
 * 許可制VCの許可された人の権限
 */
export const allowUserApprovalChannelPermisson: bigint[] = [
  PermissionsBitField.Flags.Connect, // 接続
];

/**
 * 許可制VCのデフォルト権限
 */
export const denyUserApprovalChannelPermisson: bigint[] = [
  PermissionsBitField.Flags.Connect, // 接続
];

/**
 * 許可制VCのデフォルト権限
 */
export const denyUserWaitChannelPermisson: bigint[] = [
  PermissionsBitField.Flags.Speak, // 話す
  PermissionsBitField.Flags.SendMessages, // メッセージを送信
];

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
      enabled
        ? '許可制VCがONになりました\n「↓ 参加待機」VCに入るとリクエスト通知が来ます'
        : '許可制VCがOFFになりました',
    );

/**
 * Tips (Embed識別用)
 */
export const approvalRequestTips =
  '(Tips) 一度許可した後でも「拒否」ボタンでキックできます';

/**
 * 待機VCに入った際の埋め込みメッセージ
 * @param request リクエストしたユーザー
 * @param done リクエストが完了したかどうか
 * @returns 埋め込みメッセージ
 */
export const approvalRequestEmbed = (
  request: User,
  done: boolean,
): EmbedBuilder =>
  new EmbedBuilder()
    .setColor(parseInt(config.botColor.replace('#', ''), 16))
    .setDescription(
      `${done ? '✅️' : '➡️'} <@${
        request.id
      }> さんが参加をリクエストしています${done ? ' (許可済み)' : ''}`,
    )
    .setFooter({
      text: approvalRequestTips,
    });

/**
 * リクエストのボタンの行
 */
export const approvalRequestButtonRow: ActionRowBuilder<ButtonBuilder> =
  new ActionRowBuilder<ButtonBuilder>().setComponents(
    // 許可ボタン
    new ButtonBuilder()
      .setCustomId('requestApprove')
      .setLabel('許可')
      .setEmoji({
        name: '✅',
      })
      .setStyle(ButtonStyle.Success),
    // 拒否ボタン
    new ButtonBuilder()
      .setCustomId('requestReject')
      .setLabel('拒否')
      .setEmoji({
        name: '❌',
      })
      .setStyle(ButtonStyle.Primary),
    // ブロックボタン
    new ButtonBuilder()
      .setCustomId('requestBlock')
      .setLabel('ブロック')
      .setEmoji({
        name: '🚫',
      })
      .setStyle(ButtonStyle.Secondary),
  );

/**
 * 許可制VCかどうかを判定する
 * @param channel チャンネル
 * @returns 許可制VCかどうか
 */
export function isApprovalChannel(channel: VoiceBasedChannel): boolean {
  const everyonePermission = channel.permissionsFor(
    channel.guild.roles.everyone,
  );
  return !everyonePermission.has(PermissionsBitField.Flags.Connect);
}

/**
 * 参加待ちチャンネルを作成/削除する
 * @param channel チャンネル
 * @param blockedUsers ブロックされているユーザー
 * @param approval 許可制VCかどうか
 */
export async function setApprovalWaitChannel(
  channel: VoiceBasedChannel,
  blockedUsers: OverwriteResolvable[] = [],
  approval: boolean,
): Promise<void> {
  // VCに紐づけされた参加待ちチャンネルを取得
  const room = await prisma.roomLists.findUnique({
    where: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      channel_id: String(channel.id),
    },
  });

  // 参加待ちチャンネルが存在しない場合、作成
  const waitChannelId = room?.wait_channel_id;
  const waitChannel = waitChannelId
    ? await channel.guild.channels.fetch(waitChannelId).catch(() => null)
    : null;

  // ブロックされたユーザーの権限
  const blockedUserPermissions = blockedUsers.map((user) => ({
    id: user.id,
    deny: [denyUserPermisson],
  }));

  if (approval) {
    // 親カテゴリから継承した権限を取得
    const inheritOverwrites = getCategoryRolePermission(channel);

    if (waitChannel) {
      if (waitChannel.isVoiceBased()) {
        // 既に参加待ちチャンネルが存在する場合、権限を更新
        await waitChannel.permissionOverwrites.set([
          ...inheritOverwrites,
          ...blockedUserPermissions,
        ]);

        // 既にブロックされたユーザーがいる場合、キック
        const blockedConnectedMembers = channel.members.filter((member) =>
          blockedUsers.find((user) => member.id === user.id),
        );
        for (const [_, member] of blockedConnectedMembers) {
          await member.voice.disconnect();
        }
      }
    } else {
      // 許可制VCをONにした場合、参加待ちチャンネルを作成

      // 参加待ちチャンネルを作成
      const newWaitChannel = await channel.guild.channels.create({
        type: ChannelType.GuildVoice,
        name: '↓ 参加待機',
        parent: channel.parent,
        position: channel.rawPosition - 1, // 本VCの上に配置
      });

      // 参加待ちチャンネルに権限を設定
      // ※一度チャンネルを作成してから権限を設定しないとエラーが発生するため注意
      await newWaitChannel.permissionOverwrites.set([
        ...inheritOverwrites,
        ...blockedUserPermissions,
        {
          // デフォルト権限
          id: channel.guild.roles.everyone,
          deny: [denyUserWaitChannelPermisson],
        },
      ]);

      // チャンネルに紐づけ
      await prisma.roomLists.upsert({
        /* eslint-disable @typescript-eslint/naming-convention */
        where: {
          channel_id: String(channel.id),
        },
        create: {
          channel_id: String(channel.id),
          wait_channel_id: String(newWaitChannel.id),
        },
        update: {
          wait_channel_id: String(newWaitChannel.id),
        },
        /* eslint-enable @typescript-eslint/naming-convention */
      });
    }
  } else if (!approval && waitChannel) {
    // 許可制VCをOFFにした場合、参加待ちチャンネルを削除

    await waitChannel.delete();
    await prisma.roomLists.update({
      /* eslint-disable @typescript-eslint/naming-convention */
      where: {
        channel_id: String(channel.id),
      },
      data: {
        wait_channel_id: null,
      },
      /* eslint-enable @typescript-eslint/naming-convention */
    });
  }
}

/**
 * 許可リクエストのEmbedか判定
 * @param message メッセージ
 * @returns 許可リクエストのEmbedかどうか
 */
export function isApprovalRequestEmbed(message: Message): boolean {
  return message.embeds[0]?.data.footer?.text === approvalRequestTips;
}

/**
 * Embedに含まれるユーザーを取得
 * @param message メッセージ
 * @returns ユーザー
 */
export function getUserFromApprovalRequestEmbed(
  message: Message,
): User | undefined {
  // 許可リクエストのEmbedか判定
  if (!isApprovalRequestEmbed(message)) return;

  // 説明文に含まれるメンションからユーザーを取得
  const requestUserId =
    message.embeds[0]?.data.description?.match(/<@!?(\d+)>/);
  if (!requestUserId) return;

  return client.users.resolve(requestUserId[1]) ?? undefined;
}

/**
 * 待機VCに関連付けられたVCを取得
 * @param approvalChannel 待機VC
 * @returns 関連付けられたVC
 */
export async function getApprovalRelatedVoiceChannel(
  approvalChannel: VoiceBasedChannel,
): Promise<VoiceBasedChannel | undefined> {
  // 待機VCの情報を取得
  const room = await prisma.roomLists.findFirst({
    where: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      wait_channel_id: approvalChannel.id,
    },
  });

  // 待機VCじゃない場合は処理を終了
  if (!room) return;

  // 待機VCに関連付けられたVCを取得
  const channel = await client.channels.fetch(room.channel_id);
  if (!channel || !channel.isVoiceBased()) return; // ボイスチャンネルが取得できない場合は処理を終了

  return channel;
}

/**
 * 許可制VCをON/OFF
 * @param interaction インタラクション
 */
export async function toggleApproval(
  interaction: MenuInteraction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  // 権限を設定
  // チャンネルの権限を更新
  const channel = await getConnectedEditableChannel(interaction).catch(
    async (error: Error) => {
      // エラーが発生した場合、エラーメッセージを返信して処理を終了
      await interaction.editReply({
        content: error.message,
      });
    },
  );
  if (!channel) return;

  // 許可制VCかどうか
  const approval = channel ? !isApprovalChannel(channel) : false;
  // 許可制VCかどうかを切り替え
  await editChannelPermission(channel, {
    approval,
    // 既に参加しているユーザーは許可する
    memberPermssions: [...channel.members.values()].map((member) => ({
      id: member.id,
      approve: true,
    })),
  });

  // リプライを送信
  await interaction.editReply({
    embeds: [toggleApprovalEmbed(approval)],
  });
}

/**
 * 許可する
 * @param interaction インタラクション
 */
export async function approveRequest(
  interaction: ButtonInteraction,
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  // 入っているVCのチャンネルを取得し、権限チェックを行う
  const channel = await getConnectedEditableChannel(interaction, true).catch(
    async (error: Error) => {
      // エラーが発生した場合、エラーメッセージを返信して処理を終了
      await interaction.reply({
        content: error.message,
        ephemeral: true,
      });
    },
  );
  if (!channel) return;

  // 許可リクエストを送った人を取得
  const requestUser = getUserFromApprovalRequestEmbed(interaction.message);
  const requestMember = !requestUser
    ? undefined
    : await interaction.guild?.members.fetch(requestUser);
  if (!requestMember) {
    await interaction.editReply({
      content: '許可リクエストを送ったユーザーが見つかりませんでした',
    });
    return;
  }

  // 許可リクエストを送った人が待機VCにいるか確認
  const voiceChannel = !requestMember.voice.channel
    ? undefined
    : await getApprovalRelatedVoiceChannel(requestMember.voice.channel);
  if (!voiceChannel || voiceChannel.id !== channel.id) {
    await interaction.editReply({
      content: '許可リクエストを送ったユーザーが待機VCにいませんでした',
    });
    return;
  }

  // 許可リクエストを送った人を許可リストに追加
  await editChannelPermission(channel, {
    memberPermssions: [
      {
        id: requestMember.id,
        approve: true,
      },
    ],
  });
  // VCを移動
  await requestMember.voice.setChannel(channel);

  // リプライを送信
  await interaction.editReply({
    content: `<@${requestMember.id}> を許可しました`,
    allowedMentions: { users: [] }, // メンションを抑制
  });
}

/**
 * 拒否する
 * @param interaction インタラクション
 * @param isBlock ブロックするかどうか
 */
export async function rejectRequest(
  interaction: ButtonInteraction,
  isBlock = false,
): Promise<void> {
  const member = await fetchInteractionMember(interaction);
  if (!member) return;

  await interaction.deferReply({ ephemeral: true });

  // 入っているVCのチャンネルを取得し、権限チェックを行う
  const channel = await getConnectedEditableChannel(interaction, true).catch(
    async (error: Error) => {
      // エラーが発生した場合、エラーメッセージを返信して処理を終了
      await interaction.reply({
        content: error.message,
        ephemeral: true,
      });
    },
  );
  if (!channel) return;

  // 許可リクエストを送った人を取得
  const requestUser = getUserFromApprovalRequestEmbed(interaction.message);
  const requestMember = !requestUser
    ? undefined
    : await interaction.guild?.members.fetch(requestUser);
  if (!requestMember) {
    await interaction.editReply({
      content: '許可リクエストを送ったユーザーが見つかりませんでした',
    });
    return;
  }

  // 本VC or 待機VCを取得
  const voiceChannel =
    await getChannelIfUserInVoiceChannelOrWaitChannel(requestMember);
  // リクエストを送った人が本VC or 待機VCにいる場合キック
  if (voiceChannel?.id === channel.id) {
    // キック
    await requestMember.voice.disconnect();
  }

  // ついでにブロックする場合
  if (isBlock) {
    // ブロックする
    await editBlockUsers(member, [requestMember.id], []);
  }

  // チャンネル設定変更
  // 許可リクエストを送った人を許可リストから削除 & ブロックリスト反映
  await editChannelPermission(channel, {
    memberPermssions: [
      {
        id: requestMember.id,
        approve: false,
      },
    ],
  });

  // リプライを送信
  await interaction.editReply({
    content: `<@${requestMember.id}> を${
      isBlock ? 'ブロック' : '拒否'
    }しました`,
    allowedMentions: { users: [] }, // メンションを抑制
  });
}

/**
 * メンバーが本VCか待機VCにいる場合、VCを取得
 * @param requestMember メンバー
 * @returns 本VC or 待機VC
 */
async function getChannelIfUserInVoiceChannelOrWaitChannel(
  requestMember: GuildMember,
): Promise<VoiceBasedChannel | undefined> {
  // 待機VC or VCにいるか確認
  const waitChannel = requestMember.voice.channel;
  if (!waitChannel) return;

  // 本VCにいるか確認
  if (getChannelEntry(waitChannel.id)) return waitChannel;

  // 待機VCにいるか確認
  const voiceChannel = await getApprovalRelatedVoiceChannel(waitChannel);
  if (!voiceChannel) return;

  return voiceChannel;
}
