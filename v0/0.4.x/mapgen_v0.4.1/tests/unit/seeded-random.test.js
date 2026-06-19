import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SeededRandom } from '../../public/js/engine/seeded-random.js';

describe('SeededRandom', () => {
  describe('next()', () => {
    it('should generate random numbers', () => {
      const rng = new SeededRandom(12345);
      
      const result = rng.next();
      
      assert.ok(typeof result === 'number');
      assert.ok(result >= 0 && result < 1);
    });

    it('should generate different numbers', () => {
      const rng = new SeededRandom(12345);
      
      const result1 = rng.next();
      const result2 = rng.next();
      
      assert.notStrictEqual(result1, result2);
    });
  });

  describe('nextInt()', () => {
    it('should generate random integers', () => {
      const rng = new SeededRandom(12345);
      
      const result = rng.nextInt(10);
      
      assert.ok(typeof result === 'number');
      assert.ok(result >= 0 && result < 10);
    });
  });

  describe('nextFloat()', () => {
    it('should generate random floats in range', () => {
      const rng = new SeededRandom(12345);
      
      const result = rng.nextFloat(5, 10);
      
      assert.ok(typeof result === 'number');
      assert.ok(result >= 5 && result < 10);
    });
  });

  describe('determinism', () => {
    it('should produce same sequence with same seed', () => {
      const rng1 = new SeededRandom(12345);
      const rng2 = new SeededRandom(12345);
      
      const results1 = Array.from({ length: 10 }, () => rng1.next());
      const results2 = Array.from({ length: 10 }, () => rng2.next());
      
      assert.deepStrictEqual(results1, results2);
    });

    it('should produce different sequences with different seeds', () => {
      const rng1 = new SeededRandom(12345);
      const rng2 = new SeededRandom(67890);
      
      const results1 = Array.from({ length: 10 }, () => rng1.next());
      const results2 = Array.from({ length: 10 }, () => rng2.next());
      
      assert.notDeepStrictEqual(results1, results2);
    });
  });
});
