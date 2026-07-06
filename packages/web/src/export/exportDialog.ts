/**
 * ExportDialog - 导出选项对话框
 *
 * 支持图片导出（格式/分辨率）和数据导出（JSON）
 */

import { exportManager, type ExportFormat, type ExportScale, type ExportResult } from './exportManager.js';
import type { MapData } from '@mapgen/core';
import type { UIParams } from '../core/appState.js';
import { bus } from '../core/eventBus.js';
import { logger } from '../core/logger.js';

interface DialogElements {
  overlay: HTMLDivElement;
  dialog: HTMLDivElement;
  formatSelect: HTMLSelectElement;
  scaleSelect: HTMLSelectElement;
  qualitySlider: HTMLInputElement;
  qualityVal: HTMLSpanElement;
  qualityRow: HTMLDivElement;
  btnExportImg: HTMLButtonElement;
  btnExportData: HTMLButtonElement;
  btnExportDataSummary: HTMLButtonElement;
  btnClose: HTMLButtonElement;
  statusEl: HTMLDivElement;
}

const DIALOG_HTML = `
<div id="export-overlay" style="display:none;position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.5);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;">
  <div id="export-dialog" style="background:var(--surface,#1e1e2e);border:1px solid var(--outline,#444);border-radius:16px;padding:24px;min-width:340px;max-width:420px;color:var(--on-surface,#eee);font-family:system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.4);">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <h3 style="margin:0;font-size:18px;font-weight:600;">导出地图</h3>
      <button id="export-close" style="background:none;border:none;color:var(--on-surface-variant,#aaa);cursor:pointer;font-size:20px;padding:4px 8px;border-radius:8px;" title="关闭">✕</button>
    </div>

    <!-- 图片导出 -->
    <div style="margin-bottom:16px;">
      <div style="font-size:13px;font-weight:500;color:var(--primary,#89b4fa);margin-bottom:8px;">📷 图片导出</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--on-surface-variant,#aaa);">
          格式
          <select id="export-format" style="background:var(--surface-variant,#2a2a3e);border:1px solid var(--outline,#444);border-radius:8px;padding:6px 8px;color:inherit;font-size:13px;">
            <option value="png">PNG（无损）</option>
            <option value="jpeg">JPEG（有损，体积小）</option>
            <option value="webp">WebP（高效压缩）</option>
          </select>
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--on-surface-variant,#aaa);">
          分辨率
          <select id="export-scale" style="background:var(--surface-variant,#2a2a3e);border:1px solid var(--outline,#444);border-radius:8px;padding:6px 8px;color:inherit;font-size:13px;">
            <option value="1">1× 原始</option>
            <option value="2">2× 高清</option>
            <option value="4">4× 超高清</option>
          </select>
        </label>
      </div>
      <div id="export-quality-row" style="display:none;margin-bottom:8px;">
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--on-surface-variant,#aaa);">
          质量
          <input id="export-quality" type="range" min="10" max="100" value="92" style="flex:1;accent-color:var(--primary,#89b4fa);">
          <span id="export-quality-val" style="min-width:32px;text-align:right;font-size:12px;">92%</span>
        </label>
      </div>
      <button id="export-img-btn" style="width:100%;padding:10px;background:var(--primary,#89b4fa);color:var(--on-primary,#111);border:none;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer;transition:opacity 0.15s;">
        导出图片
      </button>
    </div>

    <div style="border-top:1px solid var(--outline,#444);margin:12px 0;"></div>

    <!-- 数据导出 -->
    <div>
      <div style="font-size:13px;font-weight:500;color:var(--secondary,#a6e3a1);margin-bottom:8px;">📊 数据导出</div>
      <div style="display:flex;gap:8px;">
        <button id="export-data-btn" style="flex:1;padding:10px;background:var(--surface-variant,#2a2a3e);color:var(--on-surface,#eee);border:1px solid var(--outline,#444);border-radius:10px;font-size:13px;cursor:pointer;transition:background 0.15s;">
          参数 + 元数据
        </button>
        <button id="export-data-summary-btn" style="flex:1;padding:10px;background:var(--surface-variant,#2a2a3e);color:var(--on-surface,#eee);border:1px solid var(--outline,#444);border-radius:10px;font-size:13px;cursor:pointer;transition:background 0.15s;">
          含纹理统计
        </button>
      </div>
    </div>

    <div id="export-status" style="margin-top:12px;font-size:12px;color:var(--on-surface-variant,#aaa);min-height:18px;"></div>
  </div>
</div>
`;

function createDialogElements(): DialogElements {
  const container = document.createElement('div');
  container.innerHTML = DIALOG_HTML;
  document.body.appendChild(container);

  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

  return {
    overlay: $('export-overlay'),
    dialog: $('export-dialog'),
    formatSelect: $('export-format'),
    scaleSelect: $('export-scale'),
    qualitySlider: $('export-quality'),
    qualityVal: $('export-quality-val'),
    qualityRow: $('export-quality-row'),
    btnExportImg: $('export-img-btn'),
    btnExportData: $('export-data-btn'),
    btnExportDataSummary: $('export-data-summary-btn'),
    btnClose: $('export-close'),
    statusEl: $('export-status'),
  };
}

export class ExportDialog {
  private els: DialogElements | null = null;
  private isOpen = false;

  /** 初始化对话框 DOM（首次调用时创建） */
  private ensureElements(): DialogElements {
    if (!this.els) {
      this.els = createDialogElements();
      this.bindEvents(this.els);
    }
    return this.els;
  }

  /** 打开对话框 */
  open(): void {
    const els = this.ensureElements();
    els.overlay.style.display = 'flex';
    this.isOpen = true;
    this.setStatus('');
  }

  /** 关闭对话框 */
  close(): void {
    if (this.els) {
      this.els.overlay.style.display = 'none';
    }
    this.isOpen = false;
  }

  /** 切换开关 */
  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  private bindEvents(els: DialogElements): void {
    // 关闭
    els.btnClose.addEventListener('click', () => this.close());
    els.overlay.addEventListener('click', (e) => {
      if (e.target === els.overlay) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });

    // 格式切换 → 显示/隐藏质量滑块
    els.formatSelect.addEventListener('change', () => {
      const fmt = els.formatSelect.value as ExportFormat;
      els.qualityRow.style.display = fmt === 'png' ? 'none' : '';
    });

    // 质量滑块
    els.qualitySlider.addEventListener('input', () => {
      els.qualityVal.textContent = els.qualitySlider.value + '%';
    });

    // 图片导出
    els.btnExportImg.addEventListener('click', () => this.handleExportImage());

    // 数据导出
    els.btnExportData.addEventListener('click', () => this.handleExportData(false));
    els.btnExportDataSummary.addEventListener('click', () => this.handleExportData(true));
  }

  private async handleExportImage(): Promise<void> {
    if (!this.els) return;

    const format = this.els.formatSelect.value as ExportFormat;
    const scale = parseInt(this.els.scaleSelect.value, 10) as ExportScale;
    const quality = parseInt(this.els.qualitySlider.value, 10) / 100;

    this.setStatus('正在导出...');
    this.els.btnExportImg.disabled = true;

    const result = await exportManager.exportImage({ format, scale, quality });

    this.els.btnExportImg.disabled = false;
    this.showResult(result);
  }

  private handleExportData(includeSummary: boolean): void {
    if (!this.els) return;

    // 从全局状态获取数据
    const mapData = (window as unknown as { __mapgen?: { state: { mapData: MapData | null; params: UIParams } } }).__mapgen?.state;
    if (!mapData?.mapData) {
      this.setStatus('⚠️ 请先生成地图');
      return;
    }

    this.setStatus('正在导出...');

    const result = exportManager.exportData(mapData.mapData, mapData.params, {
      includeParams: true,
      includeMetadata: true,
      includeTextureSummary: includeSummary,
    });

    this.showResult(result);
  }

  private showResult(result: ExportResult): void {
    if (result.success) {
      const sizeKB = result.size ? (result.size / 1024).toFixed(1) : '?';
      this.setStatus(`✅ 已导出 ${result.filename}（${sizeKB} KB）`);
    } else {
      this.setStatus(`❌ 导出失败: ${result.error}`);
    }
  }

  private setStatus(text: string): void {
    if (this.els) {
      this.els.statusEl.textContent = text;
    }
  }
}

/** 全局单例 */
export const exportDialog = new ExportDialog();
