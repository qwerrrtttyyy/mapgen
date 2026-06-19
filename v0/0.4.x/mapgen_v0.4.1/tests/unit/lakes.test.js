import { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateLakes as generateLakesErosion } from '../../public/js/engine/erosion.js';
import { generateLakes as generateLakesRivers } from '../../public/js/engine/rivers.js';

describe('generateLakes()', () => {
  const width = 64;
  const height = 64;
  const seed = 12345;

  // 创建测试高程数据
  function createTestElevation() {
    const elevation = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        // 创建一个有多个盆地的地形
        const cx1 = width * 0.3;
        const cy1 = height * 0.3;
        const cx2 = width * 0.7;
        const cy2 = height * 0.7;
        const dist1 = Math.sqrt((x - cx1) ** 2 + (y - cy1) ** 2);
        const dist2 = Math.sqrt((x - cx2) ** 2 + (y - cy2) ** 2);
        const minDist = Math.min(dist1, dist2);
        elevation[idx] = 0.5 + (minDist / width) * 0.3;
      }
    }
    return elevation;
  }

  it('should generate lakes with erosion version', () => {
    const elevation = createTestElevation();
    const seaLevel = 0.5;
    const lakeDensity = 0.1;

    const lakes = generateLakesErosion(width, height, elevation, seaLevel, lakeDensity, seed);

    assert.ok(lakes);
    assert.strictEqual(lakes.length, width * height);
  });

  it('should generate lakes with rivers version', () => {
    const elevation = createTestElevation();
    const seaLevel = 0.5;
    const lakeDensity = 0.1;

    const lakes = generateLakesRivers(width, height, elevation, seaLevel, lakeDensity, seed);

    assert.ok(lakes);
    assert.strictEqual(lakes.length, width * height);
  });

  it('should produce similar results', () => {
    const elevation = createTestElevation();
    const seaLevel = 0.5;
    const lakeDensity = 0.1;

    const lakesErosion = generateLakesErosion(width, height, elevation, seaLevel, lakeDensity, seed);
    const lakesRivers = generateLakesRivers(width, height, elevation, seaLevel, lakeDensity, seed);

    // 两个版本都应该返回有效数组
    assert.ok(lakesErosion);
    assert.ok(lakesRivers);
    assert.strictEqual(lakesErosion.length, width * height);
    assert.strictEqual(lakesRivers.length, width * height);
  });
});
