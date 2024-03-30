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
let statuses: Record<Snowflake, string | null> = {};

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
    // ステータスが変更されていなかったら処理を終了
    if (statuses[data.id] === data.status) return;

    // ステータスが変更されたら記録
    statuses[data.id] = data.status;

    // ステータスが変更されたチャンネルのIDリストを取得
    const channel = client.channels.cache.get(data.id);
    // カスタムVCのチャンネルでない場合は処理を終了
    if (
      !channel ||
      !channel.isVoiceBased() ||
      !config.customVcList.some((vc) => vc.channelId === channel.id)
    ) {
      return;
    }

    // VCが0人になった場合無視
    if (channel.members.size === 0) {
      return;
    }

    // ステータスが変更されたチャンネルのオーナーを更新
    void onVoiceStatusChange(channel, data.status);
  });

  // 全チャンネルのステータスを取得するハンドラーを登録
  client.ws.on(CHANNEL_STATUSES, (data: ChannelStatuses) => {
    statuses = Object.fromEntries(data.channels.map((c) => [c.id, c.status]));
  });

  // ボットが起動したとき、全ギルドのVCのステータスを取得する
  client.on('ready', () => {
    // 全ギルドを取得
    const guildIds = new Set(
      config.customVcList.flatMap((vc) => {
        const channel = client.channels.resolve(vc.channelId);
        if (!channel) return [];
        if (!channel.isVoiceBased()) return [];
        return channel.guildId;
      }),
    );

    // Gateway APIに対して、サーバーのすべてのVCのステータスを取得するリクエストを送信する
    for (const guildId of guildIds) {
      client.ws['broadcast']({
        op: CHANNEL_STATUS_REQUEST_OP_CODE,
        d: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          guild_id: guildId,
        },
      });
    }
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
    status = getVoiceStatus(channel);
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
export function getVoiceStatus(channel: VoiceBasedChannel): string | undefined {
  // ステータスの取得
  return statuses[channel.id] ?? undefined;
}

/**
 * ボイスチャンネルのステータスを設定する
 * @param channel チャンネル
 * @param status ステータス
 */
export async function setVoiceStatus(
  channel: VoiceBasedChannel,
  status: string | null,
): Promise<void> {
  // ステータスを更新
  statuses[channel.id] = status;

  // ステータスの更新
  await client.rest.put(`${Routes.channel(channel.id)}/voice-status`, {
    body: {
      status: status,
    },
  });
}
