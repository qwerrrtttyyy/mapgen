import { Hono } from 'hono';
import { jobQueue } from '../services/jobQueue.js';
import type { GenerateRequest } from '@mapgen/shared-types';

export function createGenerateRoute() {
  const app = new Hono();
  app.post('/generate', async c => {
    const body = await c.req.json<GenerateRequest>();
    const jobId = jobQueue.create(body.params);
    return c.json({ jobId, status: 'queued' as const }, 202);
  });
  return app;
}
