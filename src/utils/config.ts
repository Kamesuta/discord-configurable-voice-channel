import assert from 'assert';
import { parse } from 'toml';
import { getWorkdirPath } from './workdir.js';
import { copyFileSync, existsSync, readFileSync } from 'fs';
import { logger } from './log.js';
import { exit } from 'process';

/**
 * Structure of the configuration file
 */
export interface Config {
  /**
   * VC作成チャンネルID
   */
  voiceChannelId: string;
  /**
   * メンバーロールID
   */
  memberRoleId: string;
  /**
   * プレフィックス
   */
  prefix: string;
  /**
   * ボットの色
   */
  botColor: string;
  /**
   * エラーの色
   */
  errorColor: string;
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
  config.voiceChannelId && typeof config.voiceChannelId === 'string',
  'voiceChannelId is required.',
);
assert(
  config.memberRoleId && typeof config.memberRoleId === 'string',
  'memberRoleId is required.',
);
assert(
  config.prefix && typeof config.prefix === 'string',
  'prefix is required.',
);
assert(
  config.botColor &&
    typeof config.botColor === 'string' &&
    /^#[0-9A-F]{6}$/i.test(config.botColor),
  'botColor is required.',
);
assert(
  config.errorColor &&
    typeof config.errorColor === 'string' &&
    /^#[0-9A-F]{6}$/i.test(config.botColor),
  'errorColor is required.',
);
