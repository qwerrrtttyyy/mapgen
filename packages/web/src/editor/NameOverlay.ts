// 名称叠加层：Canvas2D 绘制板块/地形区名称 + 矢量工具进行中预览（纯视觉，不拦截鼠标）
// 交互（双击改名）由 EditorController 在 glCanvas 上处理，通过 'names.updated' 事件触发重绘。

import { bus } from '../core/eventBus.js';
import { state } from '../core/appState.js';
import { computeDetailPatch, detectDetailPeaks, type DetailPeak } from '@mapgen/core';

interface VectorPreview { points: number[][]; mode: string; }

export class NameOverlay {
  private host: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private unsub: (() => void)[] = [];
  private vectorPreview: VectorPreview = { points: [], mode: '' };
  private visible = true;
  // 惰性生成缓存：仅在视野显著变化时重算
  private cachedPeaks: DetailPeak[] = [];
  private cachedViewportKey = '';

  constructor(container: HTMLElement) {
    this.host = container;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'name-overlay';
    this.ctx = this.canvas.getContext('2d')!;
    container.appendChild(this.canvas);

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

  /** 同步画布尺寸到容器，返回地图绘制区在屏幕坐标下的几何 */
  private syncSize(): { scale: number; ox: number; oy: number } | null {
    const md = state.mapData;
    const rect = this.host.getBoundingClientRect();
    if (rect.width === 0 || !md) return null;
    if (this.canvas.width !== Math.floor(rect.width)) this.canvas.width = Math.floor(rect.width);
    if (this.canvas.height !== Math.floor(rect.height)) this.canvas.height = Math.floor(rect.height);
    const scale = Math.min(rect.width / md.width, rect.height / md.height);
    const dW = md.width * scale;
    const dH = md.height * scale;
    const ox = (rect.width - dW) / 2;
    const oy = (rect.height - dH) / 2;
    return { scale, ox, oy };
  }

  private mapToScreen(mx: number, my: number, scale: number, ox: number, oy: number): [number, number] {
    return [ox + mx * scale, oy + my * scale];
  }

  draw(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.visible) return;
    const geo = this.syncSize();
    if (!geo) return;
    const md = state.mapData;
    if (!md) return;
    const { scale, ox, oy } = geo;

    // ── LOD 分级：缩放越大，显示越多细节 ──
    // Tier 0 (scale < 1.5): 仅板块名
    // Tier 1 (1.5-3): + 大地形区 (area > 200)
    // Tier 2 (3-6):   + 中地形区 (area > 80)
    // Tier 3 (> 6):   + 全部地形区 (area > 20) + 地形类型色标
    const showPlates = true;
    const regionMinArea = scale < 1.5 ? Infinity
      : scale < 3 ? 200
      : scale < 6 ? 80
      : 20;
    const showTypeColor = scale >= 6; // 高缩放时按地形类型着色

    const names = md.names;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 板块名（较大、半透明底）
    if (showPlates) {
      ctx.font = `600 ${Math.max(11, Math.min(20, scale * 4))}px sans-serif`;
      for (const p of names.plates) {
        const [sx, sy] = this.mapToScreen(p.centroid[0], p.centroid[1], scale, ox, oy);
        this.drawLabel(sx, sy, p.name, 'rgba(20,28,40,0.55)', '#f4f6ff');
      }
    }

    // 地形区名（按 LOD 层级过滤，高缩放时按类型着色）
    if (regionMinArea < Infinity) {
      ctx.font = `500 ${Math.max(9, Math.min(14, scale * 3))}px sans-serif`;
      for (const r of names.regions) {
        if (r.area < regionMinArea) continue;
        const [sx, sy] = this.mapToScreen(r.centroid[0], r.centroid[1], scale, ox, oy);
        const colors = showTypeColor ? this.typeColors(r.type) : { bg: 'rgba(40,30,20,0.5)', fg: '#fff7e6' };
        this.drawLabel(sx, sy, r.name, colors.bg, colors.fg);
      }
    }

    // 惰性生成：高缩放时对可见区域计算高分辨率细节，检测并标注小山峰
    if (scale >= 6) {
      this.drawDetailPeaks(scale, ox, oy);
    }

    this.drawVectorPreview(scale, ox, oy);
  }

  /**
   * 惰性生成高分辨率细节 + 山峰标注。
   * 仅在视野显著变化时重算（缓存 viewportKey），避免每帧重复计算。
   */
  private drawDetailPeaks(scale: number, ox: number, oy: number): void {
    const md = state.mapData;
    if (!md) return;
    const { width: mw, height: mh } = md;
    // 可见区域在地图坐标中的范围（像素）
    const rect = this.host.getBoundingClientRect();
    const visW = rect.width / scale;
    const visH = rect.height / scale;
    // 视野中心（地图坐标）
    const cx = (mw - visW) / 2 + 0; // 简化：取地图中心附近（实际应从 pan 状态取）
    const cy = (mh - visH) / 2 + 0;
    const rx = Math.max(0, cx);
    const ry = Math.max(0, cy);
    const rw = Math.min(mw - rx, visW);
    const rh = Math.min(mh - ry, visH);

    // 缓存键：视野位置量化到 16 像素格，移动超过 16px 才重算
    const key = `${Math.round(rx / 16)},${Math.round(ry / 16)},${Math.round(rw)},${Math.round(rh)}`;
    if (key !== this.cachedViewportKey) {
      this.cachedViewportKey = key;
      // 提取基础高程
      const size = mw * mh;
      const baseElev = new Float32Array(size);
      for (let i = 0; i < size; i++) baseElev[i] = md.elevTex[i * 4];
      // 限制输出网格大小以保证性能（最多 96×96）
      const outW = Math.min(96, Math.round(rw));
      const outH = Math.min(96, Math.round(rh));
      const patch = computeDetailPatch(
        baseElev, mw, mh,
        { x: rx, y: ry, w: rw, h: rh, outW, outH },
        md.seed, 'perlin', 'standard', 2.0, 0.5, 0.04, 3,
      );
      this.cachedPeaks = detectDetailPeaks(patch, state.params.seaLevel, 0.025, 6);
    }

    // 绘制山峰标记（▲ + 高程）
    const ctx = this.ctx;
    ctx.font = `600 ${Math.max(8, Math.min(11, scale * 2))}px sans-serif`;
    for (const p of this.cachedPeaks) {
      const [sx, sy] = this.mapToScreen(p.mapX, p.mapY, scale, ox, oy);
      // 仅绘制可见区域内的峰
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

  /** 按地形类型返回标签配色（高缩放时区分冰川/火山/三角洲等） */
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
    const padX = 4, padY = 2;
    const m = ctx.measureText(text);
    const w = m.width + padX * 2;
    const h = (parseInt(ctx.font, 10) || 12) + padY * 2;
    ctx.fillStyle = bg;
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.fillStyle = fg;
    ctx.fillText(text, x, y);
  }

  private drawVectorPreview(scale: number, ox: number, oy: number): void {
    const pts = this.vectorPreview.points;
    if (pts.length === 0) return;
    const ctx = this.ctx;
    ctx.strokeStyle = '#ff5238';
    ctx.fillStyle = '#ff5238';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const [sx, sy] = this.mapToScreen(pts[i][0], pts[i][1], scale, ox, oy);
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    if (this.vectorPreview.mode === 'vector-poly' && pts.length > 2) ctx.closePath();
    ctx.stroke();
    for (const p of pts) {
      const [sx, sy] = this.mapToScreen(p[0], p[1], scale, ox, oy);
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
