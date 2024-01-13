import {
  Interaction,
  PermissionsBitField,
  VoiceBasedChannel,
} from 'discord.js';
import {
  MenuInteraction,
  editChannelPermission,
  getChannelOwner,
  onOperationMenu,
  prisma,
  showBlackList,
  transferedOwnershipEmbed,
  updateControlPanel,
} from './voiceController.js';
import { config } from './utils/config.js';

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
      !interaction.isUserSelectMenu() &&
      !interaction.isButton()
    ) {
      return;
    }

    switch (interaction.customId) {
      // -----------------------------------------------------------------------------------------------------------
      // チャンネルの設定
      // -----------------------------------------------------------------------------------------------------------
      case 'operationMenu': {
        if (!interaction.isStringSelectMenu()) return;

        // 入っているVCのチャンネルを取得し、権限チェックを行う
        const channel = await getConnectedEditableChannel(
          interaction,
          true,
        ).catch(async (error: Error) => {
          // エラーが発生した場合、エラーメッセージを返信して処理を終了
          await interaction.reply({
            content: error.message,
            ephemeral: true,
          });
        });
        if (!channel) return;

        // メニューの操作に応じて処理を分岐
        const operationPage = interaction.values[0];
        await onOperationMenu(interaction, operationPage);
        break;
      }

      // -----------------------------------------------------------------------------------------------------------
      // 人数制限の変更
      // -----------------------------------------------------------------------------------------------------------
      case 'changePeopleLimitedModal': {
        if (!interaction.isModalSubmit()) return;

        const channelUserLimit = Number(
          interaction.fields.getTextInputValue('changePeopleLimitedInput'),
        );
        if (Number.isNaN(channelUserLimit)) {
          await interaction.reply({
            content: '数字を入れてください',
            ephemeral: true,
          });
          return;
        }
        if (channelUserLimit > 99) {
          await interaction.reply({
            content: '変更できる人数制限の値は0~99人までです',
            ephemeral: true,
          });
          return;
        }

        // 入っているVCのチャンネルを取得し、権限チェックを行う
        const channel = await getConnectedEditableChannel(interaction).catch(
          async (error: Error) => {
            // エラーが発生した場合、エラーメッセージを返信して処理を終了
            await interaction.reply({
              content: error.message,
              ephemeral: true,
            });
          },
        );
        if (!channel) return;

        await interaction.deferReply({ ephemeral: true });

        // チャンネルの人数制限を変更
        await channel.setUserLimit(channelUserLimit);
        await updateControlPanel();
        await interaction.editReply({
          content: `チャンネルの人数制限を${channelUserLimit}人に変更しました`,
        });

        break;
      }

      // -----------------------------------------------------------------------------------------------------------
      // VCの譲渡
      // -----------------------------------------------------------------------------------------------------------
      case 'transferOwnership': {
        if (!interaction.isUserSelectMenu()) return;

        // 譲渡先のユーザーを取得
        const newOwnerId: string = String(interaction.values[0]);
        const newOwner = await interaction.guild?.members.fetch(newOwnerId);
        if (!newOwner) {
          await interaction.reply({
            content: 'ユーザーが見つかりませんでした',
            ephemeral: true,
          });
          return;
        }
        // 譲渡先がBotでないか確認
        if (newOwner.user.bot) {
          await interaction.reply({
            content: 'Botをオーナーにすることはできません',
            ephemeral: true,
          });
          return;
        }

        // 入っているVCのチャンネルを取得し、権限チェックを行う
        const channel = await getConnectedEditableChannel(
          interaction,
          true,
        ).catch(async (error: Error) => {
          // エラーが発生した場合、エラーメッセージを返信して処理を終了
          await interaction.reply({
            content: error.message,
            ephemeral: true,
          });
        });
        if (!channel) return;

        // 譲渡先が自分自身の場合かつ、オーナーが既に自分の場合
        if (
          newOwner.id === interaction.user.id &&
          newOwner === getChannelOwner(channel)
        ) {
          await interaction.reply({
            content: '既にあなたがオーナーです',
            ephemeral: true,
          });
          return;
        }

        // 譲渡先のユーザーがVCに入っているか確認
        if (newOwner.voice.channelId !== channel.id) {
          await interaction.reply({
            content: '譲渡先のユーザーが同じVCに入っていません',
            ephemeral: true,
          });
          return;
        }

        await interaction.deferReply({ ephemeral: true });

        // チャンネルのオーナーを変更
        await editChannelPermission(channel, newOwner.user);
        await updateControlPanel();

        // メッセージを投稿
        await channel.send({
          content: `<@${newOwner.id}>`,
          embeds: [transferedOwnershipEmbed(newOwner.user)],
        });

        // リプライを送信
        await interaction.editReply({
          content: `<@${newOwner.id}> にVCのオーナーを譲渡しました`,
        });

        break;
      }

      // -----------------------------------------------------------------------------------------------------------
      // ユーザーをブロックする処理
      // -----------------------------------------------------------------------------------------------------------
      case 'userBlackList': {
        if (!interaction.isUserSelectMenu()) return;

        await interaction.deferReply({ ephemeral: true });

        const userId: string = String(interaction.user.id);
        const selectedMemberNum = interaction.values.length;

        // ブロックしたユーザーを取得
        const allUsers = await prisma.blackLists.findMany({
          where: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            user_id: String(interaction.user.id),
          },
        });

        // ブロック処理
        const alreadyBlockedUsers: string[] = [];
        const privilegedUsers: string[] = [];
        for (let i = 0; i < selectedMemberNum; i++) {
          const blockUserId: string = String(interaction.values[i]);
          // Prismaを使ってBlackListsテーブルにレコードを作成
          if (
            allUsers.find((user) => String(user.block_user_id) === blockUserId)
          ) {
            alreadyBlockedUsers.push(blockUserId);
          } else if (await validatePrivilegedUser(interaction, blockUserId)) {
            privilegedUsers.push(blockUserId);
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

        // チャンネルの権限を更新
        const channel = await getConnectedEditableChannel(interaction).catch();
        if (channel) {
          await editChannelPermission(channel, interaction.user);
        }

        // リプライを送信
        const blockedUserNum =
          selectedMemberNum -
          privilegedUsers.length -
          alreadyBlockedUsers.length;
        let replyMessage = `選択した${selectedMemberNum}人${
          selectedMemberNum === blockedUserNum ? '' : `の内${blockedUserNum}人`
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
        break;
      }

      // -----------------------------------------------------------------------------------------------------------
      // ユーザーのブロックを解除する処理
      // -----------------------------------------------------------------------------------------------------------
      case 'userBlackReleaseList': {
        if (!interaction.isUserSelectMenu()) return;

        await interaction.deferReply({ ephemeral: true });

        // ブロックしたユーザーを取得
        const userId: string = String(interaction.user.id);
        const allUsers = await prisma.blackLists.findMany({
          where: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            user_id: String(interaction.user.id),
          },
        });
        // ブロック解除処理
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

        // チャンネルの権限を更新
        const channel = await getConnectedEditableChannel(interaction).catch();
        if (channel) {
          await editChannelPermission(channel, interaction.user);
        }

        // リプライを送信
        await interaction.editReply({
          content: '選択したユーザーのブロック解除が完了しました',
        });
        break;
      }

      // -----------------------------------------------------------------------------------------------------------
      // ブロックしているユーザーを確認する処理
      // -----------------------------------------------------------------------------------------------------------
      case 'showBlackList': {
        if (!interaction.isButton()) return;

        await showBlackList(interaction, interaction.user);
        break;
      }
    }
  } catch (error) {
    console.log(error);
  }
}

/**
 * ブロックするユーザーの特権チェックを行う。
 * @param interaction インタラクション
 * @param blockUserId ブロックするユーザーのID
 * @returns 特権があればtrue、なければfalse
 */
async function validatePrivilegedUser(
  interaction: MenuInteraction,
  blockUserId: string,
): Promise<boolean> {
  // 自身のIDを取得
  const userId: string = String(interaction.user.id);
  // メンバーを取得
  const member = await interaction.guild?.members.fetch(blockUserId);
  // ブロックするユーザーが自分自身か、ブロックするユーザーがVC移動権限を持っているか確認
  return (
    blockUserId === userId ||
    member?.permissions.has(PermissionsBitField.Flags.MoveMembers) === true
  );
}

/**
 * 入っている管理権限のあるVCのチャンネルを取得 (権限チェックも行う)
 * @param interaction インタラクション
 * @param isTransferOwnership オーナー譲渡中かどうか (オーナー譲渡中はオーナーが居ない場合に権限チェックを行わない)
 * @returns チャンネル
 */
async function getConnectedEditableChannel(
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
      `VCに入っていないため、<#${interaction.channelId}>のパネルは使用できません。\nカスタムVCのチャンネルに入ってからもう一度実行してください`,
    );
  }
  // カスタムVCのチャンネルでない場合、例外をthrowする
  if (!config.customVcChannelIdList.includes(channel.id)) {
    throw new Error(
      `カスタムVCのチャンネルでないため、<#${interaction.channelId}>のパネルは使用できません\nカスタムVCのチャンネルに入ってからもう一度実行してください`,
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
