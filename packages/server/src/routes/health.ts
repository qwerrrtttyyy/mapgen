import { Hono } from 'hono';
import type { ServerConfig } from '../config.js';

export function createHealthRoute(config: ServerConfig) {
  const app = new Hono();
  app.get('/health', c => {
    return c.json({
      status: 'ok',
      version: '0.0.3-pre',
      capabilities: {
        maxResolution: config.maxResolution,
        supportsPersistence: true,
        supportsAbort: false,
        features: [
          'oceanCurrents',
          'iceSheet',
          'monsoon',
          'continentality',
          'hadley',
          'advancedBiomes',
          'watershed',
          'volcanism',
          'seasons',
        ],
      },
    });
  });
  return app;
}
