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
  private eventsElement: HTMLElement | null = null;
  private eventFilterInput: HTMLInputElement | null = null;
  private renderInfoElement: HTMLElement | null = null;
  private isOpen: boolean = false;
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fps: number = 0;
  private listeners: Array<() => void> = [];
  private eventFilter: string = '';

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
    this.bindGlobalEvents();
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

  private bindGlobalEvents(): void {
    const eventTypes = [
      'render.request',
      'generate.request',
      'generating.started',
      'generating.completed',
      'generating.failed',
      'progress',
      'selection.changed',
      'params.changed',
      'editor.committed',
      'export.request',
    ];

    eventTypes.forEach(eventName => {
      this.listeners.push(
        bus.on(eventName, (payload: unknown) => {
          if (coreDebug.enabled) {
            coreDebug.addEvent(eventName, payload, 'eventBus');
          }
        })
      );
    });
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
          <div class="dp-section-title">性能指标</div>
          <div class="dp-grid">
            <div class="dp-stat">
              <span class="dp-stat-label">FPS</span>
              <span class="dp-stat-value dp-fps" id="dp-fps">0</span>
            </div>
            <div class="dp-stat">
              <span class="dp-stat-label">帧时间</span>
              <span class="dp-stat-value" id="dp-frametime">0ms</span>
            </div>
            <div class="dp-stat">
              <span class="dp-stat-label">Draw Calls</span>
              <span class="dp-stat-value" id="dp-drawcalls">0</span>
            </div>
            <div class="dp-stat">
              <span class="dp-stat-label">内存</span>
              <span class="dp-stat-value" id="dp-memory">—</span>
            </div>
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
          <div class="dp-section-title">渲染状态</div>
          <div class="dp-info-list" id="dp-render-info">
            <div class="dp-info-item">
              <span class="dp-info-label">纹理数量</span>
              <span class="dp-info-value" id="dp-texcount">0</span>
            </div>
            <div class="dp-info-item">
              <span class="dp-info-label">地图尺寸</span>
              <span class="dp-info-value" id="dp-mapsize">—</span>
            </div>
            <div class="dp-info-item">
              <span class="dp-info-label">着色器程序</span>
              <span class="dp-info-value" id="dp-program">—</span>
            </div>
          </div>
        </div>

        <div class="dp-section">
          <div class="dp-section-header">
            <span class="dp-section-title">计时统计</span>
            <button class="dp-btn-sm" id="dp-reset-timings">重置</button>
          </div>
          <div class="dp-timings" id="dp-timings"></div>
        </div>

        <div class="dp-section">
          <div class="dp-section-header">
            <span class="dp-section-title">事件日志</span>
            <button class="dp-btn-sm" id="dp-clear-events">清空</button>
          </div>
          <input type="text" id="dp-event-filter" class="dp-input" placeholder="过滤事件...">
          <div class="dp-events" id="dp-events"></div>
        </div>

        <div class="dp-section">
          <div class="dp-section-title">快捷操作</div>
          <div class="dp-btn-group">
            <button class="dp-btn" id="dp-reset-all">重置所有</button>
            <button class="dp-btn" id="dp-export">导出调试信息</button>
            <button class="dp-btn" id="dp-snapshot">生成快照</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('app')?.appendChild(this.panel);

    this.fpsElement = document.getElementById('dp-fps');
    this.frameTimeElement = document.getElementById('dp-frametime');
    this.drawCallsElement = document.getElementById('dp-drawcalls');
    this.memoryElement = document.getElementById('dp-memory');
    this.timingsElement = document.getElementById('dp-timings');
    this.eventsElement = document.getElementById('dp-events');
    this.renderInfoElement = document.getElementById('dp-render-info');
    this.eventFilterInput = document.getElementById('dp-event-filter') as HTMLInputElement | null;

    this.bindPanelEvents();
  }

  private bindPanelEvents(): void {
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

    const resetTimingsBtn = document.getElementById('dp-reset-timings');
    if (resetTimingsBtn) {
      const handler = (): void => {
        coreDebug.resetMetrics();
        this.updateTimings();
      };
      resetTimingsBtn.addEventListener('click', handler);
      this.listeners.push(() => resetTimingsBtn.removeEventListener('click', handler));
    }

    const clearEventsBtn = document.getElementById('dp-clear-events');
    if (clearEventsBtn) {
      const handler = (): void => {
        coreDebug.clearEvents();
        this.updateEvents();
      };
      clearEventsBtn.addEventListener('click', handler);
      this.listeners.push(() => clearEventsBtn.removeEventListener('click', handler));
    }

    if (this.eventFilterInput) {
      const handler = (e: Event): void => {
        this.eventFilter = (e.target as HTMLInputElement).value;
        this.updateEvents();
      };
      this.eventFilterInput.addEventListener('input', handler);
      this.listeners.push(() => this.eventFilterInput?.removeEventListener('input', handler));
    }

    const resetAllBtn = document.getElementById('dp-reset-all');
    if (resetAllBtn) {
      const handler = (): void => {
        coreDebug.resetMetrics();
        coreDebug.clearEvents();
        this.updateTimings();
        this.updateEvents();
      };
      resetAllBtn.addEventListener('click', handler);
      this.listeners.push(() => resetAllBtn.removeEventListener('click', handler));
    }

    const exportBtn = document.getElementById('dp-export');
    if (exportBtn) {
      const handler = (): void => this.exportDebugInfo();
      exportBtn.addEventListener('click', handler);
      this.listeners.push(() => exportBtn.removeEventListener('click', handler));
    }

    const snapshotBtn = document.getElementById('dp-snapshot');
    if (snapshotBtn) {
      const handler = (): void => this.takeSnapshot();
      snapshotBtn.addEventListener('click', handler);
      this.listeners.push(() => snapshotBtn.removeEventListener('click', handler));
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
      this.updateEvents();
    }

    this.animationFrameId = requestAnimationFrame(() => this.updateLoop());
  }

  private updateDisplay(): void {
    const metrics = coreDebug.metrics;

    if (this.fpsElement) {
      this.fpsElement.textContent = String(metrics.fps);
      this.fpsElement.className = 'dp-stat-value dp-fps ' + this.getFpsClass(metrics.fps);
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

    const texCountEl = document.getElementById('dp-texcount');
    if (texCountEl) {
      texCountEl.textContent = String(metrics.textureCount || 0);
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
            <span class="dp-timing-avg">${stat.avg.toFixed(2)}ms</span>
            <span class="dp-timing-range">${stat.min.toFixed(2)}~${stat.max.toFixed(2)}ms</span>
            <span class="dp-timing-count">×${stat.count}</span>
          </div>
        </div>
      `
      )
      .join('');
  }

  private updateEvents(): void {
    if (!this.eventsElement) return;

    const events = coreDebug.getEventHistory(this.eventFilter || undefined);

    if (events.length === 0) {
      this.eventsElement.innerHTML = '<div class="dp-empty">暂无事件数据</div>';
      return;
    }

    this.eventsElement.innerHTML = events
      .map(event => {
        const time = new Date(event.timestamp).toLocaleTimeString('zh-CN', {
          hour12: false,
        });
        const payloadStr = event.payload
          ? typeof event.payload === 'string'
            ? event.payload
            : JSON.stringify(event.payload)
          : '';
        return `
        <div class="dp-event-item">
          <div class="dp-event-time">${time}</div>
          <div class="dp-event-name">${event.name}</div>
          ${payloadStr ? `<div class="dp-event-payload">${payloadStr}</div>` : ''}
        </div>
      `;
      })
      .join('');

    this.eventsElement.scrollTop = this.eventsElement.scrollHeight;
  }

  private exportDebugInfo(): void {
    const info = {
      timestamp: new Date().toISOString(),
      metrics: coreDebug.metrics,
      timings: coreDebug.getAllTimingStats(),
      events: coreDebug.events,
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

  private takeSnapshot(): void {
    const snapshot = coreDebug.exportSnapshot();
    const blob = new Blob([snapshot], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mapgen-snapshot-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    logger.info('Debug snapshot taken');
  }

  destroy(): void {
    this.stopFpsCounter();
    this.listeners.forEach(fn => fn());
    this.listeners = [];
    this.panel?.remove();
    this.toggleBtn?.remove();
  }
}