import { Client, Events, Interaction } from 'discord.js';
import { CustomCommand } from '../types/client';
import { onVoiceCreateInteraction } from '../guildProcess/voiceCreateInteraction.js';

/**
 * Interactionイベントが発火したときに実行される関数
 * @param interaction インタラクション
 */
async function onInteractionCreate(interaction: Interaction): Promise<void> {
  let commandName: string;
  // インタラクションの種類によってcommandNameを取得
  if (interaction.isChatInputCommand()) {
    commandName = interaction.commandName;
  } else if (
    interaction.isStringSelectMenu() &&
    interaction.message.interaction !== null
  ) {
    commandName = interaction.message.interaction.commandName;
  } else if (
    interaction.isButton() &&
    interaction.message.interaction !== null
  ) {
    commandName = interaction.message.interaction.commandName;
  } else if (interaction.isStringSelectMenu() || interaction.isButton()) {
    commandName = interaction.customId.split('_')[1];
  } else {
    commandName = '';
  }
  const command: CustomCommand | undefined =
    interaction.client.commands.get(commandName);
  if (command) {
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`[ERROR] 実行エラー: ${commandName}`);
      console.error(error);
    }
  } else if (!command) {
    try {
      await onVoiceCreateInteraction(interaction);
    } catch (error) {
      console.log(error);
    }
  }
}

/**
 * Discordクライアントにイベントを登録する
 * @param client Discord Bot
 */
export function register(client: Client): void {
  client.on(Events.InteractionCreate, onInteractionCreate);
}
