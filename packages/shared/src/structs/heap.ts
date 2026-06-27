export class BinaryHeap<T> {
  private heap: T[] = [];
  constructor(private compare: (a: T, b: T) => number) {}

  push(item: T): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();
    const top = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.sinkDown(0);
    return top;
  }

  peek(): T | undefined { return this.heap[0]; }
  get size(): number { return this.heap.length; }

  private bubbleUp(i: number): void {
    const item = this.heap[i];
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(item, this.heap[parent]) >= 0) break;
      this.heap[i] = this.heap[parent];
      i = parent;
    }
    this.heap[i] = item;
  }

  private sinkDown(i: number): void {
    const item = this.heap[i];
    const n = this.heap.length;
    while (true) {
      const left = i * 2 + 1;
      if (left >= n) break;
      const right = left + 1;
      let min = left;
      if (right < n && this.compare(this.heap[right], this.heap[left]) < 0) min = right;
      if (this.compare(item, this.heap[min]) <= 0) break;
      this.heap[i] = this.heap[min];
      i = min;
    }
    this.heap[i] = item;
  }
}
