// 集中式日志器：避免 console.* 散落，并支持级别过滤

type Level = 'debug' | 'info' | 'warn' | 'error';

const RANK: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function envLevel(): Level {
  const g = globalThis as unknown as { __MAPGEN_LOG__?: Level };
  if (g.__MAPGEN_LOG__) return g.__MAPGEN_LOG__;
  return 'warn';
}

function emit(level: Level, ...args: unknown[]): void {
  if (RANK[level] < RANK[envLevel()]) return;
  const tag = `[mapgen:${level}]`;
  if (level === 'error') console.error(tag, ...args);
  else if (level === 'warn') console.warn(tag, ...args);
  else if (level === 'info') console.info(tag, ...args);
  else console.debug(tag, ...args);
}

export const logger = {
  debug: (...args: unknown[]) => emit('debug', ...args),
  info: (...args: unknown[]) => emit('info', ...args),
  warn: (...args: unknown[]) => emit('warn', ...args),
  error: (...args: unknown[]) => emit('error', ...args),
};
