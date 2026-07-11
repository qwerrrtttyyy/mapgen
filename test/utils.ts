export function measureTime<T>(fn: () => T): { result: T; durationMs: number } {
  const start = performance.now();
  const result = fn();
  const durationMs = performance.now() - start;
  return { result, durationMs };
}

export async function measureTimeAsync<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;
  return { result, durationMs };
}

export function runBenchmark(
  name: string,
  fn: () => void,
  iterations = 100,
  warmup = 10
): BenchmarkResult {
  for (let i = 0; i < warmup; i++) {
    fn();
  }

  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  times.sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);
  const mean = sum / times.length;
  const variance = times.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);

  return {
    name,
    iterations,
    mean,
    median: times[Math.floor(times.length / 2)],
    min: times[0],
    max: times[times.length - 1],
    stdDev,
    p95: times[Math.floor(times.length * 0.95)],
    p99: times[Math.floor(times.length * 0.99)],
    totalTime: sum,
  };
}

export interface BenchmarkResult {
  name: string;
  iterations: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
  p95: number;
  p99: number;
  totalTime: number;
}

export function formatBenchmarkResult(result: BenchmarkResult): string {
  return [
    `\n📊 ${result.name}`,
    `  迭代次数: ${result.iterations}`,
    `  平均: ${result.mean.toFixed(3)}ms`,
    `  中位数: ${result.median.toFixed(3)}ms`,
    `  最小: ${result.min.toFixed(3)}ms`,
    `  最大: ${result.max.toFixed(3)}ms`,
    `  P95: ${result.p95.toFixed(3)}ms`,
    `  P99: ${result.p99.toFixed(3)}ms`,
    `  标准差: ${result.stdDev.toFixed(3)}ms`,
    `  总耗时: ${result.totalTime.toFixed(2)}ms`,
  ].join('\n');
}

export function generateNoiseMap(width: number, height: number, seed = 42): Float32Array {
  const data = new Float32Array(width * height);
  let s = seed;
  for (let i = 0; i < data.length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    data[i] = (s / 0xffffffff) * 2 - 1;
  }
  return data;
}

export function approxEqual(a: number, b: number, epsilon = 0.001): boolean {
  return Math.abs(a - b) < epsilon;
}

export function arraysApproxEqual(a: Float32Array, b: Float32Array, epsilon = 0.001): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > epsilon) return false;
  }
  return true;
}
