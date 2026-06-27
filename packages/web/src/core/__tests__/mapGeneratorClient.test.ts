import { describe, it, expect, vi } from 'vitest';
import { MapGeneratorClient } from '../mapGeneratorClient.js';

type Listener = (e: any) => void;

function createMockWorker() {
  const listeners: Record<string, Listener[]> = {};
  const postMessage = vi.fn();
  const terminate = vi.fn();
  const worker = {
    addEventListener: vi.fn((type: string, cb: Listener) => {
      (listeners[type] ||= []).push(cb);
    }),
    removeEventListener: vi.fn(),
    postMessage,
    terminate,
    dispatch(type: string, event: any) {
      (listeners[type] || []).forEach(cb => cb(event));
    },
  };
  return { worker, listeners, postMessage, terminate };
}

describe('MapGeneratorClient', () => {
  it('rejects pending promise when Worker emits an error event', async () => {
    vi.stubGlobal('Worker', vi.fn(() => createMockWorker().worker));
    const { worker } = createMockWorker();
    vi.stubGlobal('Worker', vi.fn(() => worker));

    const client = new MapGeneratorClient('mock-url');
    const promise = client.generate({} as any);

    // 模拟 Worker 加载失败
    worker.dispatch('error', new Event('error'));

    await expect(promise).rejects.toThrow();
    client.destroy();
    vi.unstubAllGlobals();
  });

  it('rejects pending promise when Worker emits a messageerror event', async () => {
    const { worker } = createMockWorker();
    vi.stubGlobal('Worker', vi.fn(() => worker));

    const client = new MapGeneratorClient('mock-url');
    const promise = client.generate({} as any);

    worker.dispatch('messageerror', { data: {} });

    await expect(promise).rejects.toThrow();
    client.destroy();
    vi.unstubAllGlobals();
  });

  it('resolves with mapData on complete message', async () => {
    const { worker } = createMockWorker();
    vi.stubGlobal('Worker', vi.fn(() => worker));

    const client = new MapGeneratorClient('mock-url');
    const mapData = { width: 1, height: 1 } as any;
    const promise = client.generate({} as any);

    const id = (worker.addEventListener as any).mock.calls
      .filter((c: any[]) => c[0] === 'message')[0]?.[1];

    // postMessage should have been called with an id
    const call = (worker as any).postMessage.mock.calls[0][0];
    worker.dispatch('message', { data: { type: 'complete', id: call.id, mapData } });

    await expect(promise).resolves.toEqual(mapData);
    client.destroy();
    vi.unstubAllGlobals();
  });

  it('forwards progress callbacks', async () => {
    const { worker } = createMockWorker();
    vi.stubGlobal('Worker', vi.fn(() => worker));

    const client = new MapGeneratorClient('mock-url');
    const onProgress = vi.fn();
    const promise = client.generate({} as any, onProgress);

    const call = (worker as any).postMessage.mock.calls[0][0];
    worker.dispatch('message', { data: { type: 'progress', id: call.id, progress: 0.5, phaseName: 'erosion' } });

    expect(onProgress).toHaveBeenCalledWith(0.5, 'erosion');

    // resolve to clean up
    worker.dispatch('message', { data: { type: 'complete', id: call.id, mapData: {} as any } });
    await promise;
    client.destroy();
    vi.unstubAllGlobals();
  });

  it('terminates worker and clears pending on destroy', () => {
    const { worker, terminate } = createMockWorker();
    vi.stubGlobal('Worker', vi.fn(() => worker));

    const client = new MapGeneratorClient('mock-url');
    client.generate({} as any);

    client.destroy();

    expect(terminate).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
