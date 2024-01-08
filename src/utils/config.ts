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
   * ボットの色
   */
  botColor: string;
  /**
   * エラーの色
   */
  errorColor: string;
  /**
   * カスタムVCのチャンネルIDリスト
   */
  customVcChannelIdList: string[];
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
  config.errorColor &&
    typeof config.errorColor === 'string' &&
    /^#[0-9A-F]{6}$/i.test(config.botColor),
  'errorColor is invalid.',
);
assert(
  config.customVcChannelIdList &&
    typeof config.customVcChannelIdList === 'object' &&
    typeof config.customVcChannelIdList[0] === 'string',
  'customVcChannelIdList is invalid.',
);
