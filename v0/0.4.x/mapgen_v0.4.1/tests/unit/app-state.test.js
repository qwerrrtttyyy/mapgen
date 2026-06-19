import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AppState } from '../../public/js/app-state.js';

describe('AppState', () => {
  describe('constructor()', () => {
    it('should create state with default values', () => {
      const state = new AppState();
      
      assert.ok(state);
      assert.strictEqual(state.get('seedStr'), undefined);
      assert.strictEqual(state.get('mapSize'), undefined);
    });

    it('should create state with initial values', () => {
      const state = new AppState({ seed: '12345', width: 256 });
      
      assert.strictEqual(state.get('seed'), '12345');
      assert.strictEqual(state.get('width'), 256);
    });
  });

  describe('get() / set()', () => {
    it('should get and set values', () => {
      const state = new AppState();
      
      state.set('test', 'value');
      
      assert.strictEqual(state.get('test'), 'value');
    });

    it('should return default value for missing keys', () => {
      const state = new AppState();
      
      const result = state.get('missing', 'default');
      
      assert.strictEqual(result, 'default');
    });
  });

  describe('subscribe()', () => {
    it('should notify subscribers on change', async () => {
      const state = new AppState();
      const changes = [];
      
      state.subscribe((key, value, oldValue) => {
        changes.push({ key, value, oldValue });
      });
      
      state.set('test', 'value1');
      state.set('test', 'value2');
      
      // 等待微任务
      await new Promise(r => setTimeout(r, 10));
      
      assert.strictEqual(changes.length, 2);
      assert.strictEqual(changes[0].key, 'test');
      assert.strictEqual(changes[0].value, 'value1');
      assert.strictEqual(changes[1].oldValue, 'value1');
    });

    it('should unsubscribe', async () => {
      const state = new AppState();
      const changes = [];
      
      const unsubscribe = state.subscribe((key, value) => {
        changes.push({ key, value });
      });
      
      state.set('test', 'value1');
      unsubscribe();
      state.set('test', 'value2');
      
      await new Promise(r => setTimeout(r, 10));
      
      assert.strictEqual(changes.length, 1);
    });
  });

  describe('batch()', () => {
    it('should batch multiple changes', async () => {
      const state = new AppState();
      let batchChanges = null;
      
      state.subscribe((key, value) => {
        if (key === '__batch__') {
          batchChanges = value;
        }
      });
      
      state.batch(() => {
        state.set('a', 1);
        state.set('b', 2);
        state.set('c', 3);
      });
      
      await new Promise(r => setTimeout(r, 10));
      
      // 批量操作应该触发一次批量通知
      assert.ok(batchChanges);
      assert.strictEqual(batchChanges.size, 3);
      assert.strictEqual(batchChanges.get('a').value, 1);
      assert.strictEqual(batchChanges.get('b').value, 2);
      assert.strictEqual(batchChanges.get('c').value, 3);
    });
  });

  describe('reset()', () => {
    it('should reset to initial values', () => {
      const state = new AppState({ a: 1, b: 2 });
      
      state.set('a', 10);
      state.reset();
      
      assert.strictEqual(state.get('a'), 1);
    });
  });
});
