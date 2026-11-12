import { app } from 'electron';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { AppConfig } from '../shared/config';

export type { AppConfig } from '../shared/config';

export function configPath(): string {
  return join(app.getPath('userData'), 'config.json');
}

/** 每次调用都重新读取，方便直接编辑 config.json 后立即生效 */
export function readConfig(): AppConfig {
  try {
    return JSON.parse(readFileSync(configPath(), 'utf8')) as AppConfig;
  } catch {
    return {};
  }
}

export function writeConfig(config: AppConfig) {
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}
