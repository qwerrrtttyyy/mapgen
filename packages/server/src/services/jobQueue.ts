import { randomUUID } from 'node:crypto';
import type { MapParams, GenerationResult, GenerationProgress, MapGenError } from '@mapgen/shared-types';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface Job {
  id: string;
  status: JobStatus;
  params: MapParams;
  progress: number;
  phase: string;
  result?: GenerationResult;
  error?: MapGenError;
  createdAt: number;
  completedAt?: number;
  onProgress?: (progress: GenerationProgress) => void;
  onComplete?: (result: GenerationResult) => void;
  onFail?: (error: MapGenError) => void;
}

class JobQueue {
  private jobs = new Map<string, Job>();
  private queue: string[] = [];
  private running = false;
  private executor?: (job: Job) => Promise<void>;

  create(params: MapParams): string {
    const id = randomUUID();
    const job: Job = {
      id,
      status: 'queued',
      params,
      progress: 0,
      phase: 'queued',
      createdAt: Date.now(),
    };
    this.jobs.set(id, job);
    this.queue.push(id);
    this.process();
    return id;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  setExecutor(executor: (job: Job) => Promise<void>): void {
    this.executor = executor;
  }

  private async process(): Promise<void> {
    if (this.running) return;
    this.running = true;
    while (this.queue.length > 0) {
      const id = this.queue.shift()!;
      const job = this.jobs.get(id);
      if (!job) continue;
      job.status = 'running';
      if (this.executor) {
        await this.executor(job);
      }
    }
    this.running = false;
  }
}

export const jobQueue = new JobQueue();
