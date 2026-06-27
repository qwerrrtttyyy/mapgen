import { describe, it, expect } from 'vitest';
import { BinaryHeap } from '../heap.js';

describe('BinaryHeap', () => {
  it('pops items in ascending order for min-heap', () => {
    const heap = new BinaryHeap<number>((a, b) => a - b);
    heap.push(3);
    heap.push(1);
    heap.push(2);
    expect(heap.pop()).toBe(1);
    expect(heap.pop()).toBe(2);
    expect(heap.pop()).toBe(3);
    expect(heap.pop()).toBeUndefined();
  });

  it('returns undefined when popping empty heap', () => {
    const heap = new BinaryHeap<number>((a, b) => a - b);
    expect(heap.pop()).toBeUndefined();
  });

  it('peeks at smallest item without removing it', () => {
    const heap = new BinaryHeap<number>((a, b) => a - b);
    heap.push(2);
    heap.push(1);
    expect(heap.peek()).toBe(1);
    expect(heap.size).toBe(2);
  });

  it('maintains heap property through many operations', () => {
    const heap = new BinaryHeap<number>((a, b) => a - b);
    const values = [5, 3, 8, 1, 9, 2, 7, 4, 6];
    for (const v of values) heap.push(v);
    const sorted: number[] = [];
    while (heap.size > 0) sorted.push(heap.pop()!);
    expect(sorted).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('works as max-heap with reversed comparator', () => {
    const heap = new BinaryHeap<number>((a, b) => b - a);
    heap.push(1);
    heap.push(3);
    heap.push(2);
    expect(heap.pop()).toBe(3);
    expect(heap.pop()).toBe(2);
    expect(heap.pop()).toBe(1);
  });
});
