// 必要なパッケージをインポートする
import { Client, Events, GatewayIntentBits } from "discord.js";
import dotenv from "dotenv";

import { logger } from "./utils/log.js";
import { updateControlPanel } from "./voiceController.js";
import { onVoiceCreateInteraction } from "./voiceInteractionHandler.js";
import { onVoiceStateUpdate } from "./voiceStateHandler.js";
import { registerVoiceStatusHandler } from "./voiceStatusHandler.js";
import { nowait } from "./utils/utils.js";

// .envファイルを読み込む
dotenv.config();

/**
 * Discord Client
 */
export const client: Client = new Client({
  // Botで使うGetwayIntents、partials
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// -----------------------------------------------------------------------------------------------------------
// イベントハンドラーを登録する
// -----------------------------------------------------------------------------------------------------------
client.on(Events.InteractionCreate, nowait(onVoiceCreateInteraction));
client.on(Events.VoiceStateUpdate, nowait(onVoiceStateUpdate));
client.on(
  Events.ClientReady,
  nowait(async () => {
    logger.info(`${client.user?.username ?? "Unknown"} として起動しました!`);

    // VC操作パネルのメッセージを投稿する
    await updateControlPanel();
  }),
);
registerVoiceStatusHandler();

// Discordにログインする
await client.login(process.env.DISCORD_TOKEN);
