import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import TOML from 'toml';

export interface Config {
  port: number;
  bind_address: string;
  conductor_db_path: string;
  auth_token: string;
}

function generateToken(): string {
  // Simple 6-digit passcode — easy to type on a phone
  return String(crypto.randomInt(100000, 999999));
}

function detectConductorDbPath(): string | null {
  if (process.platform === 'darwin') {
    const dbPath = path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'com.conductor.app',
      'conductor.db'
    );
    if (fs.existsSync(dbPath)) return dbPath;
  }
  // Linux fallback
  const dataDir =
    process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  const linuxPath = path.join(dataDir, 'com.conductor.app', 'conductor.db');
  if (fs.existsSync(linuxPath)) return linuxPath;

  return null;
}

function configPath(): string {
  const configDir =
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configDir, 'conductor-companion', 'config.toml');
}

function toToml(config: Config): string {
  return [
    `port = ${config.port}`,
    `bind_address = "${config.bind_address}"`,
    `conductor_db_path = "${config.conductor_db_path}"`,
    `auth_token = "${config.auth_token}"`,
  ].join('\n');
}

export function loadOrCreateConfig(): Config {
  const cfgPath = configPath();

  if (fs.existsSync(cfgPath)) {
    const contents = fs.readFileSync(cfgPath, 'utf-8');
    const parsed = TOML.parse(contents) as Config;
    return parsed;
  }

  const config: Config = {
    port: 3847,
    bind_address: '0.0.0.0',
    conductor_db_path: detectConductorDbPath() || '',
    auth_token: generateToken(),
  };

  // Save config
  const dir = path.dirname(cfgPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(cfgPath, toToml(config));

  console.log(`Created new config at ${cfgPath}`);
  console.log(`Auth token: ${config.auth_token}`);

  return config;
}
