// 编辑器控制器：模式状态机 + 工具路由 + 撤销栈桥接（AC-5/6/7/9, US-5/6/7）
// 监听 canvas 鼠标事件，按当前模式分发到画笔/矢量/拖拽工具；
// 编辑后以 before/after 快照构造 Command 压栈，并 emit 'editor.committed' 触发局部重算。

import { Colleague } from '../core/mediator.js';
import { bus } from '../core/eventBus.js';
import { state } from '../core/appState.js';
import {
  CommandStack,
  applyVectorMountain,
  applyVectorPolygon,
  movePlate,
  type VectorTarget,
} from '@mapgen/core';

export type EditorMode =
  'idle' | 'brush' | 'vector-line' | 'vector-poly' | 'drag-plate' | 'annotate';
export type BrushKind = 'raise' | 'lower' | 'sea' | 'land' | 'plate-paint';

export interface EditorToolParams {
  brushRadius: number;
  brushStrength: number;
  brushKind: BrushKind;
  brushTargetPlate: number;
  vectorTarget: VectorTarget;
  vectorMountainHeight: number;
  vectorWidth: number;
}

export const DEFAULT_TOOL_PARAMS: EditorToolParams = {
  brushRadius: 14,
  brushStrength: 0.3,
  brushKind: 'raise',
  brushTargetPlate: 1,
  vectorTarget: 'land',
  vectorMountainHeight: 0.65,
  vectorWidth: 4,
};

interface PixelCoord {
  x: number;
  y: number;
}

export class EditorController extends Colleague {
  private canvas: HTMLCanvasElement;
  private stack = new CommandStack(50);
  mode: EditorMode = 'idle';
  tool: EditorToolParams = { ...DEFAULT_TOOL_PARAMS };

  private dragging = false;
  /** 0 = elevTex 通道0；1 = plateTex 通道0 */
  private snapshotChannel: 0 | 1 = 0;
  private beforeSnapshot: Float32Array | null = null;

  private vectorPoints: number[][] = [];
  private dragStart: PixelCoord | null = null;
  private dragPlateId = -1;

  private cursorDiv: HTMLDivElement | null = null;
  private unsub: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement) {
    super('editor');
    this.canvas = canvas;

    // capture 阶段拦截，确保编辑器在 MapInteraction（bubble）之前处理
    const down = (e: MouseEvent): void => this.onMouseDown(e);
    const move = (e: MouseEvent): void => this.onMouseMove(e);
    const up = (e: MouseEvent): void => this.onMouseUp(e);
    const dbl = (e: MouseEvent): void => this.onDoubleClick(e);
    const key = (e: KeyboardEvent): void => this.onKeyDown(e);

    canvas.addEventListener('mousedown', down, true);
    window.addEventListener('mousemove', move, true);
    window.addEventListener('mouseup', up, true);
    canvas.addEventListener('dblclick', dbl, true);
    document.addEventListener('keydown', key);

    this.unsub.push(
      () => canvas.removeEventListener('mousedown', down, true),
      () => window.removeEventListener('mousemove', move, true),
      () => window.removeEventListener('mouseup', up, true),
      () => canvas.removeEventListener('dblclick', dbl, true),
      () => document.removeEventListener('keydown', key)
    );
  }

  setMode(mode: EditorMode): void {
    if (this.mode === mode) return;
    // 退出旧模式清理
    if (this.mode === 'brush') {
      this.hideBrushCursor();
      this.dragging = false; // 离开 brush 时强制结束拖拽，避免悬浮自动涂刷（Bug-D）
    }
    if (this.mode === 'vector-line' || this.mode === 'vector-poly') this.cancelVector();
    this.mode = mode;
    if (mode === 'brush') this.showBrushCursor();
    this.emit('editor.mode.changed', { mode });
  }

  setTool(patch: Partial<EditorToolParams>): void {
    Object.assign(this.tool, patch);
    if (this.mode === 'brush') this.showBrushCursor();
  }

  private emit(event: string, payload?: unknown): void {
    if (this.mediator) {
      this.send(event as never, payload as never);
    } else {
      bus.emit(event, payload);
    }
  }

  get canUndo(): boolean {
    return this.stack.canUndo;
  }
  get canRedo(): boolean {
    return this.stack.canRedo;
  }

  undo(): void {
    if (!this.stack.undo()) return;
    this.emit('editor.committed', { phase: 'editor-elevation' });
    this.emit('render.request');
  }

  redo(): void {
    if (!this.stack.redo()) return;
    this.emit('editor.committed', { phase: 'editor-elevation' });
    this.emit('render.request');
  }

  // ── 坐标转换：客户端坐标 → 地图像素 ──
  private toMapPixel(clientX: number, clientY: number): PixelCoord | null {
    const md = state.mapData;
    if (!md) return null;
    const rect = this.canvas.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    const scale = Math.min(rect.width / md.width, rect.height / md.height);
    const dW = md.width * scale;
    const dH = md.height * scale;
    const ox = (rect.width - dW) / 2;
    const oy = (rect.height - dH) / 2;
    const nx = (cx - ox) / dW;
    const ny = (cy - oy) / dH;
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
    return { x: Math.floor(nx * md.width), y: Math.floor(ny * md.height) };
  }

  private screenScale(): number {
    const md = state.mapData;
    if (!md) return 1;
    const rect = this.canvas.getBoundingClientRect();
    return Math.min(rect.width / md.width, rect.height / md.height);
  }

  /** 地图像素 → 屏幕坐标（用于名称命中检测） */
  private mapToScreen(mx: number, my: number): [number, number] {
    const md = state.mapData;
    if (!md) throw new Error('No map data');
    const rect = this.canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / md.width, rect.height / md.height);
    const dW = md.width * scale;
    const dH = md.height * scale;
    const ox = (rect.width - dW) / 2;
    const oy = (rect.height - dH) / 2;
    return [rect.left + ox + mx * scale, rect.top + oy + my * scale];
  }

  // ── 通道提取/回写 ──
  private extractElev(): Float32Array {
    const md = state.mapData;
    if (!md) throw new Error('No map data');
    const arr = new Float32Array(md.width * md.height);
    for (let i = 0; i < arr.length; i++) arr[i] = md.elevTex[i * 4];
    return arr;
  }
  private writeElev(arr: Float32Array): void {
    const md = state.mapData;
    if (!md) throw new Error('No map data');
    for (let i = 0; i < arr.length; i++) md.elevTex[i * 4] = arr[i];
  }
  private extractPlateId(): Float32Array {
    const md = state.mapData;
    if (!md) throw new Error('No map data');
    const pc = state.params.plateCount;
    const arr = new Float32Array(md.width * md.height);
    for (let i = 0; i < arr.length; i++) arr[i] = Math.round(md.plateTex[i * 4] * pc);
    return arr;
  }
  private writePlateId(arr: Float32Array): void {
    const md = state.mapData;
    if (!md) throw new Error('No map data');
    const inv = 1 / state.params.plateCount;
    for (let i = 0; i < arr.length; i++) md.plateTex[i * 4] = arr[i] * inv;
  }
  private plateIdAt(x: number, y: number): number {
    const md = state.mapData;
    if (!md) throw new Error('No map data');
    const pc = state.params.plateCount;
    const i4 = (y * md.width + x) * 4;
    return Math.max(0, Math.min(pc - 1, Math.round(md.plateTex[i4] * pc)));
  }

  // ═══════════ 鼠标事件分发 ═══════════
  private onMouseDown(e: MouseEvent): void {
    if (this.mode === 'idle' || this.mode === 'annotate') return; // 交由 MapInteraction / NameOverlay
    const p = this.toMapPixel(e.clientX, e.clientY);
    if (!p) return;
    e.stopPropagation();
    e.preventDefault();

    if (this.mode === 'brush') {
      this.dragging = true;
      this.startBrushDrag();
      this.applyBrushAt(p.x, p.y);
    } else if (this.mode === 'vector-line' || this.mode === 'vector-poly') {
      this.addVectorPoint(p.x, p.y);
    } else if (this.mode === 'drag-plate') {
      this.dragStart = p;
      this.dragPlateId = this.plateIdAt(p.x, p.y);
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (this.mode === 'idle') return;
    if (this.mode === 'brush') {
      this.moveBrushCursor(e.clientX, e.clientY);
      if (this.dragging) {
        const p = this.toMapPixel(e.clientX, e.clientY);
        if (p) {
          e.stopPropagation();
          this.applyBrushAt(p.x, p.y);
        }
      }
    } else if (this.mode === 'drag-plate' && this.dragStart) {
      e.stopPropagation(); // 拖拽中阻止选择
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (this.mode === 'idle') return;
    if (this.mode === 'brush' && this.dragging) {
      e.stopPropagation();
      this.endBrushDrag();
      this.dragging = false;
    } else if (this.mode === 'drag-plate' && this.dragStart) {
      e.stopPropagation();
      const p = this.toMapPixel(e.clientX, e.clientY);
      this.commitPlateDrag(p);
      this.dragStart = null;
      this.dragPlateId = -1;
    }
  }

  private onDoubleClick(e: MouseEvent): void {
    if (this.mode === 'vector-line' || this.mode === 'vector-poly') {
      e.stopPropagation();
      e.preventDefault();
      this.commitVector();
      return;
    }
    // AC-8.3：双击重命名板块/地形区（idle 与 annotate 模式均可触发）
    if (this.mode === 'idle' || this.mode === 'annotate') {
      const renamed = this.tryRenameAt(e.clientX, e.clientY);
      if (renamed) {
        e.stopPropagation();
        e.preventDefault();
      }
    }
  }

  /**
   * AC-8.3：双击附近名称质心 → 弹出 prompt 改名。
   * 命中阈值按屏幕空间，标签近似宽 60px / 高 16px。
   * @returns 是否命中并完成改名
   */
  private tryRenameAt(clientX: number, clientY: number): boolean {
    const md = state.mapData;
    if (!md || !md.names) return false;
    const TH_X = 60,
      TH_Y = 16;

    // 优先地形区（更密集，更可能被点中），再板块
    for (const r of md.names.regions) {
      const [sx, sy] = this.mapToScreen(r.centroid[0], r.centroid[1]);
      if (Math.abs(sx - clientX) <= TH_X && Math.abs(sy - clientY) <= TH_Y) {
        const next = window.prompt('重命名地形区：', r.name);
        if (next != null && next.trim() !== '') {
          r.name = next.trim();
          this.emit('names.updated');
        }
        return true;
      }
    }
    for (const p of md.names.plates) {
      const [sx, sy] = this.mapToScreen(p.centroid[0], p.centroid[1]);
      if (Math.abs(sx - clientX) <= TH_X && Math.abs(sy - clientY) <= TH_Y) {
        const next = window.prompt('重命名板块：', p.name);
        if (next != null && next.trim() !== '') {
          p.name = next.trim();
          this.emit('names.updated');
        }
        return true;
      }
    }
    return false;
  }

  private onKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
    if (this.mode === 'vector-line' || this.mode === 'vector-poly') {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.commitVector();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cancelVector();
      }
    } else if (e.key === 'Escape' && this.mode !== 'idle') {
      this.setMode('idle');
    }
  }

  // ═══════════ 画笔 ═══════════
  private startBrushDrag(): void {
    if (this.tool.brushKind === 'plate-paint') {
      this.beforeSnapshot = this.extractPlateId();
      this.snapshotChannel = 1;
    } else {
      this.beforeSnapshot = this.extractElev();
      this.snapshotChannel = 0;
    }
  }

  private applyBrushAt(x: number, y: number): void {
    const md = state.mapData;
    if (!md) return;
    const r = Math.max(1, this.tool.brushRadius);
    const str = this.tool.brushStrength;
    const seaLevel = state.params.seaLevel;
    const sigma = r / 2;
    const x0 = Math.max(0, x - r),
      x1 = Math.min(md.width - 1, x + r);
    const y0 = Math.max(0, y - r),
      y1 = Math.min(md.height - 1, y + r);

    if (this.snapshotChannel === 0) {
      const kind = this.tool.brushKind;
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          const dx = xx - x,
            dy = yy - y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 > r * r) continue;
          const i4 = (yy * md.width + xx) * 4;
          const before = md.elevTex[i4];
          const fall = Math.exp(-dist2 / (2 * sigma * sigma));
          let after = before;
          switch (kind) {
            case 'raise':
              after = Math.min(1, before + str * fall);
              break;
            case 'lower':
              after = Math.max(-1, before - str * fall);
              break;
            case 'sea':
              after = before * (1 - fall) + (seaLevel - 0.3) * fall;
              break;
            case 'land':
              after = before * (1 - fall) + 0.2 * fall;
              break;
          }
          md.elevTex[i4] = after;
        }
      }
    } else {
      // 板块涂刷：硬边
      const inv = 1 / state.params.plateCount;
      const tid = this.tool.brushTargetPlate;
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          const dx = xx - x,
            dy = yy - y;
          if (dx * dx + dy * dy > r * r) continue;
          md.plateTex[(yy * md.width + xx) * 4] = tid * inv;
        }
      }
    }
    this.emit('render.request');
  }

  private endBrushDrag(): void {
    const md = state.mapData;
    if (!md || !this.beforeSnapshot) return;
    const before = this.beforeSnapshot;
    const after = this.snapshotChannel === 0 ? this.extractElev() : this.extractPlateId();
    const channel = this.snapshotChannel;
    const writeBack =
      channel === 0
        ? (arr: Float32Array): void => this.writeElev(arr)
        : (arr: Float32Array): void => this.writePlateId(arr);
    this.stack.push({
      kind: 'brush',
      redo: () => writeBack(after),
      undo: () => writeBack(before),
    });
    this.beforeSnapshot = null;
    const phase = channel === 0 ? 'editor-elevation' : 'elevation';
    this.emit('editor.committed', { phase });
  }

  // ═══════════ 矢量工具 ═══════════
  private addVectorPoint(x: number, y: number): void {
    // 与上一点过近 → 视为提交（避免双击重复点）
    if (this.vectorPoints.length >= 1) {
      const last = this.vectorPoints[this.vectorPoints.length - 1];
      if (Math.hypot(last[0] - x, last[1] - y) < 3) {
        this.commitVector();
        return;
      }
    }
    this.vectorPoints.push([x, y]);
    this.emit('editor.vector.update', {
      points: this.vectorPoints.map(p => [...p]),
      mode: this.mode,
    });
  }

  private commitVector(): void {
    const md = state.mapData;
    if (!md || this.vectorPoints.length < 2) {
      this.cancelVector();
      return;
    }
    const before = this.extractElev();
    const elev = new Float32Array(before);
    if (this.mode === 'vector-line') {
      applyVectorMountain(
        md.width,
        md.height,
        elev,
        this.vectorPoints,
        this.tool.vectorWidth,
        this.tool.vectorMountainHeight
      );
    } else {
      applyVectorPolygon(
        md.width,
        md.height,
        elev,
        this.vectorPoints,
        this.tool.vectorTarget,
        state.params.seaLevel
      );
    }
    this.writeElev(elev);
    const after = new Float32Array(elev);
    this.stack.push({
      kind: 'vector',
      redo: () => this.writeElev(after),
      undo: () => this.writeElev(before),
    });
    this.vectorPoints = [];
    this.emit('editor.vector.update', { points: [], mode: this.mode });
    this.emit('editor.committed', { phase: 'editor-elevation' });
  }

  private cancelVector(): void {
    this.vectorPoints = [];
    this.emit('editor.vector.update', { points: [], mode: this.mode });
  }

  // ═══════════ 板块拖拽 ═══════════
  private commitPlateDrag(p: PixelCoord | null): void {
    const md = state.mapData;
    if (!md || !this.dragStart || this.dragPlateId < 0) return;
    const dx = p ? p.x - this.dragStart.x : 0;
    const dy = p ? p.y - this.dragStart.y : 0;
    if (dx === 0 && dy === 0) return;
    const before = this.extractPlateId();
    const plateId = new Float32Array(before);
    movePlate(md.width, md.height, plateId, this.dragPlateId, dx, dy).redo();
    this.writePlateId(plateId);
    const after = new Float32Array(plateId);
    this.stack.push({
      kind: 'plate-move',
      redo: () => this.writePlateId(after),
      undo: () => this.writePlateId(before),
    });
    this.emit('editor.committed', { phase: 'elevation' });
  }

  // ═══════════ 画笔光标预览 ═══════════
  private showBrushCursor(): void {
    if (!this.cursorDiv) {
      this.cursorDiv = document.createElement('div');
      this.cursorDiv.className = 'editor-brush-cursor';
      document.getElementById('canvas-container')?.appendChild(this.cursorDiv);
    }
    this.cursorDiv.style.display = 'block';
  }
  private moveBrushCursor(clientX: number, clientY: number): void {
    if (!this.cursorDiv) return;
    const size = this.tool.brushRadius * 2 * this.screenScale();
    this.cursorDiv.style.width = size + 'px';
    this.cursorDiv.style.height = size + 'px';
    this.cursorDiv.style.left = clientX - size / 2 + 'px';
    this.cursorDiv.style.top = clientY - size / 2 + 'px';
  }
  private hideBrushCursor(): void {
    if (this.cursorDiv) this.cursorDiv.style.display = 'none';
  }

  destroy(): void {
    this.unsub.forEach(u => u());
    this.unsub = [];
    this.cursorDiv?.remove();
    this.cursorDiv = null;
  }
}
