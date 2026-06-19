import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { EventStore } from '../../server/services/event-store.js';
import { writeFile, readFile, unlink } from 'fs/promises';

describe('EventStore', () => {
  const testFile = './test-events.json';

  afterEach(async () => {
    try {
      await unlink(testFile);
    } catch (err) {
      // 文件不存在，忽略
    }
  });

  describe('store()', () => {
    it('should store events with metadata', async () => {
      const store = new EventStore({ storagePath: testFile });
      
      const event = await store.store({
        type: 'test',
        data: { key: 'value' },
      });
      
      assert.ok(event.id);
      assert.ok(event.timestamp);
      assert.strictEqual(event.type, 'test');
    });

    it('should persist to file', async () => {
      const store = new EventStore({ storagePath: testFile });
      
      await store.store({ type: 'test', data: {} });
      
      const content = await readFile(testFile, 'utf-8');
      const events = JSON.parse(content);
      assert.strictEqual(events.length, 1);
    });
  });

  describe('getHistory()', () => {
    it('should return filtered events', async () => {
      const store = new EventStore({ storagePath: testFile });
      
      await store.store({ type: 'test1', data: {} });
      await store.store({ type: 'test2', data: {} });
      await store.store({ type: 'test1', data: {} });
      
      const history = store.getHistory({ event: 'test1' });
      assert.strictEqual(history.length, 2);
    });

    it('should respect limit parameter', async () => {
      const store = new EventStore({ storagePath: testFile });
      
      for (let i = 0; i < 10; i++) {
        await store.store({ type: 'test', data: { i } });
      }
      
      const history = store.getHistory({ limit: 5 });
      assert.strictEqual(history.length, 5);
    });
  });

  describe('getStats()', () => {
    it('should return event stats', async () => {
      const store = new EventStore({ storagePath: testFile });
      
      await store.store({ type: 'test', data: {} });
      await store.store({ type: 'test', data: {} });
      
      const stats = store.getStats();
      assert.strictEqual(stats.totalEvents, 2);
      assert.ok(stats.oldestEvent);
      assert.ok(stats.newestEvent);
    });
  });
});
