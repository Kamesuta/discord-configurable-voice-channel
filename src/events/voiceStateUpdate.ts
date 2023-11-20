import { Client, Events } from 'discord.js';
import { onVoiceStateUpdate } from '../guildProcess/voiceCreate.js';

/**
 * Discordクライアントにイベントを登録する
 * @param client Discord Bot
 */
export function register(client: Client): void {
  client.on(Events.VoiceStateUpdate, onVoiceStateUpdate);
}
