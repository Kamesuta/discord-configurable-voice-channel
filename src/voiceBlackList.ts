import {
  EmbedBuilder,
  GuildMember,
  MessageComponentInteraction,
  OverwriteResolvable,
  PermissionsBitField,
  User,
  VoiceBasedChannel,
} from 'discord.js';

import { config } from './utils/config.js';
import {
  prisma,
  getConnectedEditableChannel,
  editChannelPermission,
  MenuInteraction,
  fetchInteractionMember,
} from './voiceController.js';

import { client } from './index.js';

/**
 * ボイスチャンネルを使用するユーザーの権限
 */
export const allowUserPermisson: bigint[] = [
  PermissionsBitField.Flags.ViewChannel, // チャンネルを見る
];

/**
 * ボイスチャンネルを作成したユーザーの追加管理権限
 */
export const allowCreateUserPermisson: bigint[] = [
  PermissionsBitField.Flags.PrioritySpeaker, // 優先スピーカー
  PermissionsBitField.Flags.Connect, // 接続
];

/**
 * ボイスチャンネルを使用させなくさせるための権限
 */
export const denyUserPermisson: bigint[] = [
  PermissionsBitField.Flags.ViewChannel, // チャンネルを見る
];

/**
 * ミュートユーザーの権限
 */
export const denyMutedUserPermisson: bigint[] = [
  PermissionsBitField.Flags.Speak, // 発言
];

/**
 * ブロックしているユーザーを表示する際の埋め込みメッセージ
 */
const showBlackListEmbed: EmbedBuilder = new EmbedBuilder()
  .setColor(parseInt(config.botColor.replace('#', ''), 16))
  .setTitle('ブロックしているユーザー');

/**
 * "チャンネルID:ユーザーID" -> 選択ユーザーIDリスト のマップ
 */
export const userListMenuSelect: { [key: string]: string[] } = {};

/**
 * ブロックする
 * @param interaction インタラクション
 */
export async function addUserToBlackList(
  interaction: MessageComponentInteraction,
): Promise<void> {
  // ユーザー選択リストを取得
  const selectedUserIds =
    userListMenuSelect[`${interaction.message.id}:${interaction.user.id}`];
  if (!selectedUserIds) {
    await interaction.reply({
      content: 'ユーザーが選択されていません。もう一度選択し直してください',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const member = await fetchInteractionMember(interaction);
  if (!member) return;

  // ブロックしたユーザーを取得
  const { privilegedUsers, alreadyBlockedUsers } = await editBlockUsers(
    member,
    selectedUserIds,
    [],
  );

  // チャンネルの権限を更新
  const channel = await getConnectedEditableChannel(interaction).catch(
    () => {},
  );
  if (channel) {
    // ブロック設定をチャンネルに反映
    await editChannelPermission(channel, {});
  }

  // リプライを送信
  const blockedUserNum =
    selectedUserIds.length -
    privilegedUsers.length -
    alreadyBlockedUsers.length;
  let replyMessage = `選択した${selectedUserIds.length}人${
    selectedUserIds.length === blockedUserNum ? '' : `の内${blockedUserNum}人`
  }のユーザーのブロックが完了しました。\n`;
  if (privilegedUsers.length > 0) {
    const errorUsersString = privilegedUsers
      .map((userId) => `<@${userId}>`)
      .join(', ');
    replyMessage += `${errorUsersString} はブロックできませんでした。\n`;
  }
  if (alreadyBlockedUsers.length > 0) {
    const errorUsersString = alreadyBlockedUsers
      .map((userId) => `<@${userId}>`)
      .join(', ');
    replyMessage += `${errorUsersString} は既にブロックされているためブロックできませんでした。\n`;
  }
  await interaction.editReply({
    content: replyMessage,
  });
}

/**
 * ブロック解除
 * @param interaction インタラクション
 */
export async function removeUserFromBlackList(
  interaction: MessageComponentInteraction,
): Promise<void> {
  // ユーザー選択リストを取得
  const selectedUserIds =
    userListMenuSelect[`${interaction.message.id}:${interaction.user.id}`];
  if (!selectedUserIds) {
    await interaction.reply({
      content: 'ユーザーが選択されていません。もう一度選択し直してください',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const member = await fetchInteractionMember(interaction);
  if (!member) return;

  // ブロックしたユーザーを取得
  await editBlockUsers(member, [], selectedUserIds);

  // チャンネルの権限を更新
  const channel = await getConnectedEditableChannel(interaction).catch(
    () => {},
  );
  if (channel) {
    // ブロック設定をチャンネルに反映
    await editChannelPermission(channel, {});
  }

  // リプライを送信
  await interaction.editReply({
    content: '選択したユーザーのブロック解除が完了しました',
  });
}

/**
 * ブロック/ブロック解除処理
 * @param ownerMember VCを作成したユーザー
 * @param blockUserIds ブロックするユーザーのID
 * @param unblockUserIds ブロック解除するユーザーのID
 * @returns 特権があるユーザー、既にブロックされているユーザー
 */
export async function editBlockUsers(
  ownerMember: GuildMember,
  blockUserIds: string[],
  unblockUserIds: string[],
): Promise<{
  privilegedUsers: string[];
  alreadyBlockedUsers: string[];
}> {
  const blockedUsers = await prisma.blackLists.findMany({
    where: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      user_id: String(ownerMember.user.id),
    },
  });

  // ブロック処理
  const alreadyBlockedUsers: string[] = [];
  const privilegedUsers: string[] = [];
  for (const selectedUserId of blockUserIds) {
    // Prismaを使ってBlackListsテーブルにレコードを作成
    if (
      blockedUsers.find((user) => String(user.block_user_id) === selectedUserId)
    ) {
      // 既にブロックしているユーザーの場合除外
      alreadyBlockedUsers.push(selectedUserId);
    } else if (await validatePrivilegedUser(ownerMember, selectedUserId)) {
      // 特権があるユーザーの場合除外
      privilegedUsers.push(selectedUserId);
    } else {
      // ブロック処理
      await prisma.blackLists.create({
        data: {
          /* eslint-disable @typescript-eslint/naming-convention */
          user_id: ownerMember.id,
          block_user_id: String(selectedUserId),
          /* eslint-enable @typescript-eslint/naming-convention */
        },
      });
    }
  }

  // ブロック解除処理
  for (const selectedUserId of unblockUserIds) {
    if (
      blockedUsers.find((user) => String(user.block_user_id) === selectedUserId)
    ) {
      // ブロックしているユーザーの場合、ブロック解除
      await prisma.blackLists.deleteMany({
        where: {
          /* eslint-disable @typescript-eslint/naming-convention */
          user_id: String(ownerMember.id),
          block_user_id: String(selectedUserId),
          /* eslint-enable @typescript-eslint/naming-convention */
        },
      });
    }
  }

  return { privilegedUsers, alreadyBlockedUsers };
}

/**
 * ユーザーをキックする
 * @param interaction インタラクション
 */
export async function kickUserFromChannel(
  interaction: MessageComponentInteraction,
): Promise<void> {
  // ユーザー選択リストを取得
  const selectedUserIds =
    userListMenuSelect[`${interaction.message.id}:${interaction.user.id}`];
  if (!selectedUserIds) {
    await interaction.reply({
      content: 'ユーザーが選択されていません。もう一度選択し直してください',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

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

  // ユーザーをキック
  for (const selectedUserId of selectedUserIds) {
    const member = interaction.guild?.members.resolve(selectedUserId);
    if (member) {
      // VCに入っている場合
      if (member.voice.channelId === channel.id) {
        // キック
        await member.voice.disconnect();
      }

      // 許可リクエストを送った人を許可リストから削除
      await editChannelPermission(channel, {
        memberPermssions: [
          {
            id: member.id,
            approve: false,
          },
        ],
      });
    }
  }

  // リプライを送信
  await interaction.editReply({
    content: '選択したユーザーをキックしました',
  });
}

/**
 * ユーザーをミュートする
 * @param interaction インタラクション
 */
export async function muteUserFromChannel(
  interaction: MessageComponentInteraction,
): Promise<void> {
  // ユーザー選択リストを取得
  const selectedUserIds =
    userListMenuSelect[`${interaction.message.id}:${interaction.user.id}`];
  if (!selectedUserIds) {
    await interaction.reply({
      content: 'ユーザーが選択されていません。もう一度選択し直してください',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

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

  // ユーザーをキック
  const selectedUsers = selectedUserIds
    .map((selectedUserId) => client.users.resolve(selectedUserId))
    .filter((user): user is User => user !== null);

  // ミュートする
  await editChannelPermission(channel, {
    memberPermssions: selectedUsers.map((user) => ({
      id: user.id,
      muted: true,
    })),
  });

  // リプライを送信
  await interaction.editReply({
    content: '選択したユーザーをミュートしました',
  });
}

/**
 * ユーザーのミュートを解除する
 * @param interaction インタラクション
 */
export async function unmuteUserFromChannel(
  interaction: MessageComponentInteraction,
): Promise<void> {
  // ユーザー選択リストを取得
  const selectedUserIds =
    userListMenuSelect[`${interaction.message.id}:${interaction.user.id}`];
  if (!selectedUserIds) {
    await interaction.reply({
      content: 'ユーザーが選択されていません。もう一度選択し直してください',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

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

  // ユーザーをアンミュート
  const selectedUsers = selectedUserIds
    .map((selectedUserId) => client.users.resolve(selectedUserId))
    .filter((user): user is User => user !== null);

  // アンミュートする
  await editChannelPermission(channel, {
    memberPermssions: selectedUsers.map((user) => ({
      id: user.id,
      muted: false,
    })),
  });

  // リプライを送信
  await interaction.editReply({
    content: '選択したユーザーのミュートを解除しました',
  });
}

/**
 * ブロックするユーザーの特権チェックを行う。
 * @param ownerMember VCを作成したユーザー
 * @param blockUserId ブロックするユーザーのID
 * @returns 特権があればtrue、なければfalse
 */
async function validatePrivilegedUser(
  ownerMember: GuildMember,
  blockUserId: string,
): Promise<boolean> {
  // 自身のIDを取得
  const userId: string = ownerMember.id;
  // メンバーを取得
  const member = await ownerMember.guild.members.fetch(blockUserId);
  // ブロックするユーザーが自分自身か、ブロックするユーザーがVC移動権限を持っているか確認
  return (
    blockUserId === userId ||
    member?.permissions.has(PermissionsBitField.Flags.MoveMembers) === true
  );
}

/**
 * ブロックしているユーザーがいた場合、チャンネルを表示しない
 * @param ownerUser ユーザー
 * @returns ブロックされているユーザーの権限
 */
export async function getBlockedUsers(ownerUser: User): Promise<User[]> {
  // ブロックしているユーザーを取得
  const allUsers = await prisma.blackLists.findMany({
    where: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      user_id: String(ownerUser.id),
    },
  });

  return await Promise.all(
    allUsers.map((user) => client.users.fetch(user.block_user_id)),
  );
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
