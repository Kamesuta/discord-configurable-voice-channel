import { Collection } from 'discord.js';

// import { Client } from 'discord.js';
interface CustomCommand {
  execute(interaction: Interaction): Promise<void>;
  data: {
    name: string;
  };
}

// import { Command } from './commands/types/Command';
declare module 'discord.js' {
  interface Client {
    commands: Collection<string, CustomCommand>;
  }
}
