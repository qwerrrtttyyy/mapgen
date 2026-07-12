import { state } from '../core/appState.js';

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
  // Inverse of the GPU stretch formula.
  const nx = (cx / rect.width - 0.5) / zoom - panX + 0.5;
  const mapV = (cy / rect.height - 0.5) / zoom - panY + 0.5;
  if (nx < 0 || nx > 1 || mapV < 0 || mapV > 1) return null;
  return { nx, ny: 1 - mapV };
}

export function mapUvToClient(
  nx: number,
  ny: number,
  rect: DOMRect,
  _mapW: number,
  _mapH: number
): [number, number] {
  const { zoom, panX, panY } = state;
  const mapV = 1 - ny;
  // Match GPU stretch formula: each axis fills [0,1] independently.
  const sx = ((nx - 0.5 + panX) * zoom + 0.5) * rect.width;
  const sy = ((mapV - 0.5 + panY) * zoom + 0.5) * rect.height;
  return [rect.left + sx, rect.top + sy];
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
