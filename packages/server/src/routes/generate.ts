import { Hono } from 'hono';
import { jobQueue } from '../services/jobQueue.js';
import type { GenerateRequest } from '@mapgen/shared-types';
import { validateGenerateParams } from '../validation.js';

export function createGenerateRoute(): Hono {
  const app = new Hono();
  app.post('/generate', async c => {
    const body = await c.req.json<GenerateRequest>();
    const errors = validateGenerateParams(body.params);
    if (errors.length > 0) {
      return c.json(
        { error: { code: 'VALIDATION_ERROR', message: errors[0].message, details: { errors } } },
        400,
      );
    }
    const jobId = jobQueue.create(body.params);
    return c.json({ jobId, status: 'queued' as const }, 202);
  });
  return app;
}
