import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EventBus } from '../../server/services/event-bus.js';

describe('EventBus', () => {
  describe('emit()', () => {
    it('should emit events', () => {
      const bus = new EventBus();
      let received = false;
      
      bus.on('test', () => {
        received = true;
      });
      
      bus.emit('test', {});
      
      assert.strictEqual(received, true);
    });

    it('should pass data to handlers', () => {
      const bus = new EventBus();
      let receivedData = null;
      
      bus.on('test', (data) => {
        receivedData = data;
      });
      
      bus.emit('test', { key: 'value' });
      
      assert.deepStrictEqual(receivedData, { key: 'value' });
    });

    it('should record event history', () => {
      const bus = new EventBus();
      
      bus.emit('test1', { data: 1 });
      bus.emit('test2', { data: 2 });
      
      const history = bus.getHistory();
      assert.strictEqual(history.length, 2);
      assert.strictEqual(history[0].event, 'test1');
      assert.strictEqual(history[1].event, 'test2');
    });
  });

  describe('getHistory()', () => {
    it('should return filtered history', () => {
      const bus = new EventBus();
      
      bus.emit('test1', {});
      bus.emit('test2', {});
      bus.emit('test1', {});
      
      const history = bus.getHistory('test1');
      assert.strictEqual(history.length, 2);
    });

    it('should respect limit parameter', () => {
      const bus = new EventBus();
      
      for (let i = 0; i < 10; i++) {
        bus.emit('test', { i });
      }
      
      const history = bus.getHistory(null, 5);
      assert.strictEqual(history.length, 5);
    });
  });

  describe('clearHistory()', () => {
    it('should clear event history', () => {
      const bus = new EventBus();
      
      bus.emit('test', {});
      bus.emit('test', {});
      
      bus.clearHistory();
      
      const history = bus.getHistory();
      assert.strictEqual(history.length, 0);
    });
  });
});
