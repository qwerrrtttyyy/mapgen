import { state } from '../core/appState.js';

export interface Viewport {
  baseScale: number;
  dW: number;
  dH: number;
  centerX: number;
  centerY: number;
}

export function getViewport(rect: DOMRect, mapW: number, mapH: number): Viewport {
  const baseScale = Math.min(rect.width / mapW, rect.height / mapH);
  return {
    baseScale,
    dW: mapW * baseScale,
    dH: mapH * baseScale,
    centerX: rect.width / 2,
    centerY: rect.height / 2,
  };
}

export function clientToMapUv(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  _mapW: number,
  _mapH: number
): { nx: number; ny: number } | null {
  const cx = clientX - rect.left;
  const cy = clientY - rect.top;
  const { zoom, panX, panY } = state;
  const mapU = (cx / rect.width - 0.5) / zoom - panX + 0.5;
  const mapV = (cy / rect.height - 0.5) / zoom - panY + 0.5;
  if (mapU < 0 || mapU > 1 || mapV < 0 || mapV > 1) return null;
  return { nx: mapU, ny: 1 - mapV };
}

export function mapUvToClient(
  nx: number,
  ny: number,
  rect: DOMRect,
  mapW: number,
  mapH: number
): [number, number] {
  const { dW, dH, centerX, centerY } = getViewport(rect, mapW, mapH);
  const { zoom, panX, panY } = state;
  const mapV = 1 - ny;
  const sx = centerX + (nx - 0.5 + panX) * zoom * dW;
  const sy = centerY + (mapV - 0.5 + panY) * zoom * dH;
  return [sx, sy];
}

export function mapPixelToClient(
  mx: number,
  my: number,
  rect: DOMRect,
  mapW: number,
  mapH: number
): [number, number] {
  return mapUvToClient(mx / mapW, my / mapH, rect, mapW, mapH);
}
