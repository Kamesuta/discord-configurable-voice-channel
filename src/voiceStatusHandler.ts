import {
  GatewayDispatchEvents,
  Routes,
  Snowflake,
  VoiceBasedChannel,
} from 'discord.js';

import { config } from './utils/config.js';
import { getChannelOwner } from './voiceController.js';

import { client } from './index.js';

// チャンネルのステータスのレスポンスイベント名
const VOICE_CHANNEL_STATUS_UPDATE =
  'VOICE_CHANNEL_STATUS_UPDATE' as GatewayDispatchEvents;
// チャンネルのステータスを取得するためのリクエストコード
const CHANNEL_STATUS_REQUEST_OP_CODE = 36;
// チャンネルのステータスのレスポンスイベント名
const CHANNEL_STATUSES = 'CHANNEL_STATUSES' as GatewayDispatchEvents;

/**
 * ボイスチャンネルのステータス
 */
interface VoiceChannelStatus {
  /** チャンネルのID */
  id: Snowflake;
  /** ステータスのID */
  status: string | null;
  // guild_id: Snowflake;
}

/**
 * すべてのボイスチャンネルのステータス
 */
interface ChannelStatuses {
  /** チャンネルのステータス */
  channels: VoiceChannelStatus[];
  // guild_id: Snowflake;
}

/**
 * ステータス変更時のイベントハンドラーを登録する
 */
export function registerVoiceStatusHandler(): void {
  client.ws.on(VOICE_CHANNEL_STATUS_UPDATE, (data: VoiceChannelStatus) => {
    // ステータスが変更されたチャンネルのIDリストを取得
    const channel = client.channels.cache.get(data.id);
    // カスタムVCのチャンネルでない場合は処理を終了
    if (
      !channel ||
      !config.customVcList.some((vc) => vc.channelId === channel.id)
    ) {
      return;
    }

    // ステータスがない場合、おそらくVCが解散されたときなので無視
    if (data.status === null) return;

    // ステータスが変更されたチャンネルのオーナーを更新
    void onVoiceStatusChange(channel as VoiceBasedChannel, data.status);
  });
}

/**
 * ボイスチャンネルのステータスが変更されたとき、ステータスにVCのオーナーを追加する
 * @param channel チャンネル
 * @param status ステータス
 * @param ownerName オーナーの名前
 */
export async function onVoiceStatusChange(
  channel: VoiceBasedChannel,
  status?: string | null,
  ownerName?: string,
): Promise<void> {
  // チャンネルオーナーを取得
  if (!ownerName) {
    const owner = getChannelOwner(channel);
    if (!owner) return;
    ownerName = owner.displayName;
  }

  // ステータスがundefinedの場合、ステータスを取得して処理を続行
  if (status === undefined) {
    status = await getVoiceStatus(channel);
  }

  // statusがnullまたは空の場合、オーナーだけをステータスに設定する
  if (!status) {
    await setVoiceStatus(channel, `(👑${ownerName})`);
    return;
  }

  // ステータスの最後にオーナーが含まれているか確認
  // (👑名前) のような名前が含まれるはず
  const statusPattern = /\(👑(.+)\)/;
  const match = status.match(statusPattern);
  if (match) {
    // オーナーが既に含まれている場合、オーナーの名前を更新する必要がない
    if (match[1] === ownerName) return;

    // オーナーの名前を更新する
    await setVoiceStatus(
      channel,
      status.replace(statusPattern, `(👑${ownerName})`),
    );
  } else {
    // ステータスにオーナーが含まれていない場合、追加する
    await setVoiceStatus(channel, `${status} (👑${ownerName})`);
  }
}

/**
 * ボイスチャンネルのステータスを取得する
 * @param channel チャンネル
 * @returns ステータス
 */
async function getVoiceStatus(
  channel: VoiceBasedChannel,
): Promise<string | undefined> {
  return new Promise((resolve) => {
    // リクエスト後にレスポンスメッセージが返ってくるため、一度だけ受信を行う
    client.ws.once(CHANNEL_STATUSES, (data: ChannelStatuses) => {
      resolve(
        data.channels.find((c) => c.id === channel.id)?.status ?? undefined,
      );
    });

    // Gateway APIに対して、サーバーのすべてのVCのステータスを取得するリクエストを送信する
    client.ws['broadcast']({
      op: CHANNEL_STATUS_REQUEST_OP_CODE,
      d: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        guild_id: channel.guild.id,
      },
    });
  });
}

/**
 * ボイスチャンネルのステータスを設定する
 * @param channel チャンネル
 * @param status ステータス
 */
async function setVoiceStatus(
  channel: VoiceBasedChannel,
  status: string,
): Promise<void> {
  // ステータスの更新
  await client.rest.put(`${Routes.channel(channel.id)}/voice-status`, {
    body: {
      status: status,
    },
  });
}
