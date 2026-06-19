import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EventSubscription } from '../../server/services/event-subscription.js';
import { EventBus } from '../../server/services/event-bus.js';

describe('EventSubscription', () => {
  describe('subscribe()', () => {
    it('should subscribe to events', () => {
      const eventBus = new EventBus();
      const subscription = new EventSubscription(eventBus);
      
      const id = subscription.subscribe('channel1', 'test', () => {});
      
      assert.ok(id);
      assert.ok(id.startsWith('sub_'));
    });

    it('should handle multiple subscriptions', () => {
      const eventBus = new EventBus();
      const subscription = new EventSubscription(eventBus);
      
      const id1 = subscription.subscribe('channel1', 'test', () => {});
      const id2 = subscription.subscribe('channel1', 'test', () => {});
      
      assert.notStrictEqual(id1, id2);
    });
  });

  describe('unsubscribe()', () => {
    it('should unsubscribe from events', () => {
      const eventBus = new EventBus();
      const subscription = new EventSubscription(eventBus);
      
      const id = subscription.subscribe('channel1', 'test', () => {});
      const result = subscription.unsubscribe(id);
      
      assert.strictEqual(result, true);
    });

    it('should return false for non-existent subscription', () => {
      const eventBus = new EventBus();
      const subscription = new EventSubscription(eventBus);
      
      const result = subscription.unsubscribe('nonexistent');
      
      assert.strictEqual(result, false);
    });
  });

  describe('dispatchEvent()', () => {
    it('should dispatch events to subscribers', () => {
      const eventBus = new EventBus();
      const subscription = new EventSubscription(eventBus);
      let received = false;
      
      subscription.subscribe('channel1', 'test', () => {
        received = true;
      });
      
      eventBus.emit('test', {});
      
      assert.strictEqual(received, true);
    });

    it('should apply filters', () => {
      const eventBus = new EventBus();
      const subscription = new EventSubscription(eventBus);
      let received = false;
      
      subscription.subscribe('channel1', 'test', () => {
        received = true;
      }, (data) => data.value === 1);
      
      eventBus.emit('test', { value: 0 });
      assert.strictEqual(received, false);
      
      eventBus.emit('test', { value: 1 });
      assert.strictEqual(received, true);
    });
  });

  describe('getStats()', () => {
    it('should return subscription stats', () => {
      const eventBus = new EventBus();
      const subscription = new EventSubscription(eventBus);
      
      subscription.subscribe('channel1', 'test', () => {});
      subscription.subscribe('channel1', 'test2', () => {});
      subscription.subscribe('channel2', 'test', () => {});
      
      const stats = subscription.getStats();
      
      assert.strictEqual(stats.channels, 2);
      assert.strictEqual(stats.totalSubscriptions, 3);
    });
  });
});
