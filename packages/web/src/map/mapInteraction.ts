import { bus } from '../core/eventBus.js';
import { state } from '../core/appState.js';
import { selectPlate, setHover, setParam } from '../core/actions.js';
import { MapPicker, type PickerResult } from './picker.js';
import { Tooltip } from '../ui/tooltip.js';
import { LaserController } from './laserController.js';

const biomeNames = [
  '海洋', '雪线高山', '高山', '沙漠', '湿地', '森林', '苔原', '平原'
];

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

export class MapInteraction {
  private canvas: HTMLCanvasElement;
  private tooltip: Tooltip;
  private picker: MapPicker | null = null;
  private laser: LaserController;
  private trailCtx: CanvasRenderingContext2D | null = null;
  private trailCanvas: HTMLCanvasElement | null = null;
  private trailDecayTimer: number | null = null;
  private moveRafScheduled = false;
  private pendingMove: { x: number; y: number } | null = null;
  private unsub: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.tooltip = new Tooltip();
    this.laser = new LaserController(canvas);

    const move = (e: MouseEvent) => this.scheduleMove(e);
    const click = (e: MouseEvent) => this.handleClick(e);
    const leave = () => this.handleLeave();
    const context = (e: MouseEvent) => { e.preventDefault(); this.handleContext(e); };

    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('click', click);
    canvas.addEventListener('mouseleave', leave);
    canvas.addEventListener('contextmenu', context);

    this.unsub.push(
      () => canvas.removeEventListener('mousemove', move),
      () => canvas.removeEventListener('click', click),
      () => canvas.removeEventListener('mouseleave', leave),
      () => canvas.removeEventListener('contextmenu', context),
      bus.on('generating.completed', () => this.setMapData(state.mapData))
    );
  }

  setMapData(data: typeof state.mapData): void {
    if (!data) { this.picker = null; return; }
    this.picker = new MapPicker(data);
  }

  private scheduleMove(e: MouseEvent): void {
    this.pendingMove = { x: e.clientX, y: e.clientY };
    if (this.moveRafScheduled) return;
    this.moveRafScheduled = true;
    requestAnimationFrame(() => this.flushMove());
  }

  private flushMove(): void {
    this.moveRafScheduled = false;
    if (!this.pendingMove) return;
    const { x, y } = this.pendingMove;
    this.pendingMove = null;
    this.handleMove(x, y);
  }

  private handleMove(clientX: number, clientY: number): void {
    if (state.params.cursorActive) {
      const uv = clientToUv(clientX, clientY, this.canvas);
      if (uv) {
        setParam('cursorPos', [uv.nx, uv.ny]);
        bus.emit('render.request');
      }
    }

    if (state.params.trailEnabled) {
      this.addTrailPoint(clientX, clientY);
    }

    if (!this.picker) return;
    const p = this.picker.pick(clientX, clientY, this.canvas);
    if (!p) {
      setHover(-1);
      this.tooltip.hide();
      return;
    }
    setHover(p.index);
    this.tooltip.show(this.format(p), clientX, clientY);
  }

  private lastClickPlateId = -1;

  private handleClick(e: MouseEvent): void {
    if (!this.picker) return;
    const p = this.picker.pick(e.clientX, e.clientY, this.canvas);
    if (!p) return;

    if (this.tooltip.isPinned()) {
      this.tooltip.unpin();
      return;
    }

    const add = e.ctrlKey || e.metaKey;
    const range = e.shiftKey && this.lastClickPlateId >= 0;
    if (range) {
      this.selectPlateRange(this.lastClickPlateId, p.plateId);
    } else {
      selectPlate(p.plateId, add);
      this.lastClickPlateId = p.plateId;
    }
    this.tooltip.togglePin(this.format(p, true), e.clientX, e.clientY);
  }

  private selectPlateRange(from: number, to: number): void {
    const min = Math.min(from, to);
    const max = Math.max(from, to);
    for (let i = min; i <= max; i++) {
      selectPlate(i, true);
    }
  }

  private handleLeave(): void {
    setHover(-1);
    this.tooltip.hide();
  }

  private handleContext(e: MouseEvent): void {
    bus.emit('map.contextmenu', { x: e.clientX, y: e.clientY });
  }

  private format(p: PickerResult, includePlate = false): string[] {
    const elevPct = Math.round(p.elevation * 100);
    const lines = [
      `坐标: (${p.x}, ${p.y})`,
      `海拔: ${elevPct}%`,
      `温度: ${(p.temperature * 100).toFixed(0)}%`,
      `湿度: ${(p.moisture * 100).toFixed(0)}%`,
      `降雨: ${(p.rainfall * 100).toFixed(0)}%`,
      `生物群系: ${biomeNames[p.biome] ?? '未知'}`,
    ];
    if (includePlate) lines.push(`板块: #${p.plateId}`);
    return lines;
  }

  private ensureTrailCanvas(): void {
    if (this.trailCanvas) return;
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    this.trailCtx = c.getContext('2d', { willReadFrequently: true });
    this.trailCanvas = c;
    if (this.trailCtx) {
      this.trailCtx.fillStyle = 'rgba(0,0,0,0)';
      this.trailCtx.fillRect(0, 0, c.width, c.height);
    }
  }

  private addTrailPoint(clientX: number, clientY: number): void {
    this.ensureTrailCanvas();
    if (!this.trailCtx || !this.trailCanvas) return;
    const uv = clientToUv(clientX, clientY, this.canvas);
    if (!uv) return;
    const x = uv.nx * this.trailCanvas.width;
    const y = uv.ny * this.trailCanvas.height;

    const grad = this.trailCtx.createRadialGradient(x, y, 1, x, y, 6);
    grad.addColorStop(0, 'rgba(255, 210, 120, 0.35)');
    grad.addColorStop(1, 'rgba(255, 210, 120, 0)');
    this.trailCtx.fillStyle = grad;
    this.trailCtx.beginPath();
    this.trailCtx.arc(x, y, 6, 0, Math.PI * 2);
    this.trailCtx.fill();

    const pixels = this.trailCtx.getImageData(0, 0, this.trailCanvas.width, this.trailCanvas.height);
    bus.emit('trail.update', {
      width: this.trailCanvas.width,
      height: this.trailCanvas.height,
      pixels: new Uint8Array(pixels.data.buffer),
    });

    if (this.trailDecayTimer === null) {
      this.trailDecayTimer = window.setInterval(() => this.decayTrail(), 80);
    }
  }

  private decayTrail(): void {
    if (!this.trailCtx || !this.trailCanvas) return;
    const img = this.trailCtx.getImageData(0, 0, this.trailCanvas.width, this.trailCanvas.height);
    const d = img.data;
    let hasAlpha = false;
    for (let i = 3; i < d.length; i += 4) {
      if (d[i] > 0) {
        d[i] = Math.max(0, d[i] - 4);
        hasAlpha = true;
      }
    }
    this.trailCtx.putImageData(img, 0, 0);
    bus.emit('trail.update', {
      width: this.trailCanvas.width,
      height: this.trailCanvas.height,
      pixels: new Uint8Array(d.buffer),
    });
    if (!hasAlpha && this.trailDecayTimer !== null) {
      window.clearInterval(this.trailDecayTimer);
      this.trailDecayTimer = null;
    }
  }

  destroy(): void {
    this.unsub.forEach(u => u());
    this.tooltip.destroy();
    this.laser.destroy();
    if (this.trailDecayTimer !== null) {
      window.clearInterval(this.trailDecayTimer);
      this.trailDecayTimer = null;
    }
  }
}
