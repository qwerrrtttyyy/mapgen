import { Colleague } from '../core/mediator.js';
import { bus } from '../core/eventBus.js';
import { logger } from '../core/logger.js';
import { debug as coreDebug } from '@mapgen/core';

export class DebugPanel extends Colleague {
  private panel: HTMLElement | null = null;
  private toggleBtn: HTMLElement | null = null;
  private fpsElement: HTMLElement | null = null;
  private frameTimeElement: HTMLElement | null = null;
  private drawCallsElement: HTMLElement | null = null;
  private memoryElement: HTMLElement | null = null;
  private timingsElement: HTMLElement | null = null;
  private isOpen: boolean = false;
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fps: number = 0;
  private listeners: Array<() => void> = [];

  constructor() {
    super('debug');
  }

  bind(): void {
    if (this.mediator) {
      this.bindWithMediator();
    } else {
      this.bindWithBus();
    }
    this.createPanel();
  }

  private bindWithMediator(): void {
    this.listeners.push(
      this.subscribe('debug.toggle', () => this.toggle()),
      this.subscribe('debug.open', () => this.open()),
      this.subscribe('debug.close', () => this.close()),
      this.subscribe('render.frame', data => {
        coreDebug.updateMetrics({ drawCalls: data.drawCalls, textureCount: data.textureCount });
      })
    );
  }

  private bindWithBus(): void {
    this.listeners.push(
      bus.on('debug.toggle', () => this.toggle()),
      bus.on('debug.open', () => this.open()),
      bus.on('debug.close', () => this.close()),
      bus.on('render.frame', (data: { drawCalls: number; textureCount: number }) => {
        coreDebug.updateMetrics({ drawCalls: data.drawCalls, textureCount: data.textureCount });
      })
    );
  }

  private createPanel(): void {
    this.toggleBtn = document.createElement('button');
    this.toggleBtn.id = 'btn-debug';
    this.toggleBtn.className = 'tb-btn tb-btn-icon';
    this.toggleBtn.title = '调试模式 (F3)';
    this.toggleBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 1.5l1.5 3.5 3.5.5-2.5 2.5.6 3.5L7 9.5l-3.1 2 .6-3.5L2 5.5l3.5-.5L7 1.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
      </svg>
    `;
    this.toggleBtn.addEventListener('click', () => {
      this.send('debug.toggle');
    });

    const topbarRight = document.querySelector('.tb-right');
    if (topbarRight) {
      topbarRight.insertBefore(this.toggleBtn, topbarRight.firstChild);
    }

    this.panel = document.createElement('div');
    this.panel.id = 'debug-panel';
    this.panel.className = 'debug-panel';
    this.panel.innerHTML = `
      <div class="dp-header">
        <span class="dp-title">🛠️ 调试面板</span>
        <button class="dp-close" id="dp-close">×</button>
      </div>
      <div class="dp-body">
        <div class="dp-section">
          <div class="dp-section-title">性能</div>
          <div class="dp-row">
            <span class="dp-label">FPS</span>
            <span class="dp-value dp-fps" id="dp-fps">0</span>
          </div>
          <div class="dp-row">
            <span class="dp-label">帧时间</span>
            <span class="dp-value dp-frametime" id="dp-frametime">0ms</span>
          </div>
          <div class="dp-row">
            <span class="dp-label">Draw Calls</span>
            <span class="dp-value" id="dp-drawcalls">0</span>
          </div>
          <div class="dp-row">
            <span class="dp-label">内存</span>
            <span class="dp-value" id="dp-memory">—</span>
          </div>
        </div>

        <div class="dp-section">
          <div class="dp-section-title">渲染调试</div>
          <label class="dp-check">
            <input type="checkbox" id="dp-wireframe">
            <span>线框模式</span>
          </label>
          <label class="dp-check">
            <input type="checkbox" id="dp-normals">
            <span>显示法线</span>
          </label>
          <label class="dp-check">
            <input type="checkbox" id="dp-overlay" checked>
            <span>显示调试覆盖层</span>
          </label>
        </div>

        <div class="dp-section">
          <div class="dp-section-title">日志级别</div>
          <select id="dp-loglevel" class="dp-select">
            <option value="debug">Debug</option>
            <option value="info" selected>Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div class="dp-section">
          <div class="dp-section-title">计时统计</div>
          <div class="dp-timings" id="dp-timings"></div>
        </div>

        <div class="dp-section">
          <div class="dp-section-title">快捷操作</div>
          <button class="dp-btn" id="dp-reset">重置统计</button>
          <button class="dp-btn" id="dp-export">导出调试信息</button>
        </div>
      </div>
    `;

    document.getElementById('app')?.appendChild(this.panel);

    this.fpsElement = document.getElementById('dp-fps');
    this.frameTimeElement = document.getElementById('dp-frametime');
    this.drawCallsElement = document.getElementById('dp-drawcalls');
    this.memoryElement = document.getElementById('dp-memory');
    this.timingsElement = document.getElementById('dp-timings');

    const closeBtn = document.getElementById('dp-close');
    if (closeBtn) {
      const handler = (): void => this.emit('debug.toggle');
      closeBtn.addEventListener('click', handler);
      this.listeners.push(() => closeBtn.removeEventListener('click', handler));
    }

    const wireframeEl = document.getElementById('dp-wireframe') as HTMLInputElement | null;
    if (wireframeEl) {
      const handler = (e: Event): void => {
        const checked = (e.target as HTMLInputElement).checked;
        coreDebug.setShowWireframe(checked);
        this.emit('debug.wireframe.changed', { enabled: checked });
      };
      wireframeEl.addEventListener('change', handler);
      this.listeners.push(() => wireframeEl.removeEventListener('change', handler));
    }

    const normalsEl = document.getElementById('dp-normals') as HTMLInputElement | null;
    if (normalsEl) {
      const handler = (e: Event): void => {
        const checked = (e.target as HTMLInputElement).checked;
        coreDebug.setShowNormals(checked);
        this.emit('debug.normals.changed', { enabled: checked });
      };
      normalsEl.addEventListener('change', handler);
      this.listeners.push(() => normalsEl.removeEventListener('change', handler));
    }

    const overlayEl = document.getElementById('dp-overlay') as HTMLInputElement | null;
    if (overlayEl) {
      const handler = (e: Event): void => {
        coreDebug.setShowOverlay((e.target as HTMLInputElement).checked);
      };
      overlayEl.addEventListener('change', handler);
      this.listeners.push(() => overlayEl.removeEventListener('change', handler));
    }

    const logLevelEl = document.getElementById('dp-loglevel') as HTMLSelectElement | null;
    if (logLevelEl) {
      const handler = (e: Event): void => {
        const level = (e.target as HTMLSelectElement).value as 'debug' | 'info' | 'warn' | 'error';
        coreDebug.setLogLevel(level);
        logger.info(`Log level changed to ${level}`);
      };
      logLevelEl.addEventListener('change', handler);
      this.listeners.push(() => logLevelEl.removeEventListener('change', handler));
    }

    const resetBtn = document.getElementById('dp-reset');
    if (resetBtn) {
      const handler = (): void => {
        coreDebug.resetMetrics();
        this.updateTimings();
      };
      resetBtn.addEventListener('click', handler);
      this.listeners.push(() => resetBtn.removeEventListener('click', handler));
    }

    const exportBtn = document.getElementById('dp-export');
    if (exportBtn) {
      const handler = (): void => this.exportDebugInfo();
      exportBtn.addEventListener('click', handler);
      this.listeners.push(() => exportBtn.removeEventListener('click', handler));
    }
  }

  private emit(
    event:
      | 'debug.toggle'
      | 'debug.open'
      | 'debug.close'
      | 'debug.wireframe.changed'
      | 'debug.normals.changed',
    payload?: unknown
  ): void {
    if (this.mediator) {
      (this.mediator as { send: (sender: string, event: string, payload?: unknown) => void }).send(
        'debug',
        event,
        payload
      );
    } else {
      bus.emit(event, payload);
    }
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    this.isOpen = true;
    coreDebug.enable(true);
    this.panel?.classList.add('open');
    this.toggleBtn?.classList.add('active');
    this.startFpsCounter();
    logger.info('Debug panel opened');
  }

  close(): void {
    this.isOpen = false;
    coreDebug.enable(false);
    this.panel?.classList.remove('open');
    this.toggleBtn?.classList.remove('active');
    this.stopFpsCounter();
    logger.info('Debug panel closed');
  }

  private startFpsCounter(): void {
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
    this.updateLoop();
  }

  private stopFpsCounter(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private updateLoop(): void {
    this.frameCount++;
    const now = performance.now();
    const delta = now - this.lastFrameTime;

    if (delta >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / delta);
      const avgFrameTime = delta / this.frameCount;
      coreDebug.updateMetrics({ fps: this.fps, frameTime: avgFrameTime });
      this.updateDisplay();
      this.frameCount = 0;
      this.lastFrameTime = now;
      this.updateTimings();
    }

    this.animationFrameId = requestAnimationFrame(() => this.updateLoop());
  }

  private updateDisplay(): void {
    const metrics = coreDebug.metrics;

    if (this.fpsElement) {
      this.fpsElement.textContent = String(metrics.fps);
      this.fpsElement.className = 'dp-value dp-fps ' + this.getFpsClass(metrics.fps);
    }

    if (this.frameTimeElement) {
      this.frameTimeElement.textContent = `${metrics.frameTime.toFixed(2)}ms`;
    }

    if (this.drawCallsElement) {
      this.drawCallsElement.textContent = String(metrics.drawCalls);
    }

    if (this.memoryElement) {
      const memory = (
        performance as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }
      ).memory;
      if (memory) {
        const usedMB = Math.round(memory.usedJSHeapSize / (1024 * 1024));
        const totalMB = Math.round(memory.totalJSHeapSize / (1024 * 1024));
        this.memoryElement.textContent = `${usedMB}/${totalMB}MB`;
        coreDebug.updateMetrics({ memoryUsage: usedMB });
      } else {
        this.memoryElement.textContent = 'N/A';
      }
    }
  }

  private getFpsClass(fps: number): string {
    if (fps >= 55) return 'fps-good';
    if (fps >= 30) return 'fps-medium';
    return 'fps-bad';
  }

  private updateTimings(): void {
    if (!this.timingsElement) return;

    const stats = coreDebug.getAllTimingStats();
    const entries = Object.entries(stats);

    if (entries.length === 0) {
      this.timingsElement.innerHTML = '<div class="dp-empty">暂无计时数据</div>';
      return;
    }

    this.timingsElement.innerHTML = entries
      .map(
        ([name, stat]) => `
        <div class="dp-timing-item">
          <div class="dp-timing-name">${name}</div>
          <div class="dp-timing-values">
            <span>avg: ${stat.avg.toFixed(2)}ms</span>
            <span>min: ${stat.min.toFixed(2)}ms</span>
            <span>max: ${stat.max.toFixed(2)}ms</span>
            <span>n: ${stat.count}</span>
          </div>
        </div>
      `
      )
      .join('');
  }

  private exportDebugInfo(): void {
    const info = {
      timestamp: new Date().toISOString(),
      metrics: coreDebug.metrics,
      timings: coreDebug.getAllTimingStats(),
      state: {
        enabled: coreDebug.enabled,
        showWireframe: coreDebug.showWireframe,
        showNormals: coreDebug.showNormals,
        logLevel: coreDebug.logLevel,
      },
    };

    const blob = new Blob([JSON.stringify(info, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mapgen-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    logger.info('Debug info exported');
  }

  destroy(): void {
    this.stopFpsCounter();
    this.listeners.forEach(fn => fn());
    this.listeners = [];
    this.panel?.remove();
    this.toggleBtn?.remove();
  }
}
