import { EmbedBuilder, ActionRowBuilder, Interaction, ModalBuilder, ModalSubmitInteraction, StringSelectMenuInteraction, TextInputBuilder, TextInputStyle, VoiceChannel, UserSelectMenuInteraction, PermissionsBitField } from 'discord.js';
import { botcolor } from "../config.json";
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient();

const editChannelEmbed: EmbedBuilder = new EmbedBuilder()
    .setColor(Number(botcolor))
    .setTitle("ボイスチャンネルの設定を変更しました")
    .setDescription("設定を行いたい場合、下のメニューから設定を行ってください。")

const changeNameModal: ModalBuilder = new ModalBuilder()
	.setCustomId("changeNameModal")
	.setTitle("チャンネル名の変更");
const changeNameInput: TextInputBuilder = new TextInputBuilder()
    .setMaxLength(20)
    .setMinLength(1)
    .setCustomId("changeNameInput")
    .setLabel("変更するチャンネル名を入力してください")
    .setPlaceholder("20文字までです")
    .setStyle(TextInputStyle.Short)

const changePeopleLimitedModal: ModalBuilder = new ModalBuilder()
    .setCustomId("changePeopleLimitedModal")
    .setTitle("人数制限の変更");
const changePeopleLimitedInput: TextInputBuilder = new TextInputBuilder()
    .setMaxLength(2)
    .setMinLength(1)
    .setCustomId("changePeopleLimitedInput")
    .setLabel("変更する人数を入力してください")
    .setPlaceholder("0~99人までです(0人の場合は無制限になります)")
    .setStyle(TextInputStyle.Short)

const changeBitRateModal: ModalBuilder = new ModalBuilder()
    .setCustomId("changeBitRateModal")
    .setTitle("ビットレートの変更");
      
const changeBitRateInput: TextInputBuilder = new TextInputBuilder()
    .setMaxLength(3)
    .setMinLength(1)
    .setCustomId("changeBitRateInput")
    .setLabel("変更するビットレート数を入力してください")
    .setPlaceholder("8~384Kbpsまでです(64kbps以下は非推奨です)")
    .setStyle(TextInputStyle.Short)

const changeNameRow: ActionRowBuilder<TextInputBuilder> = new ActionRowBuilder<TextInputBuilder>().addComponents(changeNameInput);
changeNameModal.addComponents(changeNameRow);

const changePeopleLimitedRow: ActionRowBuilder<TextInputBuilder> = new ActionRowBuilder<TextInputBuilder>().addComponents(changePeopleLimitedInput);
changePeopleLimitedModal.addComponents(changePeopleLimitedRow);

const changeBitRateRow: ActionRowBuilder<TextInputBuilder> = new ActionRowBuilder<TextInputBuilder>().addComponents(changeBitRateInput);
changeBitRateModal.addComponents(changeBitRateRow);

// -----------------------------------------------------------------------------------------------------------
// ボイスチャンネル作成のインタラクション処理
// -----------------------------------------------------------------------------------------------------------
module.exports = {
	async execute(interaction: Interaction): Promise<void> {
        try {
            if (interaction.isButton()) {
                await require("../guildProcess/voicePublic").execute(interaction);
            };
            if (!interaction.isStringSelectMenu()&&!interaction.isModalSubmit()&&!interaction.isUserSelectMenu()) return;
            if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageChannels)) {
                await interaction.reply({
                    content: "あなたにはチャンネルの設定をする権限がありません",
                    ephemeral: true
                })
                return;
            };
            // -----------------------------------------------------------------------------------------------------------
            // チャンネルの設定
            // -----------------------------------------------------------------------------------------------------------
            if (interaction.customId === "operationMenu") {
                const operationPage = (interaction as StringSelectMenuInteraction).values[0].split("_")[0];
                switch (operationPage) {
                    case "name": // 名前
                        await (interaction as StringSelectMenuInteraction).showModal(changeNameModal);
                        break;
                    case "peopleLimited": // 人数制限
                        await (interaction as StringSelectMenuInteraction).showModal(changePeopleLimitedModal);
                        break;
                    case "bitrate": // ビットレート
                        await (interaction as StringSelectMenuInteraction).showModal(changeBitRateModal);
                        break;
                };
            };
            
            const channel = interaction.channel;
            let channelName: string = "";
            let channelUserLimit: number | string = 0;
            let channelBitRate: number = 64;
            
            if (channel && channel.type === 2) { // チャンネルがボイスチャンネルかどうか確認
                let allUsers = await prisma.blackLists.findMany({
                    where: {
                        userId: String(interaction.user.id)
                    },
                });
                switch (interaction.customId) {
                    // -----------------------------------------------------------------------------------------------------------
                    // チャンネル名の変更
                    // -----------------------------------------------------------------------------------------------------------
                    case "changeNameModal":
                        channelName = (interaction as ModalSubmitInteraction).fields.getTextInputValue("changeNameInput");
                        await channel.setName(channelName);
                        await interaction.reply({
                            content: `チャンネルの名前を${channelName}に変更しました`,
                            ephemeral: true
                        })
                        break;
                    // -----------------------------------------------------------------------------------------------------------
                    // 人数制限の変更
                    // -----------------------------------------------------------------------------------------------------------
                    case "changePeopleLimitedModal":
                        channelUserLimit = Number((interaction as ModalSubmitInteraction).fields.getTextInputValue("changePeopleLimitedInput"));
                        if (Number.isNaN(channelUserLimit)) {
                            await interaction.reply({
                                content: `数字を入れてください`,
                                ephemeral: true
                            });
                        } else if (channelUserLimit > 99) {
                            await interaction.reply({
                                content: `変更できる人数制限の値は0~99人までです`,
                                ephemeral: true
                            });
                        } else {
                            await channel.setUserLimit(channelUserLimit);
                            await interaction.reply({
                                content: `チャンネルの人数制限を${channelUserLimit}人に変更しました`,
                                ephemeral: true
                            });
                        };
                        break;
                    // -----------------------------------------------------------------------------------------------------------
                    // ビットレートの変更
                    // -----------------------------------------------------------------------------------------------------------
                    case "changeBitRateModal":
                        channelBitRate = Number((interaction as ModalSubmitInteraction).fields.getTextInputValue("changeBitRateInput"));
                        if (Number.isNaN(channelBitRate)) {
                            await interaction.reply({
                                content: `数字を入れてください`,
                                ephemeral: true
                            });
                        } else if (channelBitRate < 8 || channelBitRate > 384) {
                            await interaction.reply({
                                content: `変更できるビットレートの値は8~384kbpsまでです`,
                                ephemeral: true
                            });
                        } else {
                            await channel.setBitrate(channelBitRate * 1000);
                            await interaction.reply({
                                content: `チャンネルのビットレートを${channelBitRate}kbpsに変更しました`,
                                ephemeral: true
                            });
                        };
                        break;
                };
                const userId: string = String(interaction.user.id);
                // -----------------------------------------------------------------------------------------------------------
                // ユーザーをブロックする処理
                // -----------------------------------------------------------------------------------------------------------
                if (interaction.customId == "userBlackList") {
                    for (let i = 0; i < (interaction as UserSelectMenuInteraction).values.length; i++) {
                        const blockUserId: String = String((interaction as UserSelectMenuInteraction).values[i]);
                        // Prismaを使ってBlackListsテーブルにレコードを作成
                        for (let i = 0; i < allUsers.length; i++) {
                            if (String(allUsers[i].blockUserId) == blockUserId) { 
                                interaction.reply({
                                    content: "既にブロックしているユーザーを選択しています。",
                                    ephemeral: true
                                });
                                return;
                            };
                        };
                        await prisma.blackLists.create({
                            data: {
                                userId: String(userId),
                                blockUserId: String(blockUserId)
                            }
                        });
                    };
                    await interaction.reply({
                        content: "選択したユーザーのブロックが完了しました",
                        ephemeral: true
                    });
                };
                // -----------------------------------------------------------------------------------------------------------
                // ユーザーのブロックを解除する処理
                // -----------------------------------------------------------------------------------------------------------
                if (interaction.customId == "userBlackReleaseList") {
                    for (let i = 0; i < (interaction as UserSelectMenuInteraction).values.length; i++) {
                        const blockUserId: string = String((interaction as UserSelectMenuInteraction).values[i]);
                        for (let i = 0; i < allUsers.length; i++) {
                            if (String(allUsers[i].blockUserId) == blockUserId) { 
                                await prisma.blackLists.deleteMany({
                                    where: {
                                        userId: String(userId),
                                        blockUserId: String(blockUserId)
                                    }
                                });
                            };
                        };
                    };
                    await interaction.reply({
                        content: "選択したユーザーのブロック解除が完了しました",
                        ephemeral: true
                    });
                };
                // -----------------------------------------------------------------------------------------------------------
                // チャンネルの設定を更新するための処理
                // -----------------------------------------------------------------------------------------------------------
                allUsers = await prisma.blackLists.findMany({ // メッセージを更新するためにデータを再度取得する
                    where: {
                        userId: String(interaction.user.id)
                    },
                });
                channelName = (interaction.channel as VoiceChannel).name;
                channelUserLimit = (interaction.channel as VoiceChannel)?.userLimit;
                if (channelUserLimit === 0) {
                    channelUserLimit = "無制限";
                } else {
                    channelUserLimit = `${channelUserLimit}人`
                };
                channelBitRate = Number((interaction.channel as VoiceChannel)?.bitrate) / 1000;

                let blockUserList: string = "なし";

                for (let i = 0; i < allUsers.length; i++) { // ユーザーのブロックリストを全て取得して出力
                    if (blockUserList == "なし") blockUserList = "";
                    blockUserList += `<@${String(allUsers[i].blockUserId)}>\n`;
                };
                // -----------------------------------------------------------------------------------------------------------
                // チャンネルの設定メッセージを更新する処理
                // (公開されていた場合、ブロックしているユーザー一覧は表示しない)
                // (公開されていない場合、必ずコンポーネントの数は4になる)
                // -----------------------------------------------------------------------------------------------------------
                const voiceCreateComponents = interaction.message?.components.length; // 設定メッセージのコンポーネントの数を取得
                if (voiceCreateComponents === 4) {
                    await interaction.message?.edit({
                        embeds: [
                            editChannelEmbed.setFields(
                                { name: "現在の設定", value: `チャンネル名: ${channelName}\nユーザー人数制限: ${channelUserLimit}\nビットレート: ${channelBitRate}kbps` },
                                { name: "ブロックしているユーザー", value: blockUserList }
                            )
                        ]
                    });
                } else {
                    await interaction.message?.edit({
                        embeds: [
                            editChannelEmbed.setFields(
                                { name: "現在の設定", value: `チャンネル名: ${channelName}\nユーザー人数制限: ${channelUserLimit}\nビットレート: ${channelBitRate}kbps` },
                            )
                        ]
                    });
                }
            };
        } catch(error) {
            console.log(error);
        };
    }
};