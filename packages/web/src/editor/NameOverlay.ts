// 名称叠加层：Canvas2D 绘制板块/地形区名称 + 矢量工具进行中预览（纯视觉，不拦截鼠标）
// 交互（双击改名）由 EditorController 在 glCanvas 上处理，通过 'names.updated' 事件触发重绘。

import { bus } from '../core/eventBus.js';
import { state } from '../core/appState.js';

interface VectorPreview { points: number[][]; mode: string; }

export class NameOverlay {
  private host: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private unsub: (() => void)[] = [];
  private vectorPreview: VectorPreview = { points: [], mode: '' };
  private visible = true;

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

    if (scale < 2.5) {
      // 缩放不足时名称拥挤，仅画矢量预览
      this.drawVectorPreview(scale, ox, oy);
      return;
    }

    const names = md.names;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 板块名（较大、半透明底）
    ctx.font = `600 ${Math.max(11, Math.min(20, scale * 4))}px sans-serif`;
    for (const p of names.plates) {
      const [sx, sy] = this.mapToScreen(p.centroid[0], p.centroid[1], scale, ox, oy);
      this.drawLabel(sx, sy, p.name, 'rgba(20,28,40,0.55)', '#f4f6ff');
    }

    // 地形区名（较小，过滤小碎片）
    ctx.font = `500 ${Math.max(9, Math.min(14, scale * 3))}px sans-serif`;
    for (const r of names.regions) {
      if (r.area < 40) continue;
      const [sx, sy] = this.mapToScreen(r.centroid[0], r.centroid[1], scale, ox, oy);
      this.drawLabel(sx, sy, r.name, 'rgba(40,30,20,0.5)', '#fff7e6');
    }

    this.drawVectorPreview(scale, ox, oy);
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
