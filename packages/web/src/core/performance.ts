import { bus } from './eventBus.js';

export interface FrameStats {
  fps: number;
  frameTime: number;
  minFrameTime: number;
  maxFrameTime: number;
  avgFrameTime: number;
  renderCount: number;
}

export class PerformanceMonitor {
  private lastFrameTime = 0;
  private frameTimes: number[] = [];
  private renderCount = 0;
  private statsUpdateInterval = 500;
  private lastStatsUpdate = 0;
  private currentFps = 0;
  private enabled = false;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.lastFrameTime = 0;
    this.frameTimes = [];
    this.renderCount = 0;
    this.lastStatsUpdate = 0;
    this.currentFps = 0;
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  beginFrame(): void {
    const now = performance.now();
    
    if (this.lastFrameTime > 0) {
      const delta = now - this.lastFrameTime;
      this.frameTimes.push(delta);
      
      if (this.frameTimes.length > 60) {
        this.frameTimes.shift();
      }
      
      this.renderCount++;
    }
    
    this.lastFrameTime = now;
    
    if (this.enabled && now - this.lastStatsUpdate > this.statsUpdateInterval) {
      this.updateStats();
      this.lastStatsUpdate = now;
    }
  }

  private updateStats(): void {
    if (this.frameTimes.length === 0) return;
    
    const sum = this.frameTimes.reduce((a, b) => a + b, 0);
    const avg = sum / this.frameTimes.length;
    const min = Math.min(...this.frameTimes);
    const max = Math.max(...this.frameTimes);
    const fps = 1000 / avg;
    
    this.currentFps = fps;
    
    const stats: FrameStats = {
      fps: Math.round(fps * 10) / 10,
      frameTime: Math.round(avg * 100) / 100,
      minFrameTime: Math.round(min * 100) / 100,
      maxFrameTime: Math.round(max * 100) / 100,
      avgFrameTime: Math.round(avg * 100) / 100,
      renderCount: this.renderCount,
    };
    
    bus.emit('perf.stats', stats);
  }

  getStats(): FrameStats {
    if (this.frameTimes.length === 0) {
      return {
        fps: 0,
        frameTime: 0,
        minFrameTime: 0,
        maxFrameTime: 0,
        avgFrameTime: 0,
        renderCount: 0,
      };
    }
    
    const sum = this.frameTimes.reduce((a, b) => a + b, 0);
    const avg = sum / this.frameTimes.length;
    
    return {
      fps: Math.round((1000 / avg) * 10) / 10,
      frameTime: Math.round(avg * 100) / 100,
      minFrameTime: Math.round(Math.min(...this.frameTimes) * 100) / 100,
      maxFrameTime: Math.round(Math.max(...this.frameTimes) * 100) / 100,
      avgFrameTime: Math.round(avg * 100) / 100,
      renderCount: this.renderCount,
    };
  }

  markEvent(name: string, duration?: number): void {
    if (!this.enabled) return;
    bus.emit('perf.event', { name, duration, timestamp: performance.now() });
  }
}

export const perfMonitor = new PerformanceMonitor();
