import assert from 'assert';
import { parse } from 'toml';
import { getWorkdirPath } from './workdir.js';
import { copyFileSync, existsSync, readFileSync } from 'fs';

/**
 * Structure of the configuration file
 */
export interface Config {
  /**
   * クライアントID
   */
  clientId: string;
  /**
   * デバッグ環境: サーバーID
   */
  developerGuildId: string;
  /**
   * 本番環境: サーバーID
   */
  generalGuildId: string;
  /**
   * デバッグ環境: 管理チャンネルID
   */
  managementChannelId: string;
  /**
   * エントランスチャンネルID
   */
  entranceChannelId: string;
  /**
   * チャットチャンネルID
   */
  chatChannelId: string;
  /**
   * プレフィックス
   */
  prefix: string;
  /**
   * ボットの色
   */
  botColor: number;
  /**
   * エラーの色
   */
  errorColor: number;
}

// If config.toml does not exist, copy config.default.toml
if (!existsSync(getWorkdirPath('config.toml'))) {
  copyFileSync(
    getWorkdirPath('config.default.toml'),
    getWorkdirPath('config.toml'),
  );
}

/** Configuration */
export const config: Config = parse(
  readFileSync(getWorkdirPath('config.toml'), 'utf-8'),
) as Config;

// Check the types
assert(
  config.clientId && typeof config.clientId === 'string',
  'clientId is required.',
);
assert(
  config.developerGuildId && typeof config.developerGuildId === 'string',
  'developerGuildId is required.',
);
assert(
  config.generalGuildId && typeof config.generalGuildId === 'string',
  'generalGuildId is required.',
);
assert(
  config.managementChannelId && typeof config.managementChannelId === 'string',
  'managementChannelId is required.',
);
assert(
  config.entranceChannelId && typeof config.entranceChannelId === 'string',
  'entranceChannelId is required.',
);
assert(
  config.chatChannelId && typeof config.chatChannelId === 'string',
  'chatChannelId is required.',
);
assert(
  config.prefix && typeof config.prefix === 'string',
  'prefix is required.',
);
assert(
  config.botColor && typeof config.botColor === 'number',
  'botColor is required.',
);
assert(
  config.errorColor && typeof config.errorColor === 'number',
  'errorColor is required.',
);
