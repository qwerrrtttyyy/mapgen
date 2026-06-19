export class SeededRandom {
  constructor(seed) {
    this.seed = seed;
    this.state = seed;
  }

  // 下一个随机数 [0, 1)
  next() {
    this.state = (this.state * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (this.state >>> 0) / 0xFFFFFFFF;
  }

  // 下一个随机整数 [0, max)
  nextInt(max) {
    return Math.floor(this.next() * max);
  }

  // 下一个随机浮点数 [min, max)
  nextFloat(min, max) {
    return min + this.next() * (max - min);
  }

  // 重置状态
  reset() {
    this.state = this.seed;
  }
}

// 兼容性函数：替代 Math.random()
export function seededRandom(seed) {
  const rng = new SeededRandom(seed);
  return () => rng.next();
}
