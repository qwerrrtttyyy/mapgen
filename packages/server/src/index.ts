import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
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
app.use('*', cors({ origin: config.corsOrigins }));

app.route('/api/v1', createHealthRoute(config));
app.route('/api/v1', createGenerateRoute());
app.route('/api/v1', createJobsRoute());
app.route('/api/v1', createMapsRoute(storage));
app.route('/api/v1', createPresetsRoute(db));

export default app;

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = config.port;
  serve({ fetch: app.fetch, port });
  console.log(`MapGen server listening on http://localhost:${port}`);
}
