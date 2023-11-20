import { Interaction } from 'discord.js';

module.exports = {
	async execute(interaction: Interaction): Promise<void> {
        await require("../guildProcess/voiceCreateInteraction").execute(interaction);
    }
};