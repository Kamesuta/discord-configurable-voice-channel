//必要なパッケージをインポートする
import { Client, Collection, GatewayIntentBits, Interaction, Partials } from "discord.js"
import dotenv from "dotenv"
import fs from "node:fs"
import path from "node:path"

//.envファイルを読み込む
dotenv.config()

//Botで使うGetwayIntents、partials
const client: Client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildVoiceStates
    ],
    partials: [
        Partials.Message, 
        Partials.Channel
    ],
})

client.commands = new Collection();

// -----------------------------------------------------------------------------------------------------------
// イベントハンドラー
// -----------------------------------------------------------------------------------------------------------
const eventsPath: string = path.join(__dirname, 'events');
const eventFiles: string[] = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath: string = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

client.login(process.env.KokoneToken);