import { Colleague } from '../core/mediator.js';
import { bus } from '../core/eventBus.js';
import { state } from '../core/appState.js';
import { mapPixelToClient } from '../map/viewport.js';
import { computeDetailPatch, detectDetailPeaks, type DetailPeak } from '@mapgen/core';

interface VectorPreview { points: number[][]; mode: string; }

export class NameOverlay extends Colleague {
  private host: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private unsub: (() => void)[] = [];
  private vectorPreview: VectorPreview = { points: [], mode: '' };
  private visible = true;
  private cachedPeaks: DetailPeak[] = [];
  private cachedViewportKey = '';

  constructor(container: HTMLElement) {
    super('nameOverlay');
    this.host = container;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'name-overlay';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '3';
    this.ctx = this.canvas.getContext('2d')!;
    container.appendChild(this.canvas);
  }

  setZoom(_zoom: number): void {
    // 缩放/平移由 mapPixelToClient 在绘制时实时计算，不再使用 CSS transform
  }

  bindEvents(): void {
    if (this.mediator) {
      this.bindWithMediator();
    } else {
      this.bindWithBus();
    }
  }

  private bindWithMediator(): void {
    this.unsub.push(
      this.subscribe('generating.completed', () => this.draw()),
      this.subscribe('editor.committed', () => this.draw()),
      this.subscribe('render.request', () => requestAnimationFrame(() => this.draw())),
      this.subscribe('names.updated', () => this.draw()),
      this.subscribe('editor.vector.update', (v: VectorPreview) => {
        this.vectorPreview = v;
        this.draw();
      }),
      this.subscribe('overlay.toggle', (vis: boolean) => { this.visible = vis; this.draw(); }),
    );
  }

  private bindWithBus(): void {
    this.unsub.push(
      bus.on('generating.completed', () => this.draw()),
      bus.on('editor.committed', () => this.draw()),
      bus.on('render.request', () => requestAnimationFrame(() => this.draw())),
      bus.on('names.updated', () => this.draw()),
      bus.on('editor.vector.update', (v: VectorPreview) => {
        this.vectorPreview = v;
        this.draw();
      }),
      bus.on('overlay.toggle', (vis: boolean) => { this.visible = vis; this.draw(); }),
    );
  }

  private syncSize(): { rect: DOMRect; baseScale: number; effectiveScale: number } | null {
    const md = state.mapData;
    const rect = this.host.getBoundingClientRect();
    if (rect.width === 0 || !md) return null;
    if (this.canvas.width !== Math.floor(rect.width)) this.canvas.width = Math.floor(rect.width);
    if (this.canvas.height !== Math.floor(rect.height)) this.canvas.height = Math.floor(rect.height);
    const baseScale = Math.min(rect.width / md.width, rect.height / md.height);
    return { rect, baseScale, effectiveScale: baseScale * state.zoom };
  }

  private mapToScreen(mx: number, my: number, rect: DOMRect): [number, number] {
    const md = state.mapData!;
    return mapPixelToClient(mx, my, rect, md.width, md.height);
  }

  draw(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.visible) return;
    const geo = this.syncSize();
    if (!geo) return;
    const md = state.mapData;
    if (!md) return;
    const { rect, effectiveScale: scale } = geo;

    const showPlates = true;
    const regionMinArea = scale < 1.5 ? Infinity
      : scale < 3 ? 200
      : scale < 6 ? 80
      : 20;
    const showTypeColor = scale >= 6;

    const names = md.names;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (showPlates) {
      ctx.font = `600 ${Math.max(11, Math.min(20, scale * 4))}px sans-serif`;
      for (const p of names.plates) {
        const [sx, sy] = this.mapToScreen(p.centroid[0], p.centroid[1], rect);
        this.drawLabel(sx, sy, p.name, 'rgba(20,28,40,0.55)', '#f4f6ff');
      }
    }

    if (regionMinArea < Infinity) {
      ctx.font = `500 ${Math.max(9, Math.min(14, scale * 3))}px sans-serif`;
      for (const r of names.regions) {
        if (r.area < regionMinArea) continue;
        const [sx, sy] = this.mapToScreen(r.centroid[0], r.centroid[1], rect);
        const colors = showTypeColor ? this.typeColors(r.type) : { bg: 'rgba(40,30,20,0.5)', fg: '#fff7e6' };
        this.drawLabel(sx, sy, r.name, colors.bg, colors.fg);
      }
    }

    if (scale >= 6) {
      this.drawDetailPeaks(scale, rect);
    }

    this.drawVectorPreview(rect);
  }

  private drawDetailPeaks(scale: number, rect: DOMRect): void {
    const md = state.mapData;
    if (!md) return;
    const { width: mw, height: mh } = md;
    const visW = rect.width / scale;
    const visH = rect.height / scale;
    const cx = (mw - visW) / 2 - state.panX * mw;
    const cy = (mh - visH) / 2 - state.panY * mh;
    const rx = Math.max(0, cx);
    const ry = Math.max(0, cy);
    const rw = Math.min(mw - rx, visW);
    const rh = Math.min(mh - ry, visH);

    const key = `${Math.round(rx / 16)},${Math.round(ry / 16)},${Math.round(rw)},${Math.round(rh)}`;
    if (key !== this.cachedViewportKey) {
      this.cachedViewportKey = key;
      const size = mw * mh;
      const baseElev = new Float32Array(size);
      for (let i = 0; i < size; i++) baseElev[i] = md.elevTex[i * 4];
      const outW = Math.min(96, Math.round(rw));
      const outH = Math.min(96, Math.round(rh));
      const patch = computeDetailPatch(
        baseElev, mw, mh,
        { x: rx, y: ry, w: rw, h: rh, outW, outH },
        md.seed, 'perlin', 'standard', 2.0, 0.5, 0.04, 3,
      );
      this.cachedPeaks = detectDetailPeaks(patch, state.params.seaLevel, 0.025, 6);
    }

    const ctx = this.ctx;
    ctx.font = `600 ${Math.max(8, Math.min(11, scale * 2))}px sans-serif`;
    for (const p of this.cachedPeaks) {
      const [sx, sy] = this.mapToScreen(p.mapX, p.mapY, rect);
      if (sx < 0 || sy < 0 || sx > rect.width || sy > rect.height) continue;
      ctx.fillStyle = 'rgba(200,80,30,0.85)';
      ctx.beginPath();
      ctx.moveTo(sx, sy - 4);
      ctx.lineTo(sx - 3.5, sy + 2);
      ctx.lineTo(sx + 3.5, sy + 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,240,230,0.85)';
      ctx.fillText(p.elevation.toFixed(2), sx, sy + 10);
    }
  }

  private typeColors(type: string): { bg: string; fg: string } {
    switch (type) {
      case 'glacier':     return { bg: 'rgba(180,210,240,0.6)', fg: '#0a1a30' };
      case 'volcano':     return { bg: 'rgba(200,60,30,0.6)',   fg: '#fff0e8' };
      case 'delta':       return { bg: 'rgba(80,120,60,0.55)',  fg: '#f0fff0' };
      case 'archipelago': return { bg: 'rgba(40,80,140,0.6)',   fg: '#e0f0ff' };
      case 'mountain':    return { bg: 'rgba(80,60,40,0.55)',   fg: '#fff7e6' };
      case 'desert':      return { bg: 'rgba(180,150,80,0.55)', fg: '#3a2a10' };
      case 'forest':      return { bg: 'rgba(30,70,30,0.55)',   fg: '#e8ffe8' };
      case 'basin':       return { bg: 'rgba(60,70,90,0.55)',   fg: '#e8f0ff' };
      default:            return { bg: 'rgba(40,30,20,0.5)',    fg: '#fff7e6' };
    }
  }

  private drawLabel(x: number, y: number, text: string, bg: string, fg: string): void {
    const ctx = this.ctx;
    const padX = 5, padY = 3;
    const m = ctx.measureText(text);
    const fontSize = parseInt(ctx.font, 10) || 12;
    const w = m.width + padX * 2;
    const h = fontSize + padY * 2;
    const r = 4;
    const lx = x - w / 2;
    const ly = y - h / 2;
    ctx.beginPath();
    ctx.moveTo(lx + r, ly);
    ctx.lineTo(lx + w - r, ly);
    ctx.quadraticCurveTo(lx + w, ly, lx + w, ly + r);
    ctx.lineTo(lx + w, ly + h - r);
    ctx.quadraticCurveTo(lx + w, ly + h, lx + w - r, ly + h);
    ctx.lineTo(lx + r, ly + h);
    ctx.quadraticCurveTo(lx, ly + h, lx, ly + h - r);
    ctx.lineTo(lx, ly + r);
    ctx.quadraticCurveTo(lx, ly, lx + r, ly);
    ctx.closePath();
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = fg;
    ctx.fillText(text, x, y);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  private drawVectorPreview(rect: DOMRect): void {
    const pts = this.vectorPreview.points;
    if (pts.length === 0) return;
    const ctx = this.ctx;
    ctx.strokeStyle = '#ff5238';
    ctx.fillStyle = '#ff5238';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const [sx, sy] = this.mapToScreen(pts[i][0], pts[i][1], rect);
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    if (this.vectorPreview.mode === 'vector-poly' && pts.length > 2) ctx.closePath();
    ctx.stroke();
    for (const p of pts) {
      const [sx, sy] = this.mapToScreen(p[0], p[1], rect);
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  destroy(): void {
    this.unsub.forEach(u => u());
    this.unsub = [];
    this.canvas.remove();
  }
}
