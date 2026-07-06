/**
 * ExportManager - 多格式、多分辨率地图导出
 *
 * 支持：
 * - 图片导出：PNG / JPEG / WebP，可选分辨率倍率（1x/2x/4x）
 * - 数据导出：JSON（生成参数 + 元数据 + 纹理摘要）
 * - 批量导出：所有渲染风格各导出一张
 */

import type { MapData } from '@mapgen/core';
import type { UIParams } from '../core/appState.js';
import { state } from '../core/appState.js';
import { logger } from '../core/logger.js';

// ── 常量 ──────────────────────────────────────────────────

/** 导出格式 */
export type ExportFormat = 'png' | 'jpeg' | 'webp';

/** 分辨率倍率 */
export type ExportScale = 1 | 2 | 4;

/** 导出选项 */
export interface ExportOptions {
  format: ExportFormat;
  scale: ExportScale;
  quality?: number;      // JPEG/WebP 质量 [0, 1]，默认 0.92
  includeOverlays?: boolean;  // 是否包含 UI 叠加层（边界、河流等），默认 true
  filename?: string;     // 自定义文件名（不含扩展名）
}

/** 数据导出选项 */
export interface ExportDataOptions {
  includeParams?: boolean;     // 包含生成参数，默认 true
  includeMetadata?: boolean;   // 包含元数据（尺寸、种子、时间戳），默认 true
  includeTextureSummary?: boolean; // 包含纹理统计摘要，默认 false（体积大）
  filename?: string;
}

/** 导出结果 */
export interface ExportResult {
  success: boolean;
  filename?: string;
  size?: number;       // 字节数
  error?: string;
}

/** 纹理统计摘要 */
interface TextureSummary {
  name: string;
  channels: number;
  min: number;
  max: number;
  mean: number;
  nonZero: number;
}

/** 导出数据 JSON 结构 */
export interface ExportDataPayload {
  version: string;
  exportedAt: string;
  metadata?: {
    seed: string;
    width: number;
    height: number;
    pixels: number;
    landPercent: number;
    plateCount: number;
    riverCount: number;
    regionCount: number;
  };
  params?: Record<string, unknown>;
  textureSummary?: TextureSummary[];
}

// ── MIME 类型映射 ─────────────────────────────────────────

const FORMAT_MIME: Record<ExportFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

const FORMAT_EXT: Record<ExportFormat, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
};

/** 默认质量设置 */
const DEFAULT_QUALITY: Record<ExportFormat, number> = {
  png: 1.0,
  jpeg: 0.92,
  webp: 0.92,
};

// ── 工具函数 ──────────────────────────────────────────────

function generateFilename(prefix: string, ext: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${prefix}-${ts}.${ext}`;
}

function computeLandPercent(elevTex: Float32Array, seaLevel: number): number {
  const total = elevTex.length / 4;
  let land = 0;
  for (let i = 0; i < total; i++) {
    if (elevTex[i * 4] >= seaLevel) land++;
  }
  return Math.round((land / total) * 10000) / 100;
}

function computeTextureStats(data: Float32Array, name: string, channels: number): TextureSummary {
  let min = Infinity, max = -Infinity, sum = 0, nonZero = 0;
  const len = data.length;
  for (let i = 0; i < len; i++) {
    const v = data[i];
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
    if (v !== 0) nonZero++;
  }
  return {
    name,
    channels,
    min: Math.round(min * 10000) / 10000,
    max: Math.round(max * 10000) / 10000,
    mean: Math.round((sum / len) * 10000) / 10000,
    nonZero,
  };
}

// ── ExportManager ─────────────────────────────────────────

export class ExportManager {
  private canvas: HTMLCanvasElement | null = null;

  /** 绑定渲染画布（用于截图导出） */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
  }

  // ── 图片导出 ──────────────────────────────────────────

  /**
   * 导出当前渲染画布为图片
   */
  async exportImage(options: Partial<ExportOptions> = {}): Promise<ExportResult> {
    const {
      format = 'png',
      scale = 1,
      quality,
      filename,
    } = options;

    if (!this.canvas) {
      return { success: false, error: '画布未初始化' };
    }

    try {
      const srcW = this.canvas.width;
      const srcH = this.canvas.height;
      const dstW = srcW * scale;
      const dstH = srcH * scale;

      // scale=1 时直接导出原始画布
      let blob: Blob | null;

      if (scale === 1) {
        blob = await this.canvasToBlob(this.canvas, format, quality);
      } else {
        // 高分辨率：创建离屏 canvas 做缩放
        const offscreen = document.createElement('canvas');
        offscreen.width = dstW;
        offscreen.height = dstH;
        const ctx = offscreen.getContext('2d');
        if (!ctx) {
          return { success: false, error: '无法创建离屏画布' };
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(this.canvas, 0, 0, dstW, dstH);
        blob = await this.canvasToBlob(offscreen, format, quality);
      }

      if (!blob) {
        return { success: false, error: '编码失败' };
      }

      const ext = FORMAT_EXT[format];
      const fname = filename
        ? `${filename}.${ext}`
        : generateFilename('mapgen', ext);

      this.downloadBlob(blob, fname);

      return {
        success: true,
        filename: fname,
        size: blob.size,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Export image failed:', msg);
      return { success: false, error: msg };
    }
  }

  // ── 数据导出 ──────────────────────────────────────────

  /**
   * 导出地图数据为 JSON
   */
  exportData(
    mapData: MapData,
    params: UIParams,
    options: Partial<ExportDataOptions> = {},
  ): ExportResult {
    const {
      includeParams = true,
      includeMetadata = true,
      includeTextureSummary = false,
      filename,
    } = options;

    try {
      const payload: ExportDataPayload = {
        version: '0.0.3',
        exportedAt: new Date().toISOString(),
      };

      if (includeMetadata) {
        payload.metadata = {
          seed: params.seedStr,
          width: mapData.width,
          height: mapData.height,
          pixels: mapData.width * mapData.height,
          landPercent: computeLandPercent(mapData.elevTex, params.seaLevel),
          plateCount: mapData.plates.length,
          riverCount: mapData.rivers.length,
          regionCount: mapData.regions.length,
        };
      }

      if (includeParams) {
        payload.params = { ...params } as Record<string, unknown>;
      }

      if (includeTextureSummary) {
        payload.textureSummary = [
          computeTextureStats(mapData.elevTex, 'elevation', 4),
          computeTextureStats(mapData.plateTex, 'plate', 4),
          computeTextureStats(mapData.moistTex, 'moisture', 4),
          computeTextureStats(mapData.tempTex, 'temperature', 4),
          computeTextureStats(mapData.riverTex, 'river', 4),
        ];
        if (mapData.currentTex) {
          payload.textureSummary.push(computeTextureStats(mapData.currentTex, 'oceanCurrents', 4));
        }
        if (mapData.iceTex) {
          payload.textureSummary.push(computeTextureStats(mapData.iceTex, 'ice', 4));
        }
      }

      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const fname = filename
        ? `${filename}.json`
        : generateFilename('mapgen-data', 'json');

      this.downloadBlob(blob, fname);

      return {
        success: true,
        filename: fname,
        size: blob.size,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Export data failed:', msg);
      return { success: false, error: msg };
    }
  }

  // ── 内部方法 ──────────────────────────────────────────

  private canvasToBlob(
    canvas: HTMLCanvasElement,
    format: ExportFormat,
    quality?: number,
  ): Promise<Blob | null> {
    return new Promise((resolve) => {
      const mime = FORMAT_MIME[format];
      const q = quality ?? DEFAULT_QUALITY[format];
      canvas.toBlob(
        (blob) => resolve(blob),
        mime,
        format === 'png' ? undefined : q,
      );
    });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

/** 全局单例 */
export const exportManager = new ExportManager();
