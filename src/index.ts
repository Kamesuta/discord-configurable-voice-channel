// 必要なパッケージをインポートする
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import dotenv from 'dotenv';
import * as interactionCreate from './events/interactionCreate.js';
import * as voiceStateUpdate from './events/voiceStateUpdate.js';

// .envファイルを読み込む
dotenv.config();

// Botで使うGetwayIntents、partials
const client: Client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.Channel],
});

// -----------------------------------------------------------------------------------------------------------
// イベントハンドラーを登録する
// -----------------------------------------------------------------------------------------------------------
interactionCreate.register(client);
voiceStateUpdate.register(client);

await client.login(process.env.KokoneToken);
