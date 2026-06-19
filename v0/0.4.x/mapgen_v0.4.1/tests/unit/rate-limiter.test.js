import { describe, it } from 'node:test';
import assert from 'node:assert';
import { RateLimiter } from '../../server/services/rate-limiter.js';

describe('RateLimiter', () => {
  describe('isAllowed()', () => {
    it('should allow requests within limit', () => {
      const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 5 });
      
      const result = limiter.isAllowed('client1');
      
      assert.strictEqual(result, true);
    });

    it('should reject requests over limit', () => {
      const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 3 });
      
      // 前 3 个请求应该允许
      limiter.isAllowed('client1');
      limiter.isAllowed('client1');
      limiter.isAllowed('client1');
      
      // 第 4 个请求应该拒绝
      const result = limiter.isAllowed('client1');
      
      assert.strictEqual(result, false);
    });

    it('should track separate clients', () => {
      const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 2 });
      
      limiter.isAllowed('client1');
      limiter.isAllowed('client1');
      
      // client1 已达限制，但 client2 应该允许
      const result1 = limiter.isAllowed('client1');
      const result2 = limiter.isAllowed('client2');
      
      assert.strictEqual(result1, false);
      assert.strictEqual(result2, true);
    });
  });

  describe('getStats()', () => {
    it('should return limiter stats', () => {
      const limiter = new RateLimiter({ windowMs: 60000, maxRequests: 100 });
      
      limiter.isAllowed('client1');
      limiter.isAllowed('client2');
      
      const stats = limiter.getStats();
      
      assert.strictEqual(stats.totalClients, 2);
      assert.strictEqual(stats.windowMs, 60000);
      assert.strictEqual(stats.maxRequests, 100);
    });
  });
});
