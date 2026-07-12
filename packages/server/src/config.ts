import { env } from 'node:process';
import { resolve } from 'node:path';

export interface ServerConfig {
  port: number;
  hostname: string;
  dataDir: string;
  corsOrigins: string[];
  maxResolution: number;
  apiKey: string | null;
}

export function loadConfig(): ServerConfig {
  return {
    port: parseInt(env.MAPGEN_PORT || '8787', 10),
    hostname: env.MAPGEN_HOST || '127.0.0.1',
    dataDir: env.MAPGEN_DATA_DIR || resolve(process.cwd(), '.data'),
    corsOrigins: (env.MAPGEN_CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(
      ','
    ),
    maxResolution: parseInt(env.MAPGEN_MAX_RESOLUTION || '4096', 10),
    apiKey: env.MAPGEN_API_KEY || null,
  };
}
