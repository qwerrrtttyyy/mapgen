import { state } from '../core/appState.js';

let _dirty = true;

/** 标记小地图需要重绘（地图数据变化时调用） */
export function markMinimapDirty(): void {
  _dirty = true;
}

/**
 * 在小地图 canvas 上绘制地形缩略图
 * 仅在 dirty 时重绘，避免每帧开销
 */
export function drawMinimap(ctx: CanvasRenderingContext2D | null): void {
  if (!ctx || !state.mapData || !_dirty) return;
  _dirty = false;
  const md = state.mapData;
  const canvas = ctx.canvas;
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;
  const elev = md.elevTex;
  const seaLevel = state.params.seaLevel;
  const snowLine = state.params.snowLine;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.floor((x / w) * md.width);
      const sy = Math.floor((y / h) * md.height);
      const si = (sy * md.width + sx) * 4;
      const e = elev[si];
      const di = (y * w + x) * 4;

      let r: number, g: number, b: number;
      if (e < seaLevel - 0.15) {
        r = 20;
        g = 50;
        b = 100;
      } else if (e < seaLevel) {
        r = 40;
        g = 80;
        b = 140;
      } else if (e < seaLevel + 0.05) {
        r = 194;
        g = 178;
        b = 128;
      } else if (e < snowLine - 0.1) {
        r = 60;
        g = 120;
        b = 50;
      } else if (e < snowLine) {
        r = 100;
        g = 90;
        b = 70;
      } else {
        r = 240;
        g = 245;
        b = 255;
      }

      data[di] = r;
      data[di + 1] = g;
      data[di + 2] = b;
      data[di + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}
