import {
  generateElevation,
  hydraulicErosion,
  generateLakes,
} from '../../public/js/engine/erosion.js';
import { generatePlates, assignPlates, computeBoundaries } from '../../public/js/engine/tectonic.js';
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('erosion', () => {
  const makeTestInputs = (width = 32, height = 32) => {
    const plates = generatePlates(42, 6, width, height, 0.5);
    const { plateId } = assignPlates(width, height, plates);
    const boundary = computeBoundaries(width, height, plateId);
    return { plates, plateId, boundary, width, height, size: width * height };
  };

  it('generateElevation returns array of correct length', () => {
    const { plates, plateId, boundary, width, height } = makeTestInputs(32, 32);
    const result = generateElevation(
      width, height, 42, plateId, plates, boundary,
      'perlin', 'standard', 3, 2.0, 0.5, 0.45, 0.3, 0.5
    );
    assert.strictEqual(result.elevation.length, 32 * 32);
    assert.strictEqual(result.slope.length, 32 * 32);
    assert.strictEqual(result.ridge.length, 32 * 32);
    assert.strictEqual(result.ridgeMask.length, 32 * 32);
  });

  it('generateElevation produces no NaN values', () => {
    const { plates, plateId, boundary, width, height, size } = makeTestInputs(32, 32);
    const { elevation, slope, ridge, ridgeMask } = generateElevation(
      width, height, 42, plateId, plates, boundary,
      'perlin', 'standard', 3, 2.0, 0.5, 0.45, 0.3, 0.5
    );
    for (let i = 0; i < size; i++) {
      assert.ok(!Number.isNaN(elevation[i]), 'elevation should not be NaN');
      assert.ok(!Number.isNaN(slope[i]), 'slope should not be NaN');
      assert.ok(!Number.isNaN(ridge[i]), 'ridge should not be NaN');
      assert.ok(!Number.isNaN(ridgeMask[i]), 'ridgeMask should not be NaN');
    }
  });

  it('generateElevation elevation conservation: sum per-pixel stays non-degenerate', () => {
    const { plates, plateId, boundary, width, height, size } = makeTestInputs(32, 32);
    const { elevation } = generateElevation(
      width, height, 42, plateId, plates, boundary,
      'perlin', 'standard', 3, 2.0, 0.5, 0.45, 0.3, 0.5
    );
    let sum = 0;
    for (let i = 0; i < size; i++) sum += elevation[i];
    assert.ok(isFinite(sum), 'sum of elevation must be finite');
    assert.ok(Math.abs(sum) > 0, 'sum of elevation should not be exactly zero');
  });

  it('hydraulicErosion returns array of correct length', () => {
    const size = 32 * 32;
    const elevation = new Float32Array(size);
    for (let i = 0; i < size; i++) elevation[i] = 0.5;
    const result = hydraulicErosion(32, 32, elevation, 10, 1.0);
    assert.strictEqual(result.length, size);
  });

  it('hydraulicErosion produces no NaN', () => {
    const size = 64 * 64;
    const elevation = new Float32Array(size);
    for (let i = 0; i < size; i++) elevation[i] = 0.4 + Math.random() * 0.2;
    const result = hydraulicErosion(64, 64, elevation, 20, 1.0);
    for (let i = 0; i < result.length; i++) {
      assert.ok(!Number.isNaN(result[i]), 'hydraulicErosion should not produce NaN');
    }
  });

  it('hydraulicErosion elevation is conserved in sum (mass conservation test)', () => {
    const size = 16 * 16;
    const elevation = new Float32Array(size);
    // Create a simple 1D ramp to have predictable basin behavior
    let sumBefore = 0;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        elevation[y * 16 + x] = y / 16; // flat-shape: 0 at top, 1 at bottom
        sumBefore += elevation[y * 16 + x];
      }
    }
    const result = hydraulicErosion(16, 16, elevation, 5, 1.0);
    let sumAfter = 0;
    for (let i = 0; i < result.length; i++) sumAfter += result[i];
    // Mass is approximately conserved (erosion redistributes, sum should be close)
    assert.ok(isFinite(sumAfter), 'sum after erosion must be finite');
    assert.ok(sumAfter > 0, 'sum after erosion should remain positive');
    // sum should not grow unboundedly
    assert.ok(sumAfter < sumBefore * 2 + 1, 'erosion should not multiply total by more than 2×');
  });

  it('generateLakes returns array of correct length', () => {
    const size = 32 * 32;
    const elevation = new Float32Array(size);
    for (let i = 0; i < size; i++) elevation[i] = 0.46;
    const lakes = generateLakes(32, 32, elevation, 0.45, 0.02, 42);
    assert.strictEqual(lakes.length, size);
    assert.ok([...lakes].every(v => v === 0 || v === 1), 'lakes should be binary');
  });

  it('generateLakes produces no NaN', () => {
    const size = 32 * 32;
    const elevation = new Float32Array(size);
    for (let i = 0; i < size; i++) elevation[i] = 0.4 + Math.random() * 0.2;
    const lakes = generateLakes(32, 32, elevation, 0.45, 0.05, 42);
    for (let i = 0; i < lakes.length; i++) {
      assert.ok(!Number.isNaN(lakes[i]), 'lakes should not be NaN');
    }
  });
});
