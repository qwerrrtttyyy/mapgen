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
  progressHistory: GenerationProgress[];
  onProgress?: (progress: GenerationProgress) => void;
  onComplete?: (result: GenerationResult) => void;
  onFail?: (error: MapGenError) => void;
}

export interface JobQueueOptions {
  maxConcurrent?: number;
  maxHistory?: number;
}

class JobQueue {
  private jobs = new Map<string, Job>();
  private queue: string[] = [];
  private activeCount = 0;
  private maxConcurrent: number;
  private maxHistory: number;
  private executor?: (job: Job) => void | Promise<void>;

  constructor(options: JobQueueOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 1;
    this.maxHistory = options.maxHistory ?? 100;
  }

  create(params: MapParams): string {
    const id = randomUUID();
    const job: Job = {
      id,
      status: 'queued',
      params,
      progress: 0,
      phase: 'queued',
      createdAt: Date.now(),
      progressHistory: [],
    };
    this.jobs.set(id, job);
    this.queue.push(id);
    this.cleanupOldJobs();
    // Defer execution so the HTTP handler can return jobId before
    // the executor starts (fixes SSE progress events never arriving).
    if (this.activeCount === 0) {
      setImmediate(() => this.process());
    }
    return id;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  setExecutor(executor: (job: Job) => void | Promise<void>): void {
    this.executor = executor;
  }

  getStats(): { queued: number; running: number; completed: number; failed: number } {
    let queued = 0;
    let running = 0;
    let completed = 0;
    let failed = 0;
    for (const job of this.jobs.values()) {
      switch (job.status) {
        case 'queued':
          queued++;
          break;
        case 'running':
          running++;
          break;
        case 'completed':
          completed++;
          break;
        case 'failed':
          failed++;
          break;
      }
    }
    return { queued, running, completed, failed };
  }

  private async process(): Promise<void> {
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const id = this.queue.shift();
      if (!id) continue;
      const job = this.jobs.get(id);
      if (!job) continue;
      job.status = 'running';
      this.activeCount++;
      await this.executeJob(job);
    }
  }

  private async executeJob(job: Job): Promise<void> {
    try {
      if (this.executor) {
        await this.executor(job);
      }
    } catch (e) {
      if (job.status !== 'failed') {
        job.status = 'failed';
        job.error = { code: 'GENERATION_FAILED', message: String(e) };
        job.completedAt = Date.now();
        if (job.onFail) job.onFail(job.error);
      }
    } finally {
      this.activeCount--;
      void this.process();
    }
  }

  private cleanupOldJobs(): void {
    if (this.jobs.size <= this.maxHistory) return;

    const completedJobs: Job[] = [];
    for (const job of this.jobs.values()) {
      if (job.status === 'completed' || job.status === 'failed') {
        completedJobs.push(job);
      }
    }

    completedJobs.sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));
    const toRemove = completedJobs.slice(
      0,
      completedJobs.length - this.maxHistory + this.jobs.size - this.maxHistory
    );
    for (const job of toRemove) {
      this.jobs.delete(job);
    }
  }
}

export const jobQueue = new JobQueue({ maxConcurrent: 2, maxHistory: 200 });
