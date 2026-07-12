/**
 * uiOptimizer 测试
 */
import { describe, it, expect, vi } from 'vitest';
import { createStore, throttle, debounce } from '../core/uiOptimizer.js';

describe('createStore', () => {
  it('should create store with initial state', () => {
    const store = createStore({ count: 0, name: 'test' });
    expect(store.state.count).toBe(0);
    expect(store.state.name).toBe('test');
  });

  it('should update via direct property set', () => {
    const store = createStore({ count: 0 });
    store.count = 5;
    // 异步更新（queueMicrotask），等待下一 tick 后检查
    return new Promise<void>(resolve => {
      setTimeout(() => {
        expect(store.state.count).toBe(5);
        resolve();
      }, 0);
    });
  });

  it('should update via patch', () => {
    const store = createStore({ a: 1, b: 2 });
    store.patch({ a: 10, b: 20 });
    return new Promise<void>(resolve => {
      setTimeout(() => {
        expect(store.state.a).toBe(10);
        expect(store.state.b).toBe(20);
        resolve();
      }, 0);
    });
  });

  it('should notify subscribers', () => {
    const store = createStore({ count: 0 });
    const fn = vi.fn();
    store.subscribe(fn);
    store.count = 42;
    return new Promise<void>(resolve => {
      setTimeout(() => {
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith(expect.objectContaining({ count: 42 }));
        resolve();
      }, 0);
    });
  });

  it('should merge multiple patches into one notification', () => {
    const store = createStore({ x: 0, y: 0 });
    const fn = vi.fn();
    store.subscribe(fn);
    store.patch({ x: 1 });
    store.patch({ y: 2 });
    store.x = 3;
    return new Promise<void>(resolve => {
      setTimeout(() => {
        expect(fn).toHaveBeenCalledTimes(1);
        expect(store.state.x).toBe(3);
        expect(store.state.y).toBe(2);
        resolve();
      }, 0);
    });
  });

  it('should unsubscribe', () => {
    const store = createStore({ count: 0 });
    const fn = vi.fn();
    const unsub = store.subscribe(fn);
    unsub();
    store.count = 99;
    return new Promise<void>(resolve => {
      setTimeout(() => {
        expect(fn).not.toHaveBeenCalled();
        resolve();
      }, 0);
    });
  });

  it('should reset to initial state', () => {
    const store = createStore({ count: 0, name: 'a' });
    store.count = 10;
    store.name = 'b';
    store.reset();
    return new Promise<void>(resolve => {
      setTimeout(() => {
        expect(store.state.count).toBe(0);
        expect(store.state.name).toBe('a');
        resolve();
      }, 0);
    });
  });

  it('should have a working get method', () => {
    const store = createStore({ val: 42 });
    expect(store.get('val')).toBe(42);
  });
});

describe('throttle', () => {
  it('should throttle calls', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    throttled();
    throttled();

    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});

describe('debounce', () => {
  it('should debounce calls', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    debounced();

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
