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

export interface DebugEvent {
  id: string;
  name: string;
  timestamp: number;
  payload?: unknown;
  source?: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface DebugSnapshot {
  timestamp: number;
  metrics: DebugMetrics;
  timings: DebugTiming[];
  events: DebugEvent[];
  state: {
    enabled: boolean;
    logLevel: LogLevel;
    showWireframe: boolean;
    showNormals: boolean;
    showOverlay: boolean;
  };
}

export interface DebugState {
  enabled: boolean;
  showOverlay: boolean;
  showWireframe: boolean;
  showNormals: boolean;
  logLevel: LogLevel;
  metrics: DebugMetrics;
  timings: DebugTiming[];
  events: DebugEvent[];
  maxTimings: number;
  maxEvents: number;
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
  return (
    globalThis.console ?? {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }
  );
}

function getPerformance(): PerformanceLike {
  return globalThis.performance ?? { now: () => Date.now() };
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
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
  events: [],
  maxTimings: 60,
  maxEvents: 100,
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

  get logLevel(): LogLevel {
    return state.logLevel;
  },

  get metrics(): DebugMetrics {
    return { ...state.metrics };
  },

  get timings(): DebugTiming[] {
    return [...state.timings];
  },

  get events(): DebugEvent[] {
    return [...state.events];
  },

  enable(enabled = true): void {
    state.enabled = enabled;
    if (enabled) {
      this.log('info', 'Debug mode enabled');
    }
  },

  toggle(): boolean {
    state.enabled = !state.enabled;
    this.log('info', state.enabled ? 'Debug mode enabled' : 'Debug mode disabled');
    return state.enabled;
  },

  setShowOverlay(show: boolean): void {
    state.showOverlay = show;
  },

  setShowWireframe(show: boolean): void {
    state.showWireframe = show;
    this.log('debug', 'Wireframe mode', show ? 'enabled' : 'disabled');
  },

  setShowNormals(show: boolean): void {
    state.showNormals = show;
    this.log('debug', 'Normals mode', show ? 'enabled' : 'disabled');
  },

  setLogLevel(level: LogLevel): void {
    state.logLevel = level;
    this.log('info', `Log level changed to ${level}`);
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

  addEvent(name: string, payload?: unknown, source?: string): void {
    if (!state.enabled) return;
    const event: DebugEvent = {
      id: generateId(),
      name,
      timestamp: Date.now(),
      payload,
      source,
    };
    state.events.push(event);
    if (state.events.length > state.maxEvents) {
      state.events.shift();
    }
    this.log('debug', `Event: ${name}`, payload);
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

  clearEvents(): void {
    state.events = [];
  },

  assert(condition: boolean, message: string): void {
    if (state.enabled && !condition) {
      getConsole().error(`[DEBUG ASSERT] ${message}`);
    }
  },

  assertWithData(condition: boolean, message: string, data?: unknown): void {
    if (state.enabled && !condition) {
      getConsole().error(`[DEBUG ASSERT] ${message}`, data);
      this.addEvent('assertion_failure', { message, data }, 'assert');
    }
  },

  log(level: LogLevel, ...args: unknown[]): void {
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

  logIf(condition: boolean, level: LogLevel, ...args: unknown[]): void {
    if (condition) {
      this.log(level, ...args);
    }
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

  time(name: string): () => void {
    if (!state.enabled) return () => {};
    const start = getPerformance().now();
    return () => {
      const duration = getPerformance().now() - start;
      this.addTiming(name, duration);
    };
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

  snapshot(): DebugSnapshot {
    return {
      timestamp: getPerformance().now(),
      metrics: { ...state.metrics },
      timings: [...state.timings],
      events: [...state.events],
      state: {
        enabled: state.enabled,
        logLevel: state.logLevel,
        showWireframe: state.showWireframe,
        showNormals: state.showNormals,
        showOverlay: state.showOverlay,
      },
    };
  },

  exportSnapshot(): string {
    const snapshot = this.snapshot();
    snapshot.timestamp = Date.now();
    return JSON.stringify(snapshot, null, 2);
  },

  toJSON(): DebugState {
    return { ...state, timings: [...state.timings], events: [...state.events] };
  },

  getEventHistory(pattern?: string): DebugEvent[] {
    if (!pattern) return [...state.events];
    try {
      const regex = new RegExp(pattern, 'i');
      return state.events.filter(e => regex.test(e.name));
    } catch {
      const lower = pattern.toLowerCase();
      return state.events.filter(e => e.name.toLowerCase().includes(lower));
    }
  },

  getRecentEvents(count: number): DebugEvent[] {
    return state.events.slice(-count);
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
