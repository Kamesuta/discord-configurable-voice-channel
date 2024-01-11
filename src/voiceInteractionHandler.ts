import {
  Interaction,
  PermissionsBitField,
  VoiceBasedChannel,
} from 'discord.js';
import {
  MenuInteraction,
  editChannelPermission,
  onOperationMenu,
  prisma,
  showBlackList,
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
        const channel = await getConnectedEditableChannel(interaction);
        if (!channel) return;

        // メニューの操作に応じて処理を分岐
        const operationPage = interaction.values[0].split('_')[0];
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
        } else if (channelUserLimit > 99) {
          await interaction.reply({
            content: '変更できる人数制限の値は0~99人までです',
            ephemeral: true,
          });
        } else {
          await interaction.deferReply({ ephemeral: true });

          // 入っているVCのチャンネルを取得し、権限チェックを行う
          const channel = await getConnectedEditableChannel(interaction);
          if (!channel) return;

          // チャンネルの人数制限を変更
          await channel.setUserLimit(channelUserLimit);
          await updateControlPanel();
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

          // 入っているVCのチャンネルを取得し、権限チェックを行う
          const channel = await getConnectedEditableChannel(interaction);
          if (!channel) return;

          // チャンネルのビットレートを変更
          await channel.setBitrate(channelBitRate * 1000);
          await updateControlPanel();
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
        const channel = await getConnectedEditableChannel(interaction, false);
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
        const channel = await getConnectedEditableChannel(interaction, false);
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

        await showBlackList(interaction);
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
 * @param showError エラーを表示するかどうか
 * @returns チャンネル
 */
async function getConnectedEditableChannel(
  interaction: MenuInteraction,
  showError: boolean = true,
): Promise<VoiceBasedChannel | undefined> {
  // メンバーを取得
  const member = await interaction.guild?.members.fetch(interaction.user);
  if (!member) return undefined;
  // 入っているVCのチャンネルを取得
  const channel = member.voice.channel;
  if (!channel) {
    // VCに入っていない場合、リプライを送信して処理を終了
    if (showError) {
      await interaction.reply({
        content: `VCに入っていないため、<#${interaction.channelId}>のパネルは使用できません。\nカスタムVCのチャンネルに入ってからもう一度実行してください`,
        ephemeral: true,
      });
    }
    return undefined;
  }
  // カスタムVCのチャンネルでない場合、リプライを送信して処理を終了
  if (!config.customVcChannelIdList.includes(channel.id)) {
    if (showError) {
      await interaction.reply({
        content: `カスタムVCのチャンネルでないため、<#${interaction.channelId}>のパネルは使用できません\nカスタムVCのチャンネルに入ってからもう一度実行してください`,
        ephemeral: true,
      });
    }
    return undefined;
  }
  // チャンネルの権限を確認
  if (
    !channel
      .permissionsFor(interaction.user)
      ?.has(PermissionsBitField.Flags.PrioritySpeaker)
  ) {
    if (showError) {
      await interaction.reply({
        content: 'あなたにはチャンネルの設定をする権限がありません',
        ephemeral: true,
      });
    }
    return undefined;
  }

  return channel;
}
