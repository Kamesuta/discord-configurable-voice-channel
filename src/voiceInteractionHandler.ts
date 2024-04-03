import { Interaction } from 'discord.js';

import {
  toggleApproval,
  approveRequest,
  rejectRequest,
} from './voiceApproval.js';
import {
  addUserToBlackList,
  kickUserFromChannel,
  muteUserFromChannel,
  removeUserFromBlackList,
  showBlackList,
  unmuteUserFromChannel,
  userListMenuSelect,
} from './voiceBlackList.js';
import {
  changePeopleLimitedModal,
  editChannelPermission,
  getChannelOwner,
  getConnectedEditableChannel,
  transferedOwnershipEmbed,
  transferOwnershipEmbed,
  transferOwnershipMenu,
} from './voiceController.js';
import { onVoiceStatusChange } from './voiceStatusHandler.js';

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
      // 人数制限の変更
      // -----------------------------------------------------------------------------------------------------------
      case 'roomChangePeopleLimit': {
        if (!interaction.isButton()) return;

        // 人数制限
        await interaction.showModal(changePeopleLimitedModal);
        break;
      }

      // -----------------------------------------------------------------------------------------------------------
      // 人数制限の変更
      // -----------------------------------------------------------------------------------------------------------
      case 'dialogChangePeopleLimit': {
        if (!interaction.isModalSubmit()) return;

        const channelUserLimit = Number(
          interaction.fields.getTextInputValue('dialogInputPeopleLimit'),
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
        await interaction.editReply({
          content: `チャンネルの人数制限を${channelUserLimit}人に変更しました`,
        });

        break;
      }

      // -----------------------------------------------------------------------------------------------------------
      // VCのオーナーの変更
      // -----------------------------------------------------------------------------------------------------------
      case 'roomTransferOwnership': {
        if (!interaction.isButton()) return;

        // VCのオーナーの変更
        await interaction.reply({
          embeds: [transferOwnershipEmbed],
          components: [transferOwnershipMenu],
          ephemeral: true,
        });
        break;
      }

      // -----------------------------------------------------------------------------------------------------------
      // VCのオーナーの変更
      // -----------------------------------------------------------------------------------------------------------
      case 'dialogTransferOwnership': {
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
        await editChannelPermission(channel, {
          ownerUser: newOwner.user,
        });
        await onVoiceStatusChange(channel);

        // メッセージを投稿
        await channel.send({
          content: `<@${newOwner.id}> VCのオーナーが替わりました`,
          embeds: [transferedOwnershipEmbed(newOwner.user)],
        });

        // リプライを送信
        await interaction.editReply({
          content: `<@${newOwner.id}> にVCのオーナーを譲渡しました`,
        });

        break;
      }

      // -----------------------------------------------------------------------------------------------------------
      // ブロックしているユーザーを確認する処理
      // -----------------------------------------------------------------------------------------------------------
      case 'roomToggleApproval': {
        if (!interaction.isButton()) return;

        await toggleApproval(interaction);
        break;
      }

      // -----------------------------------------------------------------------------------------------------------
      // ユーザーリスト選択
      // -----------------------------------------------------------------------------------------------------------
      case 'userListMenu': {
        if (!interaction.isUserSelectMenu()) return;

        // 選択を保存
        userListMenuSelect[`${interaction.message.id}:${interaction.user.id}`] =
          interaction.values;

        // 何も反応しない
        await interaction.update({});
        break;
      }

      // -----------------------------------------------------------------------------------------------------------
      // ブロックしているユーザーを確認する処理
      // -----------------------------------------------------------------------------------------------------------
      case 'userShowBlackList': {
        if (!interaction.isButton()) return;

        await showBlackList(interaction, interaction.user);
        break;
      }

      // -----------------------------------------------------------------------------------------------------------
      // ユーザーをブロックする処理
      // -----------------------------------------------------------------------------------------------------------
      case 'userBlock': {
        if (!interaction.isButton()) return;

        await addUserToBlackList(interaction);
        break;
      }

      // -----------------------------------------------------------------------------------------------------------
      // ユーザーのブロックを解除する処理
      // -----------------------------------------------------------------------------------------------------------
      case 'userUnblock': {
        if (!interaction.isButton()) return;

        await removeUserFromBlackList(interaction);
        break;
      }

      // -----------------------------------------------------------------------------------------------------------
      // ユーザーをキックする処理
      // -----------------------------------------------------------------------------------------------------------
      case 'userKick': {
        if (!interaction.isButton()) return;

        await kickUserFromChannel(interaction);
        break;
      }

      // -----------------------------------------------------------------------------------------------------------
      // ユーザーをミュートする処理
      // -----------------------------------------------------------------------------------------------------------
      case 'userMute': {
        if (!interaction.isButton()) return;

        await muteUserFromChannel(interaction);
        break;
      }

      // -----------------------------------------------------------------------------------------------------------
      // ユーザーのミュートを解除する処理
      // -----------------------------------------------------------------------------------------------------------
      case 'userUnmute': {
        if (!interaction.isButton()) return;

        await unmuteUserFromChannel(interaction);
        break;
      }

      // -----------------------------------------------------------------------------------------------------------
      // 許可ボタンの処理
      // -----------------------------------------------------------------------------------------------------------
      case 'requestApprove': {
        if (!interaction.isButton()) return;

        await approveRequest(interaction);
        break;
      }

      // -----------------------------------------------------------------------------------------------------------
      // 拒否ボタンの処理
      // -----------------------------------------------------------------------------------------------------------
      case 'requestReject': {
        if (!interaction.isButton()) return;

        await rejectRequest(interaction);
        break;
      }

      // -----------------------------------------------------------------------------------------------------------
      // ブロックボタンの処理
      // -----------------------------------------------------------------------------------------------------------
      case 'requestBlock': {
        if (!interaction.isButton()) return;

        await rejectRequest(interaction, true);
        break;
      }
    }
  } catch (error) {
    console.log(error);
  }
}
