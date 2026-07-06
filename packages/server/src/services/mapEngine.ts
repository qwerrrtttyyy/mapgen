import { generateMap } from '@mapgen/core';
import { serializeMapData } from '@mapgen/shared-types';
import type { Job } from './jobQueue.js';

export async function executeGenerationJob(job: Job): Promise<void> {
  try {
    const { mapData, checkpoints } = generateMap(job.params, (progress, phaseName) => {
      job.progress = progress;
      job.phase = phaseName;
      if (job.onProgress) {
        job.onProgress({ jobId: job.id, phase: phaseName, fraction: progress, phaseLabel: phaseName });
      }
    });

    job.result = {
      jobId: job.id,
      mapData: serializeMapData(mapData),
      checkpoints,
    };
    job.status = 'completed';
    job.completedAt = Date.now();
    if (job.onComplete) job.onComplete(job.result);
  } catch (e) {
    job.status = 'failed';
    job.error = { code: 'GENERATION_FAILED', message: String(e) };
    job.completedAt = Date.now();
    if (job.onFail) job.onFail(job.error);
  }
}
