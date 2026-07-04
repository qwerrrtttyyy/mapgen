/// <reference lib="webworker" />

import { generateMap, type MapParams } from '@mapgen/core';

interface WorkerMessage {
  type: 'generate' | 'cancel';
  requestId: number;
  params?: MapParams;
}

let isGenerating = false;

function postProgress(requestId: number, progress: number, phase: string): void {
  self.postMessage({ type: 'progress', requestId, progress, phase });
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  if (msg.type === 'cancel') {
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

    try {
      const result = generateMap(msg.params, (progress, phase) => {
        if (!isGenerating) return;
        postProgress(msg.requestId, progress, phase);
      });

      if (!isGenerating) return;

      const { mapData, checkpoints } = result;

      const transferables: Transferable[] = [];
      const addBuf = (arr: ArrayBufferView | undefined) => {
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
      if (!isGenerating) return;
      self.postMessage({
        type: 'error',
        requestId: msg.requestId,
        message: (err as Error).message,
      });
    } finally {
      isGenerating = false;
    }
  }
};

self.postMessage({ type: 'ready' });
