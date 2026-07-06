import { Hono } from 'hono';
import { jobQueue } from '../services/jobQueue.js';
import type { GenerationProgress, GenerationResult, MapGenError } from '@mapgen/shared-types';

export function createJobsRoute(): Hono {
  const app = new Hono();

  app.get('/jobs/:id', c => {
    const id = c.req.param('id');
    const accept = c.req.header('accept') || '';
    const job = jobQueue.get(id);

    if (!job) {
      return c.json({ error: { code: 'JOB_NOT_FOUND', message: 'Job not found' } }, 404);
    }

    if (accept.includes('text/event-stream')) {
      return new Response(
        new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            const send = (event: string, data: unknown): void => {
              controller.enqueue(
                encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
              );
            };

            job.onProgress = (progress: GenerationProgress) => send('progress', progress);
            job.onComplete = (result: GenerationResult) => {
              send('completed', { jobId: job.id, result });
              controller.close();
            };
            job.onFail = (error: MapGenError) => {
              send('failed', { jobId: job.id, error });
              controller.close();
            };

            if (job.status === 'completed' && job.result) {
              job.onComplete(job.result);
            } else if (job.status === 'failed' && job.error) {
              job.onFail(job.error);
            }
          },
        }),
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        }
      );
    }

    return c.json({
      jobId: job.id,
      status: job.status,
      progress: { jobId: job.id, phase: job.phase, fraction: job.progress, phaseLabel: job.phase },
      result: job.result,
      error: job.error,
    });
  });

  return app;
}
