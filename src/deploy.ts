import { REST, Routes } from 'discord.js';
import dotenv from "dotenv"
import { clientId, developerGuildId, generalGuildId } from './config.json';

import fs from 'node:fs';
import path from 'node:path';

//.envファイルを読み込む
dotenv.config()

const commands: string[] = [];
// 作成したcommandsディレクトリから全てのコマンドファイルを取得する。
const foldersPath: string = path.join(__dirname, 'commands');
const commandFolders: string[] = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	// 作成したcommandsディレクトリからすべてのコマンドファイルを取得する。
	const commandsPath: string = path.join(foldersPath, folder);
	const commandFiles: string[] = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	// 各コマンドのデータをSlashCommandBuilder#toJSON()で出力し、デプロイする。
	for (const file of commandFiles) {
		const filePath: string = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			commands.push(command.data.toJSON());
		} else {
			console.log(`[WARNING] ${filePath}のコマンドには、必須の "data "または "execute "プロパティがありません。`);
		}
	}
}

// RESTモジュールのインスタンスを構築
const rest = new REST().setToken(process.env.KokoneToken || "");

// コマンドをデプロイ
(async () => {
	try {
		console.log(`${commands.length}アプリケーション（/）コマンドのリフレッシュを開始`);

		// putメソッドは、ギルド内のすべてのコマンドを現在のセットで完全にリフレッシュするために使用される
		const data: any = await rest.put(
			Routes.applicationGuildCommands(clientId, generalGuildId),
			{ body: commands },
		);

		console.log(`${data.length}アプリケーション（/）コマンドのリロードに成功`);
	} catch (error) {
		console.error(error);
	}
})();