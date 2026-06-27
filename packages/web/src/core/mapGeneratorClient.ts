import type { MapParams, MapData } from '@mapgen/core';
import type { WorkerRequest, WorkerResponse } from '../worker/messages.js';

export class MapGeneratorClient {
  private worker: Worker;
  private id = 0;
  private pending = new Map<number, {
    resolve: (data: MapData) => void;
    reject: (err: Error) => void;
    onProgress?: (p: number, phase: string) => void;
  }>();

  constructor(workerUrl: string | URL) {
    this.worker = new Worker(workerUrl, { type: 'module' });
    this.worker.addEventListener('message', (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      const p = this.pending.get(msg.id);
      if (!p) return;
      if (msg.type === 'progress') p.onProgress?.(msg.progress, msg.phaseName);
      else if (msg.type === 'complete') {
        this.pending.delete(msg.id);
        p.resolve(msg.mapData);
      } else if (msg.type === 'error') {
        this.pending.delete(msg.id);
        p.reject(new Error(msg.message));
      }
    });
    // Worker 加载失败或未捕获异常时，拒绝所有挂起的请求
    this.worker.addEventListener('error', (e: ErrorEvent) => {
      const err = new Error(e.message || 'Worker error');
      this.rejectAll(err);
    });
    // Worker 收到无法反序列化的消息时触发
    this.worker.addEventListener('messageerror', () => {
      this.rejectAll(new Error('Worker message deserialization failed'));
    });
  }

  private rejectAll(err: Error): void {
    for (const [, p] of this.pending) p.reject(err);
    this.pending.clear();
  }

  generate(params: MapParams, onProgress?: (p: number, phase: string) => void): Promise<MapData> {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress });
      this.worker.postMessage({ type: 'generate', params, id } as WorkerRequest);
    });
  }

  abort(id: number): void {
    this.worker.postMessage({ type: 'abort', id } as WorkerRequest);
  }

  destroy(): void {
    this.worker.terminate();
    this.pending.clear();
  }
}
