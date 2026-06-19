import { describe, it } from 'node:test';
import assert from 'node:assert';
import { BackpressureController } from '../../server/services/backpressure.js';

describe('BackpressureController', () => {
  describe('shouldPause()', () => {
    it('should return false when under high water mark', () => {
      const controller = new BackpressureController({
        highWaterMark: 100,
        lowWaterMark: 10,
      });
      
      controller.pendingMessages = 50;
      
      assert.strictEqual(controller.shouldPause(), false);
    });

    it('should return true when at high water mark', () => {
      const controller = new BackpressureController({
        highWaterMark: 100,
        lowWaterMark: 10,
      });
      
      controller.pendingMessages = 100;
      
      assert.strictEqual(controller.shouldPause(), true);
    });
  });

  describe('shouldResume()', () => {
    it('should return true when paused and under low water mark', () => {
      const controller = new BackpressureController({
        highWaterMark: 100,
        lowWaterMark: 10,
      });
      
      controller.paused = true;
      controller.pendingMessages = 5;
      
      assert.strictEqual(controller.shouldResume(), true);
    });

    it('should return false when not paused', () => {
      const controller = new BackpressureController({
        highWaterMark: 100,
        lowWaterMark: 10,
      });
      
      controller.paused = false;
      controller.pendingMessages = 5;
      
      assert.strictEqual(controller.shouldResume(), false);
    });
  });

  describe('increment()/decrement()', () => {
    it('should pause when reaching high water mark', () => {
      const controller = new BackpressureController({
        highWaterMark: 10,
        lowWaterMark: 2,
      });
      
      for (let i = 0; i < 10; i++) {
        controller.increment();
      }
      
      assert.strictEqual(controller.paused, true);
    });

    it('should resume when dropping below low water mark', () => {
      const controller = new BackpressureController({
        highWaterMark: 10,
        lowWaterMark: 2,
      });
      
      // 达到高水位线
      for (let i = 0; i < 10; i++) {
        controller.increment();
      }
      
      // 降低到低水位线
      for (let i = 0; i < 8; i++) {
        controller.decrement();
      }
      
      assert.strictEqual(controller.paused, false);
    });
  });

  describe('getStatus()', () => {
    it('should return controller status', () => {
      const controller = new BackpressureController({
        highWaterMark: 100,
        lowWaterMark: 10,
      });
      
      controller.pendingMessages = 50;
      controller.paused = false;
      
      const status = controller.getStatus();
      
      assert.strictEqual(status.paused, false);
      assert.strictEqual(status.pendingMessages, 50);
      assert.strictEqual(status.highWaterMark, 100);
      assert.strictEqual(status.lowWaterMark, 10);
    });
  });
});
