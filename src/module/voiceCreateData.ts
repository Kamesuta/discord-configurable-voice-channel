import {
  ActionRowBuilder,
  EmbedBuilder,
  PermissionsBitField,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
} from 'discord.js';
import { config } from '../utils/config.js';

/**
 * ボイスチャンネルを作成時に送る埋め込みメッセージ
 */
export const createChannelEmbed: EmbedBuilder = new EmbedBuilder()
  .setColor(parseInt(config.botColor.replace('#', ''), 16))
  .setTitle('ボイスチャンネルを作成しました。')
  .setDescription('設定を行いたい場合、下のメニューから設定を行ってください。');

/**
 * ボイスチャンネルの設定時に送る埋め込みメッセージ
 */
export const settingChannelEmbed: EmbedBuilder = new EmbedBuilder()
  .setColor(parseInt(config.botColor.replace('#', ''), 16))
  .setTitle('ボイスチャンネルの設定')
  .setDescription(
    '二段階認証をしている場合、手動でチャンネルの設定やボイスチャットメンバーへのミュートなどが行えます。\n二段階認証していない場合、BOTからチャンネルの設定を行う事が出来ます\n※引き継がれるのはブロックしているユーザー・ロールのみです。チャンネル名などは引き継がれません。',
  );

/**
 * ブロックするユーザーを選択するためのセレクトメニュー
 */
export const userBlackListMenu: ActionRowBuilder<UserSelectMenuBuilder> =
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
export const userBlackReleaseListMenu: ActionRowBuilder<UserSelectMenuBuilder> =
  new ActionRowBuilder<UserSelectMenuBuilder>().setComponents(
    new UserSelectMenuBuilder()
      .setCustomId('userBlackReleaseList')
      .setPlaceholder('ブロックを解除するユーザーを選択')
      .setMaxValues(10)
      .setMinValues(1),
  );

/**
 * 設定を選択するためのセレクトメニュー
 */
export const operationMenu: ActionRowBuilder<StringSelectMenuBuilder> =
  new ActionRowBuilder<StringSelectMenuBuilder>().setComponents(
    new StringSelectMenuBuilder()
      .setCustomId('operationMenu')
      .setPlaceholder('チャンネルの設定')
      .setMaxValues(1)
      .setMinValues(1)
      .addOptions(
        {
          label: '名前',
          description: 'チャンネルの名前を変更できます',
          value: 'name_change',
        },
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
 * ボイスチャンネルのID
 */
export const voiceChannelId: string = config.voiceChannelId;

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
  PermissionsBitField.Flags.MuteMembers, // メンバーをミュート
  PermissionsBitField.Flags.DeafenMembers, // メンバーをスピーカーミュート
  PermissionsBitField.Flags.ManageMessages, // メッセージの管理
  PermissionsBitField.Flags.ManageChannels, // チャンネルの管理
];

/**
 * ボイスチャンネルを使用させなくさせるための権限
 */
export const denyUserPermisson: bigint[] = [
  PermissionsBitField.Flags.ViewChannel, // チャンネルを見る
];
