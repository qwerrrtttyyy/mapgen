import { describe, it, expect } from 'bun:test';
import { createNoise } from '../noise.js';
import { LRUCache } from '../cache.js';

function measureTime<T>(fn: () => T): { result: T; durationMs: number } {
  const start = performance.now();
  const result = fn();
  const durationMs = performance.now() - start;
  return { result, durationMs };
}

function runBenchmark(
  name: string,
  fn: () => void,
  iterations = 100,
  warmup = 10
): any {
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

function formatBenchmarkResult(result: any): string {
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

function generateNoiseMap(width: number, height: number, seed = 42): Float32Array {
  const data = new Float32Array(width * height);
  let s = seed;
  for (let i = 0; i < data.length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    data[i] = (s / 0xffffffff) * 2 - 1;
  }
  return data;
}

const BENCHMARK_SIZE = 256;
const BENCHMARK_ITERATIONS = 50;

describe('性能基准测试', () => {
  it('噪声生成性能基准', () => {
    const noise = createNoise(42, 'simplex');

    const result = runBenchmark(
      'noise.sample (256x256)',
      () => {
        for (let y = 0; y < BENCHMARK_SIZE; y++) {
          for (let x = 0; x < BENCHMARK_SIZE; x++) {
            noise.sample(x * 0.01, y * 0.01);
          }
        }
      },
      BENCHMARK_ITERATIONS,
      5
    );

    console.log(formatBenchmarkResult(result));
    expect(result.mean).toBeGreaterThan(0);
    expect(result.totalTime).toBeGreaterThan(0);
  });

  it('FBM 噪声生成性能基准', () => {
    const noise = createNoise(42, 'simplex');

    const result = runBenchmark(
      'fbmNatural (256x256)',
      () => {
        for (let y = 0; y < BENCHMARK_SIZE; y++) {
          for (let x = 0; x < BENCHMARK_SIZE; x++) {
            noise.fbmNatural(x * 0.005, y * 0.005, 6, 2, 0.5, 'standard');
          }
        }
      },
      20,
      3
    );

    console.log(formatBenchmarkResult(result));
    expect(result.mean).toBeGreaterThan(0);
  });

  it('Float32Array 操作性能', () => {
    const size = BENCHMARK_SIZE * BENCHMARK_SIZE;
    const data = generateNoiseMap(BENCHMARK_SIZE, BENCHMARK_SIZE);

    const result = runBenchmark(
      `Float32Array 遍历 (${size} 元素)`,
      () => {
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          sum += data[i];
        }
        return sum;
      },
      BENCHMARK_ITERATIONS,
      5
    );

    console.log(formatBenchmarkResult(result));
    expect(result.mean).toBeGreaterThan(0);
  });

  it('LRUCache 读写性能', () => {
    const cache = new LRUCache<number, Float32Array>({ maxSize: 1000 });

    const testData = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) testData[i] = Math.random();

    const result = runBenchmark(
      'LRUCache put+get (1024 entry)',
      () => {
        for (let i = 0; i < 100; i++) {
          cache.put(i, testData);
          cache.get(i);
        }
      },
      BENCHMARK_ITERATIONS,
      10
    );

    console.log(formatBenchmarkResult(result));
    expect(result.mean).toBeGreaterThan(0);
  });
});

describe('性能回归检测', () => {
  it('核心操作不应出现显著性能回归', () => {
    const noise = createNoise(42, 'simplex');

    const { durationMs } = measureTime(() => {
      for (let y = 0; y < 128; y++) {
        for (let x = 0; x < 128; x++) {
          noise.sample(x * 0.01, y * 0.01);
        }
      }
    });

    console.log(`\n⏱️  噪声生成 (128x128): ${durationMs.toFixed(2)}ms`);
    expect(durationMs).toBeGreaterThan(0);
    expect(durationMs).toBeLessThan(1000);
  });
});
