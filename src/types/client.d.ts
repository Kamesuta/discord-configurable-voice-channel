import { Client, Collection } from 'discord.js';
import { Command } from './commands/types/Command';
interface CustomCommand {
	execute(interaction: Interaction): Promise<void>;
    data: {
        name: string
    }
}
declare module 'discord.js' {
    interface Client {
        commands: Collection<string, CustomCommand>;
    }
}