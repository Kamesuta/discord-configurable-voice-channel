import { Client, Events } from 'discord.js';
import { onVoiceCreateInteraction } from '../guildProcess/voiceCreateInteraction.js';

/**
 * Discordクライアントにイベントを登録する
 * @param client Discord Bot
 */
export function register(client: Client): void {
  client.on(Events.InteractionCreate, onVoiceCreateInteraction);
}
