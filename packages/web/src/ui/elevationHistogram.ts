/**
 * 高程直方图 — 在底栏显示 elevation distribution + 海平面标记
 *
 * 借鉴 Azgaar 的 elevation histogram：帮助用户直观理解地形分布，
 * 判断海平面位置是否合理，识别双峰/偏态等问题。
 *
 * 特性：
 * - 实时更新（每次生成/编辑后重绘）
 * - 海平面红线标记
 * - 鼠标悬停显示高程值和像素占比
 * - 陆地/海洋分色
 */

import { state } from '../core/appState.js';
import { bus } from '../core/eventBus.js';

const HISTOGRAM_BINS = 64;
const HISTOGRAM_HEIGHT = 40;
const HISTOGRAM_WIDTH = 160;

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let tooltip: HTMLDivElement | null = null;
let dirty = true;
let animFrameId: number | null = null;

/**
 * 初始化直方图：创建 canvas 并挂载到 #histogram-wrap
 */
export function initElevationHistogram(): void {
  const wrap = document.getElementById('histogram-wrap');
  if (!wrap) return;

  canvas = document.createElement('canvas');
  canvas.id = 'elev-histogram';
  canvas.width = HISTOGRAM_WIDTH;
  canvas.height = HISTOGRAM_HEIGHT;
  canvas.style.width = HISTOGRAM_WIDTH + 'px';
  canvas.style.height = HISTOGRAM_HEIGHT + 'px';
  canvas.style.cursor = 'crosshair';
  canvas.title = '高程分布';
  wrap.appendChild(canvas);
  ctx = canvas.getContext('2d');

  tooltip = document.createElement('div');
  tooltip.className = 'histogram-tooltip';
  tooltip.style.display = 'none';
  wrap.appendChild(tooltip);

  canvas.addEventListener('mousemove', onHover);
  canvas.addEventListener('mouseleave', () => {
    if (tooltip) tooltip.style.display = 'none';
  });

  // 监听重绘事件
  bus.on('generating.completed', markDirty);
  bus.on('editor.committed', markDirty);
  bus.on('checkpoint.updated', markDirty);

  // 启动渲染循环
  scheduleRedraw();
}

function markDirty(): void {
  dirty = true;
}

function scheduleRedraw(): void {
  if (animFrameId !== null) return;
  animFrameId = requestAnimationFrame(() => {
    animFrameId = null;
    if (dirty) {
      dirty = false;
      draw();
    }
    scheduleRedraw();
  });
}

function draw(): void {
  if (!canvas || !ctx) return;
  const md = state.mapData;
  if (!md) return;

  const { width, height, elevTex } = md;
  const seaLevel = state.params.seaLevel;
  const bins = new Float32Array(HISTOGRAM_BINS);
  const total = width * height;

  // 统计高程分布（仅取每像素第一个通道）
  for (let i = 0; i < total; i++) {
    const e = elevTex[i * 4];
    const bin = Math.max(0, Math.min(HISTOGRAM_BINS - 1, Math.floor((e + 1) / 2 * HISTOGRAM_BINS)));
    bins[bin]++;
  }

  // 归一化
  let maxBin = 0;
  for (let i = 0; i < HISTOGRAM_BINS; i++) {
    if (bins[i] > maxBin) maxBin = bins[i];
  }
  if (maxBin === 0) return;

  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // 背景
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, 0, W, H);

  const barW = W / HISTOGRAM_BINS;
  const seaBin = Math.floor((seaLevel + 1) / 2 * HISTOGRAM_BINS);

  // 绘制柱状图
  for (let i = 0; i < HISTOGRAM_BINS; i++) {
    const h = (bins[i] / maxBin) * (H - 2);
    const x = i * barW;
    const y = H - h;

    // 海洋/陆地分色
    if (i <= seaBin) {
      ctx.fillStyle = '#2196F3'; // 海洋蓝
    } else {
      ctx.fillStyle = '#4CAF50'; // 陆地绿
    }
    ctx.fillRect(x, y, barW - 0.5, h);
  }

  // 海平面标记线
  const seaX = seaBin * barW;
  ctx.strokeStyle = '#ff5252';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 2]);
  ctx.beginPath();
  ctx.moveTo(seaX, 0);
  ctx.lineTo(seaX, H);
  ctx.stroke();
  ctx.setLineDash([]);

  // 海平面标签
  ctx.fillStyle = '#ff5252';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  if (seaX > 20) {
    ctx.fillText('海平面', seaX, 10);
  }
}

function onHover(e: MouseEvent): void {
  if (!canvas || !tooltip || !state.mapData) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const binIdx = Math.floor((x / HISTOGRAM_WIDTH) * HISTOGRAM_BINS);
  if (binIdx < 0 || binIdx >= HISTOGRAM_BINS) return;

  const elevMin = -1 + (binIdx / HISTOGRAM_BINS) * 2;
  const elevMax = -1 + ((binIdx + 1) / HISTOGRAM_BINS) * 2;
  const seaLevel = state.params.seaLevel;
  const label = binIdx <= Math.floor((seaLevel + 1) / 2 * HISTOGRAM_BINS) ? '🌊 海洋' : '🏔️ 陆地';

  tooltip.textContent = `${label} ${elevMin.toFixed(2)}~${elevMax.toFixed(2)}`;
  tooltip.style.display = 'block';
  tooltip.style.left = x + 'px';
}

export function destroyElevationHistogram(): void {
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  canvas?.remove();
  tooltip?.remove();
  canvas = null;
  ctx = null;
  tooltip = null;
}
