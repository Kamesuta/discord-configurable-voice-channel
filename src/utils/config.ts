import assert from 'assert';
import { copyFileSync, existsSync, readFileSync } from 'fs';
import { exit } from 'process';

import { parse } from 'toml';

import { logger } from './log.js';
import { getWorkdirPath } from './workdir.js';

/**
 * カスタムVCのエントリ
 */
export interface ChannelEntry {
  /**
   * カスタムVCのID
   */
  channelId: string;
  /**
   * デフォルトの人数
   */
  maxUser: number;
}

/**
 * Structure of the configuration file
 */
export interface Config {
  /**
   * ボットの色
   */
  botColor: string;
  /**
   * VC操作パネルのチャンネルID
   */
  controlPanelChannelId: string;
  /**
   * VC操作パネルのメッセージID
   * (空の場合初期投稿を行います。その後この設定を投稿されたメッセージIDに書き換え、Botを再起動してください)
   */
  controlPanelMessageId: string;
  /**
   * カスタムVCのチャンネルIDリスト
   */
  customVcList: ChannelEntry[];
  /**
   * 読み上げBotのIDリスト
   */
  readBotList: {
    /**
     * 読み上げBotのID
     */
    botId: string;
  }[];
}

// If config.toml does not exist, copy config.default.toml
if (!existsSync(getWorkdirPath('config.toml'))) {
  copyFileSync(
    getWorkdirPath('config.default.toml'),
    getWorkdirPath('config.toml'),
  );
}

/** Configuration */
export const config: Config = ((): Config => {
  try {
    return parse(
      readFileSync(getWorkdirPath('config.toml'), 'utf-8'),
    ) as Config;
  } catch (error) {
    logger.error('コンフィグの読み込みに失敗しました', error);
    exit(1);
  }
})();

// Check the types
assert(
  config.botColor &&
    typeof config.botColor === 'string' &&
    /^#[0-9A-F]{6}$/i.test(config.botColor),
  'botColor is invalid.',
);
assert(
  config.controlPanelChannelId &&
    typeof config.controlPanelChannelId === 'string',
  'controlPanelChannelId is invalid.',
);
assert(
  // 空文字を許容する (初期投稿を行うため)
  typeof config.controlPanelMessageId === 'string',
  'controlPanelMessageId is invalid.',
);
assert(
  config.customVcList &&
    Array.isArray(config.customVcList) &&
    config.customVcList.every((id) => typeof id === 'object'),
  'customVcList is invalid.',
);
assert(
  config.readBotList &&
    Array.isArray(config.readBotList) &&
    config.readBotList.every((id) => typeof id === 'object'),
  'readBotList is invalid.',
);

/**
 * カスタムVCのエントリを取得する
 * @param channelId チャンネルID
 * @returns カスタムVCのエントリ
 */
export function getChannelEntry(channelId: string): ChannelEntry | undefined {
  return config.customVcList.find((entry) => entry.channelId === channelId);
}
