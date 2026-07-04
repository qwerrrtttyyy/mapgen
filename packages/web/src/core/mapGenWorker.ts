import { generateMap, type MapParams, type MapData, type ProgressCallback } from '@mapgen/core';

type GenerateResult = { mapData: MapData; checkpoints: Record<string, unknown> };

interface PendingRequest {
  params: MapParams;
  resolve: (value: GenerateResult) => void;
  reject: (reason: string) => void;
  onProgress: ProgressCallback | null;
}

class MapGenWorkerManager {
  private worker: Worker | null = null;
  private pending = new Map<number, PendingRequest>();
  private queued: PendingRequest[] = [];
  private nextRequestId = 1;
  private workerReady = false;
  private initError: string | null = null;

  private ensureWorker(): boolean {
    if (this.initError) return false;
    if (this.worker) return true;

    try {
      this.worker = new Worker(
        new URL('../workers/mapgen.worker.ts', import.meta.url),
        { type: 'module' }
      );
      this.worker.onmessage = (e: MessageEvent) => this.handleMessage(e.data);
      this.worker.onerror = (e: ErrorEvent) => {
        this.initError = e.message;
        this.failAll(e.message);
        this.destroyWorker();
      };
      return true;
    } catch {
      this.initError = 'Worker not supported';
      return false;
    }
  }

  private handleMessage(msg: {
    type: 'ready' | 'progress' | 'complete' | 'error';
    requestId?: number;
    progress?: number;
    phase?: string;
    mapData?: MapData;
    checkpoints?: Record<string, unknown>;
    message?: string;
  }): void {
    if (msg.type === 'ready') {
      this.workerReady = true;
      this.flushQueue();
      return;
    }

    const rid = msg.requestId;
    if (rid === undefined) return;
    const req = this.pending.get(rid);
    if (!req) return;

    if (msg.type === 'progress') {
      if (req.onProgress && msg.progress !== undefined && msg.phase) {
        req.onProgress(msg.progress, msg.phase);
      }
    } else if (msg.type === 'complete' && msg.mapData && msg.checkpoints) {
      req.resolve({ mapData: msg.mapData, checkpoints: msg.checkpoints });
      this.pending.delete(rid);
    } else if (msg.type === 'error') {
      req.reject(msg.message || 'Unknown worker error');
      this.pending.delete(rid);
    }
  }

  private flushQueue(): void {
    if (!this.worker || !this.workerReady) return;
    while (this.queued.length > 0) {
      const req = this.queued.shift()!;
      this.sendToWorker(req);
    }
  }

  private sendToWorker(req: PendingRequest): number {
    const requestId = this.nextRequestId++;
    this.pending.set(requestId, req);
    this.worker!.postMessage({ type: 'generate', requestId, params: req.params });
    return requestId;
  }

  private failAll(reason: string): void {
    for (const [, req] of this.pending) req.reject(reason);
    this.pending.clear();
    for (const req of this.queued) req.reject(reason);
    this.queued = [];
  }

  private destroyWorker(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.workerReady = false;
  }

  generate(params: MapParams, onProgress?: ProgressCallback): Promise<GenerateResult> {
    return new Promise((resolve, reject) => {
      const runSync = () => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            try {
              const result = generateMap(params, onProgress);
              resolve(result);
            } catch (err) {
              reject((err as Error).message);
            }
          }, 0);
        });
      };

      if (!this.ensureWorker()) {
        runSync();
        return;
      }

      const req: PendingRequest = {
        params,
        resolve,
        reject: (msg: string) => {
          this.destroyWorker();
          this.initError = null;
          this.ensureWorker();
          runSync();
        },
        onProgress: onProgress || null,
      };

      if (this.workerReady) {
        this.sendToWorker(req);
      } else {
        this.queued.push(req);
      }
    });
  }

  cancel(): void {
    if (this.worker) {
      for (const [requestId] of this.pending) {
        this.worker.postMessage({ type: 'cancel', requestId });
      }
    }
  }
}

export const mapGenWorker = new MapGenWorkerManager();
