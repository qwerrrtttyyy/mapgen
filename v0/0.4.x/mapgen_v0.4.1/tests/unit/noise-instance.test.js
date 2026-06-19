import { describe, it } from 'node:test';
import assert from 'node:assert';
import { NoiseEngine, createNoise } from '../../public/js/engine/noise.js';

describe('NoiseEngine Instance Isolation', () => {
  it('should create independent instances', () => {
    const engine1 = new NoiseEngine(12345);
    const engine2 = new NoiseEngine(67890);
    
    // 两个实例应该有不同的种子
    assert.notStrictEqual(engine1.seed, engine2.seed);
  });

  it('should produce different results with different seeds', () => {
    const engine1 = new NoiseEngine(12345);
    const engine2 = new NoiseEngine(67890);
    
    const result1 = engine1.perlin2(0.5, 0.5);
    const result2 = engine2.perlin2(0.5, 0.5);
    
    // 不同种子应该产生不同结果
    assert.notStrictEqual(result1, result2);
  });

  it('should produce consistent results with same seed', () => {
    const engine1 = new NoiseEngine(12345);
    const engine2 = new NoiseEngine(12345);
    
    const result1 = engine1.perlin2(0.5, 0.5);
    const result2 = engine2.perlin2(0.5, 0.5);
    
    // 相同种子应该产生相同结果
    assert.strictEqual(result1, result2);
  });

  it('should support multiple concurrent instances', () => {
    const engines = [];
    for (let i = 0; i < 10; i++) {
      engines.push(new NoiseEngine(i * 1000));
    }
    
    // 每个实例应该产生不同的结果
    const results = engines.map(e => e.perlin2(0.5, 0.5));
    const uniqueResults = new Set(results);
    
    // 至少应该有一些不同的结果
    assert.ok(uniqueResults.size > 1);
  });
});

describe('createNoise()', () => {
  it('should create noise engine with type', () => {
    const engine = createNoise(12345, 'simplex');
    
    assert.ok(engine);
    assert.strictEqual(typeof engine.sample, 'function');
  });

  it('should support different noise types', () => {
    const perlin = createNoise(12345, 'perlin');
    const simplex = createNoise(12345, 'simplex');
    const value = createNoise(12345, 'value');
    const worley = createNoise(12345, 'worley');
    
    assert.ok(perlin);
    assert.ok(simplex);
    assert.ok(value);
    assert.ok(worley);
  });
});
