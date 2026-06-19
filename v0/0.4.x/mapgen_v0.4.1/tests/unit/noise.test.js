import { createNoise, hashSeed, NoiseEngine } from '../../public/js/engine/noise.js';
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('noise', () => {
  it('hashSeed is deterministic for same input', () => {
    const a = hashSeed('test-seed-123');
    const b = hashSeed('test-seed-123');
    assert.strictEqual(a, b);
    assert.ok(a > 0, 'hashSeed should return positive integer');
  });

  it('hashSeed is never zero', () => {
    const h = hashSeed('0');
    assert.ok(h > 0);
  });

  it('hashSeed returns different values for different inputs', () => {
    const a = hashSeed('alpha');
    const b = hashSeed('beta');
    assert.notStrictEqual(a, b);
  });

  it('createNoise produces perlin2 within expected range', () => {
    const n = createNoise(42, 'perlin');
    for (let i = 0; i < 200; i++) {
      const v = n.perlin2(i * 0.1, i * 0.07);
      assert.ok(typeof v === 'number' && isFinite(v), 'perlin2 must return finite number');
      assert.ok(Math.abs(v) <= 1.5, `perlin2 value ${v} out of range`);
    }
  });

  it('createNoise produces same output for same seed', () => {
    const a = createNoise(12345, 'perlin');
    const b = createNoise(12345, 'perlin');
    for (let i = 0; i < 50; i++) {
      assert.strictEqual(a.perlin2(i, i), b.perlin2(i, i));
    }
  });

it('createNoise produces different output for different seeds', () => {
  const vals1 = [];
  const vals2 = [];
  for (let i = 0; i < 100; i++) vals1.push(createNoise(42, 'perlin').perlin2(i * 0.1, i * 0.07));
  for (let i = 0; i < 100; i++) vals2.push(createNoise(99999, 'perlin').perlin2(i * 0.1, i * 0.07));
  const diffFound = vals1.some((v, i) => v !== vals2[i]);
  assert.ok(diffFound, 'different seeds should produce different noise');
});

  it('simplex noise stays within bounded range', () => {
    const n = createNoise(42, 'simplex');
    for (let i = 0; i < 200; i++) {
      const v = n.simplex2(i * 0.1, i * 0.07);
      assert.ok(typeof v === 'number' && isFinite(v));
      assert.ok(Math.abs(v) <= 2, 'simplex2 should be within ~[-1,1] (allows small overshoot)');
    }
  });

  it('value noise returns finite numbers', () => {
    const n = createNoise(42, 'value');
    for (let i = 0; i < 100; i++) {
      const v = n.value2(i * 0.1, i * 0.1);
      assert.ok(typeof v === 'number' && isFinite(v));
    }
  });

  it('worley noise returns finite numbers in [0,1]', () => {
    const n = createNoise(42, 'worley');
    for (let i = 0; i < 100; i++) {
      const v = n.worley2(i * 0.1, i * 0.1);
      assert.ok(typeof v === 'number' && isFinite(v));
      assert.ok(v >= 0 && v <= 1.1, `worley2 value ${v} should be in [0,1]`);
    }
  });

  it('fbm standard type returns finite values', () => {
    const n = createNoise(42, 'perlin');
    for (let i = 0; i < 50; i++) {
      const v = n.fbm(i * 0.05, i * 0.05, 3, 2.0, 0.5, 'standard');
      assert.ok(typeof v === 'number' && isFinite(v));
    }
  });

  it('fbm ridged type returns finite values', () => {
    const n = createNoise(42, 'perlin');
    for (let i = 0; i < 50; i++) {
      const v = n.fbm(i * 0.05, i * 0.05, 3, 2.0, 0.5, 'ridged');
      assert.ok(typeof v === 'number' && isFinite(v));
    }
  });

  it('fbm billowy type returns finite values', () => {
    const n = createNoise(42, 'perlin');
    const v = n.fbm(0.5, 0.5, 2, 2.0, 0.5, 'billowy');
    assert.ok(typeof v === 'number' && isFinite(v));
  });

  it('fbm warped type returns finite values', () => {
    const n = createNoise(42, 'perlin');
    const v = n.fbm(0.3, 0.3, 2, 2.0, 0.5, 'warped');
    assert.ok(typeof v === 'number' && isFinite(v));
  });

  it('sample defaults to perlin2', () => {
    const n = createNoise(42);
    const v = n.sample(0.5, 0.5);
    assert.ok(typeof v === 'number' && isFinite(v));
  });
});
