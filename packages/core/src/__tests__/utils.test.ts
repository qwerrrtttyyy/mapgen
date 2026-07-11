import { describe, it, expect } from 'vitest';
import {
  smoothstep,
  lerp,
  clamp,
  mapRange,
  distance,
  distanceSquared,
  toRadians,
  toDegrees,
  normalizeArray,
  argMax,
  argMin,
  PRNG,
} from '../utils.js';

describe('Utils 模块', () => {
  describe('smoothstep 平滑插值', () => {
    it('边界值正确', () => {
      expect(smoothstep(0, 1, 0)).toBe(0);
      expect(smoothstep(0, 1, 1)).toBe(1);
    });

    it('中间值平滑', () => {
      const mid = smoothstep(0, 1, 0.5);
      expect(mid).toBeGreaterThan(0);
      expect(mid).toBeLessThan(1);
      expect(mid).toBeCloseTo(0.5, 1);
    });

    it('超出范围限制', () => {
      expect(smoothstep(0, 1, -1)).toBe(0);
      expect(smoothstep(0, 1, 2)).toBe(1);
    });
  });

  describe('lerp 线性插值', () => {
    it('端点正确', () => {
      expect(lerp(0, 10, 0)).toBe(0);
      expect(lerp(0, 10, 1)).toBe(10);
    });

    it('中间值正确', () => {
      expect(lerp(0, 10, 0.5)).toBe(5);
      expect(lerp(-5, 5, 0.5)).toBe(0);
    });

    it('反向插值', () => {
      expect(lerp(10, 0, 0.5)).toBe(5);
    });
  });

  describe('clamp 数值限制', () => {
    it('范围内值不变', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it('超出上限限制到最大值', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('超出下限限制到最小值', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });
  });

  describe('mapRange 范围映射', () => {
    it('归一化值正确映射', () => {
      expect(mapRange(0, 0, 100)).toBe(0);
      expect(mapRange(1, 0, 100)).toBe(100);
      expect(mapRange(0.5, 0, 100)).toBe(50);
    });

    it('负范围支持', () => {
      expect(mapRange(0, -50, 50)).toBe(-50);
      expect(mapRange(1, -50, 50)).toBe(50);
      expect(mapRange(0.5, -50, 50)).toBe(0);
    });
  });

  describe('distance 距离计算', () => {
    it('水平距离', () => {
      expect(distance(0, 0, 5, 0)).toBe(5);
    });

    it('垂直距离', () => {
      expect(distance(0, 0, 0, 5)).toBe(5);
    });

    it('对角距离', () => {
      const d = distance(0, 0, 3, 4);
      expect(d).toBeCloseTo(5, 5);
    });

    it('零距离', () => {
      expect(distance(5, 5, 5, 5)).toBe(0);
    });
  });

  describe('distanceSquared 平方距离', () => {
    it('避免开方', () => {
      expect(distanceSquared(0, 0, 3, 4)).toBe(25);
    });

    it('零距离', () => {
      expect(distanceSquared(5, 5, 5, 5)).toBe(0);
    });
  });

  describe('角度弧度转换', () => {
    it('角度转弧度', () => {
      expect(toRadians(0)).toBe(0);
      expect(toRadians(180)).toBeCloseTo(Math.PI, 10);
      expect(toRadians(90)).toBeCloseTo(Math.PI / 2, 10);
    });

    it('弧度转角度', () => {
      expect(toDegrees(0)).toBe(0);
      expect(toDegrees(Math.PI)).toBeCloseTo(180, 10);
      expect(toDegrees(Math.PI / 2)).toBeCloseTo(90, 10);
    });
  });

  describe('normalizeArray 数组归一化', () => {
    it('归一化到 [0,1]', () => {
      const arr = new Float32Array([0, 5, 10]);
      const out = new Float32Array(3);
      normalizeArray(arr, out);
      expect(out[0]).toBeCloseTo(0, 5);
      expect(out[1]).toBeCloseTo(0.5, 5);
      expect(out[2]).toBeCloseTo(1, 5);
    });

    it('自定义缩放', () => {
      const arr = new Float32Array([0, 5, 10]);
      const out = new Float32Array(3);
      normalizeArray(arr, out, 0, 2);
      expect(out[0]).toBeCloseTo(0, 5);
      expect(out[1]).toBeCloseTo(1, 5);
      expect(out[2]).toBeCloseTo(2, 5);
    });

    it('负值支持', () => {
      const arr = new Float32Array([-5, 0, 5]);
      const out = new Float32Array(3);
      normalizeArray(arr, out);
      expect(out[0]).toBeCloseTo(0, 5);
      expect(out[1]).toBeCloseTo(0.5, 5);
      expect(out[2]).toBeCloseTo(1, 5);
    });
  });

  describe('argMax 最大值索引', () => {
    it('找到最大值索引', () => {
      const arr = [1, 5, 3, 2];
      expect(argMax(arr)).toBe(1);
    });

    it('Float32Array 支持', () => {
      const arr = new Float32Array([1, 9, 5]);
      expect(argMax(arr)).toBe(1);
    });

    it('首个最大值', () => {
      const arr = [5, 5, 3];
      expect(argMax(arr)).toBe(0);
    });
  });

  describe('argMin 最小值索引', () => {
    it('找到最小值索引', () => {
      const arr = [5, 1, 3];
      expect(argMin(arr)).toBe(1);
    });

    it('Float32Array 支持', () => {
      const arr = new Float32Array([9, 1, 5]);
      expect(argMin(arr)).toBe(1);
    });

    it('首个最小值', () => {
      const arr = [1, 1, 3];
      expect(argMin(arr)).toBe(0);
    });
  });

  describe('PRNG 确定性伪随机数生成器', () => {
    it('相同种子产生相同序列', () => {
      const a = new PRNG(12345);
      const b = new PRNG(12345);
      for (let i = 0; i < 100; i++) {
        expect(a.next()).toBe(b.next());
      }
    });

    it('不同种子产生不同序列', () => {
      const a = new PRNG(12345);
      const b = new PRNG(54321);
      let differs = false;
      for (let i = 0; i < 10; i++) {
        if (a.next() !== b.next()) {
          differs = true;
          break;
        }
      }
      expect(differs).toBe(true);
    });

    it('next() 输出在 [0, 1) 区间', () => {
      const prng = new PRNG(42);
      for (let i = 0; i < 1000; i++) {
        const v = prng.next();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });

    it('range(min, max) 输出在 [min, max) 区间', () => {
      const prng = new PRNG(7);
      for (let i = 0; i < 1000; i++) {
        const v = prng.range(-0.5, 0.8);
        expect(v).toBeGreaterThanOrEqual(-0.5);
        expect(v).toBeLessThan(0.8);
      }
    });

    it('负数种子也能正常工作（被强制 uint32）', () => {
      const a = new PRNG(-1);
      const b = new PRNG(0xffffffff);
      expect(a.next()).toBe(b.next());
    });
  });
});
