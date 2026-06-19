import { generatePlates, assignPlates, computeBoundaries } from '../../public/js/engine/tectonic.js';
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('tectonic', () => {
  it('generatePlates returns requested count', () => {
    const plates = generatePlates(42, 7, 64, 64, 0.4);
    assert.strictEqual(plates.length, 7);
  });

  it('generatePlates assigns sequential ids', () => {
    const plates = generatePlates(42, 5, 64, 64, 0.4);
    plates.forEach((p, i) => assert.strictEqual(p.id, i));
  });

  it('generatePlates assigns correct plate types from landmass', () => {
    const plates = generatePlates(42, 10, 64, 64, 0.4);
    const continents = plates.filter(p => p.type === 'continent');
    assert.ok(continents.length >= 4 && continents.length <= 5,
      `expected 4-5 continents for landmass=0.4, got ${continents.length}`);
  });

  it('generatePlates seeded x/y positions are deterministic', () => {
    const a = generatePlates(99, 6, 32, 32, 0.5);
    const b = generatePlates(99, 6, 32, 32, 0.5);
    for (let i = 0; i < a.length; i++) {
      assert.strictEqual(a[i].x, b[i].x, `plate ${i} x mismatch`);
      assert.strictEqual(a[i].y, b[i].y, `plate ${i} y mismatch`);
    }
  });

  it('generatePlates produces different seeded positions for different seeds', () => {
    const a = generatePlates(1, 5, 32, 32, 0.5);
    const b = generatePlates(2, 5, 32, 32, 0.5);
    let diffFound = false;
    for (let i = 0; i < 5; i++) {
      if (a[i].x !== b[i].x || a[i].y !== b[i].y) { diffFound = true; break; }
    }
    assert.ok(diffFound, 'different seeds should produce different seeded positions');
  });

  it('generatePlates provides expected fields', () => {
    const plates = generatePlates(42, 3, 64, 64, 0.5);
    const p = plates[0];
    assert.ok(typeof p.x === 'number');
    assert.ok(typeof p.y === 'number');
    assert.ok(typeof p.vx === 'number');
    assert.ok(typeof p.vy === 'number');
    assert.ok(Array.isArray(p.color));
    assert.strictEqual(p.color.length, 3);
    assert.ok(typeof p.name === 'string');
  });

  it('assignPlates covers every pixel with a plate id', () => {
    const plates = generatePlates(42, 6, 16, 16, 0.5);
    const { plateId, plateDist } = assignPlates(16, 16, plates);
    assert.strictEqual(plateId.length, 16 * 16);
    assert.strictEqual(plateDist.length, 16 * 16);
    for (let i = 0; i < plateId.length; i++) {
      assert.ok(plateId[i] >= 0 && plateId[i] < 6, 'plateId should be valid index');
      assert.ok(typeof plateDist[i] === 'number' && isFinite(plateDist[i]));
    }
  });

  it('computeBoundaries marks edges between different plates', () => {
    const plates = generatePlates(42, 6, 32, 32, 0.5);
    const { plateId } = assignPlates(32, 32, plates);
    const boundary = computeBoundaries(32, 32, plateId);
    assert.strictEqual(boundary.length, 32 * 32);
    let boundaryCount = 0;
    for (let i = 0; i < boundary.length; i++) {
      if (boundary[i] !== 0) boundaryCount++;
    }
    assert.ok(boundaryCount > 0, 'expected some boundary cells');
  });

  it('computeBoundaries does not mark interior cells for single plate', () => {
    const plates = generatePlates(42, 1, 8, 8, 1.0);
    const { plateId } = assignPlates(8, 8, plates);
    const boundary = computeBoundaries(8, 8, plateId);
    for (let i = 0; i < boundary.length; i++) {
      assert.strictEqual(boundary[i], 0, 'single plate should have no boundaries');
    }
  });

  it('tectonic pipeline produces no NaN in plateId, plateDist, or boundary', () => {
    const plates = generatePlates(42, 8, 32, 32, 0.4);
    const { plateId, plateDist } = assignPlates(32, 32, plates);
    const boundary = computeBoundaries(32, 32, plateId);
    for (let i = 0; i < plateId.length; i++) {
      assert.ok(!Number.isNaN(plateId[i]), 'plateId should not be NaN');
      assert.ok(!Number.isNaN(plateDist[i]), 'plateDist should not be NaN');
      assert.ok(!Number.isNaN(boundary[i]), 'boundary should not be NaN');
    }
  });
});
