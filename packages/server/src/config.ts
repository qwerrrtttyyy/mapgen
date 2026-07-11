import { env } from 'node:process';
import { resolve } from 'node:path';

export interface ServerConfig {
  port: number;
  dataDir: string;
  corsOrigins: string[];
  maxResolution: number;
  /** 绑定地址，默认 127.0.0.1（仅本地可达） */
  hostname: string;
}

export function loadConfig(): ServerConfig {
  return {
    port: parseInt(env.MAPGEN_PORT || '8787', 10),
    dataDir: env.MAPGEN_DATA_DIR || resolve(process.cwd(), '.data'),
    corsOrigins: (env.MAPGEN_CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(
      ','
    ),
    maxResolution: parseInt(env.MAPGEN_MAX_RESOLUTION || '4096', 10),
    hostname: env.MAPGEN_HOST || '127.0.0.1',
  };
}
