import { Events, VoiceState, } from "discord.js";
// -----------------------------------------------------------------------------------------------------------
// ボイスチャンネル処理
// -----------------------------------------------------------------------------------------------------------
module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState: VoiceState, newState: VoiceState): Promise<void> {
        await require("../guildProcess/voiceCreate").execute(oldState, newState);
    }
};