import { randomUUID } from 'node:crypto';
import type {
  MapParams,
  GenerationResult,
  GenerationProgress,
  MapGenError,
} from '@mapgen/shared-types';

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
  private executor?: (job: Job) => void | Promise<void>;

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
    if (!this.running) {
      this.running = true;
      setImmediate(() => this.processAll());
    }
    return id;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  setExecutor(executor: (job: Job) => void | Promise<void>): void {
    this.executor = executor;
  }

  private async processAll(): Promise<void> {
    while (this.queue.length > 0) {
      const id = this.queue.shift();
      if (!id) continue;
      const job = this.jobs.get(id);
      if (!job) continue;
      job.status = 'running';
      if (this.executor) {
        try {
          await this.executor(job);
        } catch (err) {
          job.status = 'failed';
          job.error = { code: 'GENERATION_FAILED', message: String(err) };
          job.completedAt = Date.now();
        }
      }
    }
    this.running = false;
  }
}

export const jobQueue = new JobQueue();
