import { generateMap, NoiseCache } from '@mapgen/core';
import type { WorkerRequest, WorkerResponse } from './messages.js';

interface WorkerCtx {
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (e: { data: WorkerRequest }) => void): void;
}

const ctx = self as unknown as WorkerCtx;

let currentId: number | null = null;
// 跨多次生成复用噪声引擎，相同种子重复生成时省去排列表重建
const noiseCache = new NoiseCache();

ctx.addEventListener('message', (e: { data: WorkerRequest }) => {
  const req = e.data;
  if (req.type === 'generate') {
    currentId = req.id;
    try {
      const { mapData } = generateMap(req.params, (progress, phaseName) => {
        if (currentId !== req.id) return;
        ctx.postMessage({ type: 'progress', id: req.id, progress, phaseName } as WorkerResponse);
      }, noiseCache);
      if (currentId !== req.id) return;
      const transferable = [
        mapData.plateTex.buffer, mapData.elevTex.buffer, mapData.moistTex.buffer,
        mapData.riverTex.buffer, mapData.tempTex.buffer,
      ];
      ctx.postMessage({ type: 'complete', id: req.id, mapData } as WorkerResponse, transferable);
    } catch (err) {
      ctx.postMessage({ type: 'error', id: req.id, message: String(err) } as WorkerResponse);
    }
  } else if (req.type === 'abort') {
    if (currentId === req.id) currentId = null;
  }
});
