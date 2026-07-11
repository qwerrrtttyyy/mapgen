import type { MapData } from '@mapgen/core';
import { clientToMapUv } from './viewport.js';

export interface PickerResult {
  index: number;
  x: number;
  y: number;
  nx: number;
  ny: number;
  elevation: number;
  moisture: number;
  temperature: number;
  rainfall: number;
  plateId: number;
  regionId: number;
  biome: number;
}

export class MapPicker {
  constructor(private mapData: MapData) {}

  pick(clientX: number, clientY: number, canvas: HTMLCanvasElement): PickerResult | null {
    const rect = canvas.getBoundingClientRect();
    const { width, height } = this.mapData;
    const uv = clientToMapUv(clientX, clientY, rect);
    if (!uv) return null;
    const { nx, ny } = uv;

    const x = Math.floor(nx * (width - 1));
    const y = Math.floor(ny * (height - 1));
    const idx = y * width + x;
    const i4 = idx * 4;

    return {
      index: idx,
      x,
      y,
      nx,
      ny,
      elevation: this.mapData.elevTex[i4],
      moisture: this.mapData.moistTex[i4],
      temperature: this.mapData.moistTex[i4 + 2],
      rainfall: this.mapData.moistTex[i4 + 1],
      plateId: Math.max(
        0,
        Math.min(
          this.mapData.plates.length - 1,
          Math.round(this.mapData.plateTex[i4] * this.mapData.plates.length)
        )
      ),
      regionId: -1,
      biome: Math.floor(this.mapData.tempTex[i4 + 2] * 8),
    };
  }
}
