import { beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';

const TEST_START_TIME = Date.now();

beforeAll(() => {
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  const duration = Date.now() - TEST_START_TIME;
  if (duration > 5000) {
    console.warn(`\n⚠️  测试套件运行时间较长: ${(duration / 1000).toFixed(2)}s`);
  }
});

beforeEach(() => {
});

afterEach(() => {
});
