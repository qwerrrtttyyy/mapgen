import { describe, it, expect } from 'vitest';
import { RingBuffer } from '../ringBuffer.js';

describe('RingBuffer', () => {
  it('pushes and pops values in LIFO order', () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    expect(buf.pop()).toBe(2);
    expect(buf.pop()).toBe(1);
    expect(buf.pop()).toBeUndefined();
  });

  it('overwrites oldest items when capacity exceeded', () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.push(4);
    expect(buf.size).toBe(3);
    expect(buf.toArray()).toEqual([4, 3, 2]);
  });

  it('peeks at most recent item without removing', () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    expect(buf.peek()).toBe(2);
    expect(buf.size).toBe(2);
  });

  it('handles push/pop wrap-around correctly', () => {
    const buf = new RingBuffer<number>(2);
    buf.push(1);
    buf.push(2);
    buf.pop();
    buf.push(3);
    expect(buf.toArray()).toEqual([3, 1]);
  });
});
