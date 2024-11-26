# カスタムVCチャンネルBot

## 概要

用意しておいたチャンネルに対して、VCに入れるユーザーを制限(ブロック/ブロック解除)できるようにするBotです。  
![2024-01-09_15h05_04](https://github.com/Kamesuta/discord-configurable-voice-channel/assets/16362824/de78d04c-244e-4455-9f44-d067435874c9)

## このBotの特徴

- 使い捨てVCチャンネルを作成する一般的なTempVoice系Botとは違い、事前に手動で作成したVCチャンネルを使い回す仕組みとなっています。
    - そのため、VCチャットで会話した内容/思い出がVC解散時に消えてしまうことはありません。
- 最初にVCに入ったユーザーがオーナーとなり、任意のユーザーをブロックしたり、人数制限をかけたりできます。
    - 苦手な人や、話題に関係ないことをいきなり話してくる人をブロックすることで、VCチャットをより楽しめるようになります。
    - ブロックされたユーザーはチャンネルを見ることが出来ないため、相手がブロックされたことに気づく可能性が低くなります。
- 使いやすさを重視しており、機能は最低限に抑えています。

## 使い方 (エンドユーザー向け)

1. 誰もいないカスタムVCチャンネルに入る
    - 誰もいないカスタムVCチャンネルに入ることで、自分がオーナーとなり、VC設定を操作できるようになる
2. 以下のUIが表示される  
![2024-01-09_15h09_22](https://github.com/Kamesuta/discord-configurable-voice-channel/assets/16362824/51da9a01-9b74-4e71-8928-3b96cec09a6f)
3. 「ブロックするユーザーを選択」を押し、ブロックしたいユーザーを選択する
    - ブロックすると、ユーザーはVCが見れなくなり、VCに入れなくなる
4. 「ブロックを解除するユーザーを選択」を押し、ブロック解除したいユーザーを選択する
    - ブロック解除すると、ユーザーはVCが見れるようになり、VCに入れるようになる
5. 「ブロックユーザー確認」を押すと、現在自分がブロックしているユーザーの一覧が表示される
6. 「チャンネルの設定」を押すと、人数制限やビットレートの設定ができる
    - 人数制限を設定すると、その人数以上のユーザーがVCに入れなくなる
        - 少人数VCや、一声かけてからVCに入ってもらいたい場合に便利
7. カスタムVCチャンネルから人がいなくなると、VCが開放され、誰でも使えるようになる
    - ブロックユーザーは、オーナーごとに保存されているため、同じオーナーが別のカスタムVCに入った場合、ブロックユーザーが引き継がれる

## 使い方 (開発者向け)

1. Node.js 18 を入れる (20だと動きません)
2. リポジトリをクローンする
3. `npm install`で依存パッケージをインストールします。
4. `run`フォルダにある`config.sample.toml`を`config.toml`にコピーし、中身を書き換えます。
5. XAMPPなどでMySQLを起動します。
6. `.env.sample`を`.env`にコピーし、中身を書き換えます。
7. `npx prisma migrate dev`でDBを作成します。
8. [チャンネル権限設定](#チャンネル権限設定)を参考にDiscord上で権限を設定します。
9. `npm start`で起動します。(VSCodeの場合は`F5`で起動できます。)

## チャンネル権限設定

1. カスタムVCを作成するチャンネルカテゴリへ以下の設定を行います  
  カテゴリ設定上でBotロールへ以下の権限を付与します。(注意点: Botメンバーに権限を付与するのではなく、必ずBotロールに権限を付与してください)
    - チャンネルを見る
    - 接続
    - チャンネルの管理
    - メンバーを移動
    - 権限の管理
    - 優先スピーカー (VCのオーナーにこの権限を付与し、この権限があるかどうかでオーナーかどうかを判定しています。)
2. カテゴリ内にカスタムVCチャンネルを必要な数だけ作成します
    - カテゴリの権限と同期するようにしてください。(各VCにカテゴリで設定したBotの権限が引き継がれます。)
3. [コンフィグ](#コンフィグ)にカスタムVCチャンネルのIDを列挙してください

補足: カテゴリへの権限付与だけで動作します。Botロール自体には権限は不要です。特権Intentsも不要です。

## コンフィグ

|キー             |説明             |備考             |
|----------------|----------------|----------------|
|`botColor`|Botのメッセージの色|Embedの色に使用されます|
|`customVcList`|カスタムVCチャンネルのリスト| |
|`customVcList.channelId`|カスタムVCチャンネルのID| |
|`customVcList.maxUser`|カスタムVCチャンネルの最大人数| |
|`readBotList`|読み上げBotのリスト| |
|`readBotList.botId`|読み上げBotのID| |

## クレジット

このBotは、[@NekosanQ](https://github.com/NekosanQ)さんに許可を頂いて[猫咲 心音ボット](https://github.com/NekosanQ/DiscordBOT-Kokone)のコードをベースに使用させてもらいました。
また、MITライセンスで公開する許可をいただきました。
素敵なBotをありがとうございます！
