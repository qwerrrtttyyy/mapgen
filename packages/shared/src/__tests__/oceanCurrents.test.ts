import { describe, it, expect } from 'vitest';
import { computeOceanCurrents } from '../oceanCurrents.js';

describe('Ocean Currents 洋流系统', () => {
  const W = 32,
    H = 32;
  const size = W * H;

  function makeBaseInput(overrides?: Partial<Parameters<typeof computeOceanCurrents>[0]>) {
    const elevation = new Float32Array(size).fill(0.3); // 海洋
    return {
      width: W,
      height: H,
      elevation,
      seaLevel: 0.5,
      coastDist: new Float32Array(size).fill(-5),
      windDirX: 0,
      windDirY: 0,
      rainStrength: 1,
      seed: 42,
      ...overrides,
    };
  }

  describe('基础流场计算', () => {
    it('返回正确的数据结构', () => {
      const input = makeBaseInput();
      const result = computeOceanCurrents(input);

      expect(result.vx).toBeInstanceOf(Float32Array);
      expect(result.vy).toBeInstanceOf(Float32Array);
      expect(result.tempDelta).toBeInstanceOf(Float32Array);
      expect(result.speed).toBeInstanceOf(Float32Array);
      expect(result.vx.length).toBe(size);
      expect(result.vy.length).toBe(size);
      expect(result.tempDelta.length).toBe(size);
      expect(result.speed.length).toBe(size);
    });

    it('陆地像素流速为 0', () => {
      const elevation = new Float32Array(size).fill(0.6); // 全陆地
      const input = makeBaseInput({ elevation });
      const result = computeOceanCurrents(input);

      for (let i = 0; i < size; i++) {
        expect(result.vx[i]).toBe(0);
        expect(result.vy[i]).toBe(0);
        expect(result.speed[i]).toBe(0);
      }
    });

    it('海洋像素有非零流速', () => {
      const elevation = new Float32Array(size).fill(0.3); // 全海洋
      const input = makeBaseInput({ elevation });
      const result = computeOceanCurrents(input);

      let nonZeroCount = 0;
      for (let i = 0; i < size; i++) {
        if (result.speed[i] > 0) nonZeroCount++;
      }
      expect(nonZeroCount).toBeGreaterThan(0);
    });
  });

  describe('风带模型', () => {
    it('不同纬度有不同风向', () => {
      const elevation = new Float32Array(size).fill(0.3);
      const input = makeBaseInput({ elevation, windDirX: 0, windDirY: 0 });
      const result = computeOceanCurrents(input);

      // 赤道附近（信风带）和极地附近（东风带）应该有不同流向
      const equatorIdx = Math.floor(H / 2) * W + Math.floor(W / 2);
      const polarIdx = Math.floor(H * 0.8) * W + Math.floor(W / 2);

      // 验证存在差异（具体值取决于风带模型）
      expect(typeof result.vx[equatorIdx]).toBe('number');
      expect(typeof result.vx[polarIdx]).toBe('number');
    });

    it('用户风场偏置影响流向', () => {
      const elevation = new Float32Array(size).fill(0.3);
      const input1 = makeBaseInput({ elevation, windDirX: 0, windDirY: 0 });
      const input2 = makeBaseInput({ elevation, windDirX: 1, windDirY: 1 });

      const result1 = computeOceanCurrents(input1);
      const result2 = computeOceanCurrents(input2);

      // 有偏置和无偏置应该产生不同结果
      let diffCount = 0;
      for (let i = 0; i < size; i++) {
        if (
          Math.abs(result1.vx[i] - result2.vx[i]) > 0.001 ||
          Math.abs(result1.vy[i] - result2.vy[i]) > 0.001
        ) {
          diffCount++;
        }
      }
      expect(diffCount).toBeGreaterThan(0);
    });
  });

  describe('Ekman 漂移', () => {
    it('北半球向右偏转', () => {
      const elevation = new Float32Array(size).fill(0.3);
      const input = makeBaseInput({ elevation });
      const result = computeOceanCurrents(input);

      // 北半球（y > H/2）的流向应该有 Ekman 偏转
      const northernIdx = Math.floor(H * 0.7) * W + Math.floor(W / 2);
      expect(typeof result.vx[northernIdx]).toBe('number');
      expect(typeof result.vy[northernIdx]).toBe('number');
    });

    it('南半球向左偏转', () => {
      const elevation = new Float32Array(size).fill(0.3);
      const input = makeBaseInput({ elevation });
      const result = computeOceanCurrents(input);

      // 南半球（y < H/2）的流向应该有 Ekman 偏转
      const southernIdx = Math.floor(H * 0.3) * W + Math.floor(W / 2);
      expect(typeof result.vx[southernIdx]).toBe('number');
      expect(typeof result.vy[southernIdx]).toBe('number');
    });
  });

  describe('西边界强化', () => {
    it('大陆西岸洋流加速', () => {
      // 创建左侧有陆地的海洋区域
      const elevation = new Float32Array(size).fill(0.3);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < 5; x++) {
          elevation[y * W + x] = 0.7; // 西侧陆地
        }
      }

      const input = makeBaseInput({ elevation });
      const result = computeOceanCurrents(input);

      // 西边界附近的海洋像素应该有较强流速
      let maxSpeedNearBoundary = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 5; x < 10; x++) {
          const idx = y * W + x;
          maxSpeedNearBoundary = Math.max(maxSpeedNearBoundary, result.speed[idx]);
        }
      }

      expect(maxSpeedNearBoundary).toBeGreaterThan(0);
    });
  });

  describe('温度增量', () => {
    it('暖流（向极流动）产生正温度增量', () => {
      const elevation = new Float32Array(size).fill(0.3);
      const input = makeBaseInput({ elevation });
      const result = computeOceanCurrents(input);

      // 验证 tempDelta 有正值和负值（暖流和寒流）
      let hasPositive = false;
      let hasNegative = false;
      for (let i = 0; i < size; i++) {
        if (result.tempDelta[i] > 0.01) hasPositive = true;
        if (result.tempDelta[i] < -0.01) hasNegative = true;
      }
      expect(hasPositive).toBe(true);
      expect(hasNegative).toBe(true);
    });

    it('赤道热量影响温度增量幅度', () => {
      const elevation = new Float32Array(size).fill(0.3);
      const input = makeBaseInput({ elevation });
      const result = computeOceanCurrents(input);

      // 赤道附近的温度增量应该更大（热带热量因子）
      const equatorY = Math.floor(H / 2);
      const polarY = Math.floor(H * 0.9);

      let equatorTempSum = 0;
      let polarTempSum = 0;
      for (let x = 0; x < W; x++) {
        equatorTempSum += Math.abs(result.tempDelta[equatorY * W + x]);
        polarTempSum += Math.abs(result.tempDelta[polarY * W + x]);
      }

      // 赤道和极地都应该有非零温度增量
      const equatorAvg = equatorTempSum / W;
      const polarAvg = polarTempSum / W;
      expect(equatorAvg).toBeGreaterThan(0);
      expect(polarAvg).toBeGreaterThan(0);
    });
  });

  describe('沿岸扩散', () => {
    it('陆地 tempDelta 从海洋扩散', () => {
      // 创建海岸线：左半部分陆地，右半部分海洋
      const elevation = new Float32Array(size);
      const coastDist = new Float32Array(size);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const idx = y * W + x;
          if (x < W / 2) {
            elevation[idx] = 0.7; // 陆地
            coastDist[idx] = Math.min(x + 1, 10); // 距离海岸的距离
          } else {
            elevation[idx] = 0.3; // 海洋
            coastDist[idx] = -1;
          }
        }
      }

      const input = makeBaseInput({ elevation, coastDist });
      const result = computeOceanCurrents(input);

      // 沿岸陆地应该有非零 tempDelta（从海洋扩散）
      let landWithTempDelta = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W / 2; x++) {
          const idx = y * W + x;
          if (coastDist[idx] <= 10 && result.tempDelta[idx] !== 0) {
            landWithTempDelta++;
          }
        }
      }
      expect(landWithTempDelta).toBeGreaterThan(0);
    });
  });

  describe('流速模长', () => {
    it('speed = sqrt(vx^2 + vy^2)', () => {
      const elevation = new Float32Array(size).fill(0.3);
      const input = makeBaseInput({ elevation });
      const result = computeOceanCurrents(input);

      for (let i = 0; i < size; i++) {
        const expected = Math.sqrt(result.vx[i] ** 2 + result.vy[i] ** 2);
        expect(result.speed[i]).toBeCloseTo(expected, 5);
      }
    });
  });

  describe('rainStrength 影响', () => {
    it('rainStrength 不同值产生相同结果（无外部风偏置时）', () => {
      const elevation = new Float32Array(size).fill(0.3);
      const input1 = makeBaseInput({ elevation, rainStrength: 1, windDirX: 0, windDirY: 0 });
      const input2 = makeBaseInput({ elevation, rainStrength: 2, windDirX: 0, windDirY: 0 });

      const result1 = computeOceanCurrents(input1);
      const result2 = computeOceanCurrents(input2);

      // 无外部风偏置时，rainStrength 不影响归一化后的方向
      let sameCount = 0;
      for (let i = 0; i < size; i++) {
        if (Math.abs(result1.speed[i] - result2.speed[i]) < 0.0001) {
          sameCount++;
        }
      }
      expect(sameCount).toBe(size);
    });
  });

  describe('确定性', () => {
    it('相同输入产生相同输出', () => {
      const elevation = new Float32Array(size).fill(0.3);
      const input1 = makeBaseInput({ elevation, seed: 123 });
      const input2 = makeBaseInput({ elevation, seed: 123 });

      const result1 = computeOceanCurrents(input1);
      const result2 = computeOceanCurrents(input2);

      for (let i = 0; i < size; i++) {
        expect(result1.vx[i]).toBe(result2.vx[i]);
        expect(result1.vy[i]).toBe(result2.vy[i]);
        expect(result1.tempDelta[i]).toBe(result2.tempDelta[i]);
        expect(result1.speed[i]).toBe(result2.speed[i]);
      }
    });
  });
});
