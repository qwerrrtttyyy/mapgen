import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { loadConfig } from './config.js';
import { createDatabase } from './db/index.js';
import { jobQueue } from './services/jobQueue.js';
import { executeGenerationJob } from './services/mapEngine.js';
import { MapStorage } from './services/mapStorage.js';
import { createHealthRoute } from './routes/health.js';
import { createGenerateRoute } from './routes/generate.js';
import { createJobsRoute } from './routes/jobs.js';
import { createMapsRoute } from './routes/maps.js';
import { createPresetsRoute } from './routes/presets.js';

const config = loadConfig();
const db = createDatabase();
const storage = new MapStorage(db);

jobQueue.setExecutor(executeGenerationJob);

const app = new Hono();

// Global error handler: prevent stack trace exposure
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500);
});

app.use('*', cors({ origin: config.corsOrigins }));

// Optional API key authentication
if (config.apiKey) {
  app.use('*', async (c, next) => {
    if (c.req.header('X-API-Key') !== config.apiKey) {
      return c.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' } },
        401
      );
    }
    await next();
  });
}

app.route('/api/v1', createHealthRoute(config));
app.route('/api/v1', createGenerateRoute());
app.route('/api/v1', createJobsRoute());
app.route('/api/v1', createMapsRoute(storage));
app.route('/api/v1', createPresetsRoute(db));

export default app;

if (typeof Bun !== 'undefined' && import.meta.url === `file://${Bun.main}`) {
  const port = config.port;
  Bun.serve({ fetch: app.fetch, port, hostname: config.hostname });
  console.log(`MapGen server listening on http://${config.hostname}:${port}`);
}
