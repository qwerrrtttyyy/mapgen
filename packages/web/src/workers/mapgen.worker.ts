/// <reference lib="webworker" />

import { generateMap, type MapParams } from '@mapgen/core';

interface WorkerMessage {
  type: 'generate' | 'cancel';
  requestId: number;
  params?: MapParams;
}

let isGenerating = false;
// 模块级取消信号引用，使 cancel 消息能中止进行中的生成任务。
let currentCancelSignal: CancelSignal | null = null;

function postProgress(requestId: number, progress: number, phase: string): void {
  self.postMessage({ type: 'progress', requestId, progress, phase });
}

// 每个生成任务独立的取消信号，通过 MapParams.cancelSignal 注入 generateMap。
// 避免模块级 flag 在并发/重入场景下的竞态。
type CancelSignal = { aborted: boolean };

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  if (msg.type === 'cancel') {
    // 设置当前任务的取消信号，使 generateMap 在阶段边界尽早中止。
    if (currentCancelSignal) {
      currentCancelSignal.aborted = true;
    }
    isGenerating = false;
    return;
  }

  if (msg.type === 'generate') {
    if (isGenerating) {
      self.postMessage({ type: 'error', requestId: msg.requestId, message: 'Already generating' });
      return;
    }
    if (!msg.params) {
      self.postMessage({ type: 'error', requestId: msg.requestId, message: 'Missing params' });
      return;
    }

    isGenerating = true;

    // 创建取消信号并注入 params，使 generateMap 在阶段边界尽早响应取消。
    const cancelSignal: CancelSignal = { aborted: false };
    currentCancelSignal = cancelSignal;
    // cast 绕过 MapParams 类型检查 —— cancelSignal 在运行时始终存在
    const params = { ...msg.params, cancelSignal } as MapParams;

    try {
      const result = generateMap(params, (progress, phase) => {
        if (!isGenerating) return;
        postProgress(msg.requestId, progress, phase);
      });

      const { mapData, checkpoints } = result;

      const transferables: Transferable[] = [];
      const addBuf = (arr: ArrayBufferView | undefined): void => {
        if (arr && arr.buffer) transferables.push(arr.buffer);
      };

      addBuf(mapData.plateTex);
      addBuf(mapData.elevTex);
      addBuf(mapData.moistTex);
      addBuf(mapData.riverTex);
      addBuf(mapData.tempTex);
      addBuf(mapData.currentTex);
      addBuf(mapData.iceTex);
      addBuf(mapData.coastDist);
      addBuf(mapData.biomeTex);
      addBuf(mapData.watershedTex);
      addBuf(mapData.volcanismTex);
      addBuf(mapData.seasonTex);

      const cpTectonic = checkpoints.tectonic as Record<string, unknown> | undefined;
      if (cpTectonic) {
        addBuf(cpTectonic.plateId as Float32Array);
        addBuf(cpTectonic.plateDist as Float32Array);
        addBuf(cpTectonic.boundary as Float32Array);
      }
      const cpElev = checkpoints.elevation as Record<string, unknown> | undefined;
      if (cpElev) {
        addBuf(cpElev.elevation as Float32Array);
        addBuf(cpElev.slope as Float32Array);
        addBuf(cpElev.ridge as Float32Array);
        addBuf(cpElev.ridgeMask as Float32Array);
      }
      const cpErosion = checkpoints.erosion as Record<string, unknown> | undefined;
      if (cpErosion) {
        addBuf(cpErosion.elevation as Float32Array);
      }
      const cpClimate = checkpoints.climate as Record<string, unknown> | undefined;
      if (cpClimate) {
        addBuf(cpClimate.temperature as Float32Array);
        addBuf(cpClimate.tempZone as Float32Array);
        addBuf(cpClimate.moisture as Float32Array);
        addBuf(cpClimate.rainfall as Float32Array);
      }
      const cpRivers = checkpoints.rivers as Record<string, unknown> | undefined;
      if (cpRivers) {
        addBuf(cpRivers.riverMask as Float32Array);
        addBuf(cpRivers.riverWidth as Float32Array);
        addBuf(cpRivers.riverDepth as Float32Array);
        addBuf(cpRivers.lakes as Float32Array);
      }

      self.postMessage(
        { type: 'complete', requestId: msg.requestId, mapData, checkpoints },
        { transfer: transferables }
      );
    } catch (err) {
      // 始终发送错误消息：取消引发的中止也返回 Cancelled 错误，
      // 避免 Promise 永久挂起（原代码在取消后同时跳过 complete 与 error 路径）。
      self.postMessage({
        type: 'error',
        requestId: msg.requestId,
        message: isGenerating ? (err as Error).message : 'Cancelled',
      });
    } finally {
      isGenerating = false;
      currentCancelSignal = null;
    }
  }
};

self.postMessage({ type: 'ready' });
