import { state } from '../core/appState.js';

export function clientToMapUv(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): { nx: number; ny: number } | null {
  const cx = clientX - rect.left;
  const cy = clientY - rect.top;
  const { zoom, panX, panY } = state;
  const mapU = (cx / rect.width - 0.5) / zoom - panX + 0.5;
  const mapV = (cy / rect.height - 0.5) / zoom - panY + 0.5;
  const nx = mapU;
  const ny = 1 - mapV;
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
  return { nx, ny };
}

export function mapUvToClient(
  nx: number,
  ny: number,
  rect: DOMRect,
): [number, number] {
  const { zoom, panX, panY } = state;
  const mapV = 1 - ny;
  const v_uy = (mapV - 0.5 + panY) * zoom + 0.5;
  const v_ux = (nx - 0.5 + panX) * zoom + 0.5;
  const sx = v_ux * rect.width;
  const sy = v_uy * rect.height;
  return [sx, sy];
}

export function mapPixelToClient(
  mx: number,
  my: number,
  rect: DOMRect,
  mapW: number,
  mapH: number,
): [number, number] {
  return mapUvToClient(mx / mapW, my / mapH, rect);
}
