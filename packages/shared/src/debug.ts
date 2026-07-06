export interface DebugMetrics {
  fps: number;
  frameTime: number;
  drawCalls: number;
  textureCount: number;
  memoryUsage: number;
}

export interface DebugTiming {
  name: string;
  duration: number;
  start: number;
}

export interface DebugState {
  enabled: boolean;
  showOverlay: boolean;
  showWireframe: boolean;
  showNormals: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  metrics: DebugMetrics;
  timings: DebugTiming[];
  maxTimings: number;
}

type ConsoleLike = {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

type PerformanceLike = {
  now: () => number;
};

declare const globalThis: {
  console?: ConsoleLike;
  performance?: PerformanceLike;
  __MAPGEN_DEBUG__?: typeof debug;
} & Record<string, unknown>;

function getConsole(): ConsoleLike {
  return globalThis.console ?? {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}

function getPerformance(): PerformanceLike {
  return globalThis.performance ?? { now: () => Date.now() };
}

const state: DebugState = {
  enabled: false,
  showOverlay: true,
  showWireframe: false,
  showNormals: false,
  logLevel: 'warn',
  metrics: {
    fps: 0,
    frameTime: 0,
    drawCalls: 0,
    textureCount: 0,
    memoryUsage: 0,
  },
  timings: [],
  maxTimings: 60,
};

export const debug = {
  get enabled(): boolean {
    return state.enabled;
  },

  get showOverlay(): boolean {
    return state.showOverlay;
  },

  get showWireframe(): boolean {
    return state.showWireframe;
  },

  get showNormals(): boolean {
    return state.showNormals;
  },

  get logLevel(): string {
    return state.logLevel;
  },

  get metrics(): DebugMetrics {
    return { ...state.metrics };
  },

  get timings(): DebugTiming[] {
    return [...state.timings];
  },

  enable(enabled = true): void {
    state.enabled = enabled;
  },

  toggle(): boolean {
    state.enabled = !state.enabled;
    return state.enabled;
  },

  setShowOverlay(show: boolean): void {
    state.showOverlay = show;
  },

  setShowWireframe(show: boolean): void {
    state.showWireframe = show;
  },

  setShowNormals(show: boolean): void {
    state.showNormals = show;
  },

  setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    state.logLevel = level;
  },

  updateMetrics(metrics: Partial<DebugMetrics>): void {
    Object.assign(state.metrics, metrics);
  },

  addTiming(name: string, duration: number): void {
    const timing: DebugTiming = {
      name,
      duration,
      start: getPerformance().now(),
    };
    state.timings.push(timing);
    if (state.timings.length > state.maxTimings) {
      state.timings.shift();
    }
  },

  resetMetrics(): void {
    state.metrics = {
      fps: 0,
      frameTime: 0,
      drawCalls: 0,
      textureCount: 0,
      memoryUsage: 0,
    };
    state.timings = [];
  },

  assert(condition: boolean, message: string): void {
    if (state.enabled && !condition) {
      getConsole().error(`[DEBUG ASSERT] ${message}`);
    }
  },

  log(level: 'debug' | 'info' | 'warn' | 'error', ...args: unknown[]): void {
    if (!state.enabled) return;
    const ranks: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
    if (ranks[level] < ranks[state.logLevel]) return;
    const tag = `[debug:${level}]`;
    const cons = getConsole();
    if (level === 'error') cons.error(tag, ...args);
    else if (level === 'warn') cons.warn(tag, ...args);
    else if (level === 'info') cons.info(tag, ...args);
    else cons.debug(tag, ...args);
  },

  measure<T>(name: string, fn: () => T): T {
    if (!state.enabled) return fn();
    const start = getPerformance().now();
    try {
      return fn();
    } finally {
      const duration = getPerformance().now() - start;
      this.addTiming(name, duration);
    }
  },

  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    if (!state.enabled) return fn();
    const start = getPerformance().now();
    try {
      return await fn();
    } finally {
      const duration = getPerformance().now() - start;
      this.addTiming(name, duration);
    }
  },

  getTimingStats(name: string): { avg: number; min: number; max: number; count: number } | null {
    const filtered = state.timings.filter(t => t.name === name);
    if (filtered.length === 0) return null;
    const durations = filtered.map(t => t.duration);
    return {
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      count: durations.length,
    };
  },

  getAllTimingStats(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const names = new Set(state.timings.map(t => t.name));
    const result: Record<string, { avg: number; min: number; max: number; count: number }> = {};
    for (const name of names) {
      const stats = this.getTimingStats(name);
      if (stats) result[name] = stats;
    }
    return result;
  },

  toJSON(): DebugState {
    return { ...state, timings: [...state.timings] };
  },
};

export function setupDebugGlobal(): void {
  const g = globalThis as unknown as { __MAPGEN_DEBUG__?: typeof debug };
  g.__MAPGEN_DEBUG__ = debug;
}

export function getDebug(): typeof debug {
  const g = globalThis as unknown as { __MAPGEN_DEBUG__?: typeof debug };
  return g.__MAPGEN_DEBUG__ ?? debug;
}