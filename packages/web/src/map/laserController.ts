import { bus } from '../core/eventBus.js';
import { setParam, selectPlate } from '../core/actions.js';
import { state } from '../core/appState.js';
import type { MapPicker, PickerResult } from './picker.js';

export type LaserMode = 'pointer' | 'selection';

export interface LaserSelectResult {
  plates: number[];
  cells: number[];
}

function clientToUv(clientX: number, clientY: number, canvas: HTMLCanvasElement): { nx: number; ny: number } | null {
  const rect = canvas.getBoundingClientRect();
  const cx = clientX - rect.left;
  const cy = clientY - rect.top;
  const { mapData } = state;
  if (!mapData) return null;
  const { width, height } = mapData;
  const scale = Math.min(rect.width / width, rect.height / height);
  const dW = width * scale;
  const dH = height * scale;
  const ox = (rect.width - dW) / 2;
  const oy = (rect.height - dH) / 2;
  const nx = (cx - ox) / dW;
  const ny = 1.0 - (cy - oy) / dH;
  if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
  return { nx, ny };
}

export class LaserController {
  private canvas: HTMLCanvasElement;
  private mode: LaserMode = 'pointer';
  private dragging = false;
  private rafId: number | null = null;
  private pending: { x: number; y: number } | null = null;
  private rafScheduled = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const down = (e: MouseEvent) => this.handleDown(e);
    const move = (e: MouseEvent) => this.handleMove(e);
    const up = () => this.handleUp();

    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    bus.on('laser.toggle', () => this.toggle());
    bus.on('laser.mode.set', (m: LaserMode) => this.setMode(m));
  }

  setMode(m: LaserMode): void {
    this.mode = m;
    setParam('laserActive', true);
    const radio = document.querySelector<HTMLInputElement>(`input[name="laserMode"][value="${m}"]`);
    if (radio) radio.checked = true;
    bus.emit('render.request');
  }

  toggle(): void {
    const next = !state.params.laserActive;
    setParam('laserActive', next);
    const el = document.getElementById('laserActive') as HTMLInputElement | null;
    if (el) el.checked = next;
    if (next) this.mode = state.params.laserSelection ? 'selection' : 'pointer';
    bus.emit('render.request');
  }

  private updatePos(clientX: number, clientY: number): { nx: number; ny: number } | null {
    const uv = clientToUv(clientX, clientY, this.canvas);
    if (!uv) return null;
    if (this.dragging) setParam('laserEnd', [uv.nx, uv.ny]);
    else setParam('laserStart', [uv.nx, uv.ny]);
    return uv;
  }

  private handleDown(e: MouseEvent): void {
    if (!state.params.laserActive) return;
    e.preventDefault();
    this.dragging = true;
    this.updatePos(e.clientX, e.clientY);
    this.scheduleRender();
  }

  private handleMove(e: MouseEvent): void {
    if (!state.params.laserActive) return;
    this.pending = { x: e.clientX, y: e.clientY };
    if (!this.rafScheduled) {
      this.rafScheduled = true;
      this.rafId = requestAnimationFrame(() => this.flush());
    }
  }

  private flush(): void {
    this.rafScheduled = false;
    if (!this.pending) return;
    const { x, y } = this.pending;
    this.pending = null;
    this.updatePos(x, y);
    this.scheduleRender();
  }

  private handleUp(): void {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.mode === 'selection') this.commitSelection();
  }

  private scheduleRender(): void {
    bus.emit('render.request');
  }

  private commitSelection(): void {
    const [ax, ay] = state.params.laserStart;
    const [bx, by] = state.params.laserEnd;
    const minX = Math.min(ax, bx);
    const maxX = Math.max(ax, bx);
    const minY = Math.min(ay, by);
    const maxY = Math.max(ay, by);
    if (maxX - minX < 0.005 && maxY - minY < 0.005) return;
    const { mapData } = state;
    if (!mapData) return;
    const { width, height } = mapData;
    const plates = new Set<number>();
    for (let y = 0; y < height; y++) {
      const ny = 1 - y / height;
      if (ny < minY || ny > maxY) continue;
      for (let x = 0; x < width; x++) {
        const nx = x / width;
        if (nx < minX || nx > maxX) continue;
        const i = y * width + x;
        const pid = (mapData.plateTex[i * 4] || 0) * mapData.plates.length;
        plates.add(Math.round(pid));
      }
    }
    if (plates.size === 0) return;
    state.selectedPlates.clear();
    plates.forEach(p => state.selectedPlates.add(p));
    bus.emit('selection.changed', { plates: Array.from(state.selectedPlates), regions: Array.from(state.selectedRegions) });
    bus.emit('laser.selection.done', { plates: Array.from(plates) });
  }

  destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }
}
