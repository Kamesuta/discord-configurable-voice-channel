import { ButtonInteraction, EmbedBuilder, Interaction, VoiceChannel } from "discord.js";
import { botcolor } from "../config.json";
import { 
    operationMenu, 
    memberRoleId,
    allowUserPermisson, 
    allowCreateUserPermisson, 
} from "../module/voiceCreateData";
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient();

const publicChannelEmbed: EmbedBuilder = new EmbedBuilder()
    .setColor(Number(botcolor))
    .setTitle("ボイスチャンネルを公開しました")
    .setDescription("設定を行いたい場合、下のメニューから設定を行ってください\n※ブロック・ブロック解除の操作は行えません")

const betaEmbed: EmbedBuilder = new EmbedBuilder()
    .setColor(Number(botcolor))
    .setTitle("現在のVC作成機能は開発段階のBeta版です。")
    .setDescription("BOTの最終的な品質を示しているものではありません。ご理解とご支援ありがとうございます。グッドラック！\n(不具合や修正案、追加案があれば鯖主にご連絡を！)")
module.exports = {
	async execute(interaction: Interaction): Promise<void> {
        if (!interaction.isButton()) return;
        const channel = interaction.channel;
        // -----------------------------------------------------------------------------------------------------------
        // チャンネルを公開する時の処理
        // -----------------------------------------------------------------------------------------------------------
        if (interaction.customId === "publicButton") {
            try {
                if (channel && channel.type === 2) { // チャンネルがボイスチャンネルかどうか確認
                    const channelName: string = (interaction.channel as VoiceChannel).name;
                    let channelUserLimit: string | number = (interaction.channel as VoiceChannel)?.userLimit;
                    if (channelUserLimit === 0) {
                        channelUserLimit = "無制限";
                    } else {
                        channelUserLimit = `${channelUserLimit} 人`
                    };
                    const channelBitRate = Number((interaction.channel as VoiceChannel)?.bitrate) / 1000;
                    // -----------------------------------------------------------------------------------------------------------
                    // チャンネルの権限をセットする
                    // -----------------------------------------------------------------------------------------------------------
                    await channel.permissionOverwrites.set([
                        {
                            id: interaction.user.id,
                            allow: [allowUserPermisson, allowCreateUserPermisson]
                        },
                        {
                            id: memberRoleId,
                            allow: [allowUserPermisson]
                        }
                    ]);
                    // -----------------------------------------------------------------------------------------------------------
                    // ブロックしているユーザーがいた場合、チャンネルを表示しない
                    // -----------------------------------------------------------------------------------------------------------
                    const allUsers = await prisma.blackLists.findMany({
                        where: {
                            userId: String(interaction.user.id)
                        },
                    })
                    for (let i = 0; i < allUsers.length; i++) {
                        channel.permissionOverwrites.edit(String(allUsers[i].blockUserId), {
                            ViewChannel: false
                        });
                    };
                    await (interaction as ButtonInteraction).reply({
                        content: "チャンネルを公開しました",
                        embeds: [betaEmbed],
                        ephemeral: true
                    });
                    await interaction.message?.edit({
                        embeds: [
                            publicChannelEmbed.setFields(
                                { name: "現在の設定", value: `チャンネル名: ${channelName}\nユーザー人数制限: ${channelUserLimit}\nビットレート: ${channelBitRate}kbps` },
                            )
                        ],
                        components: [operationMenu]
                    });
                };
            } catch(error) {
                console.log(error);
            };
        };
    }
};