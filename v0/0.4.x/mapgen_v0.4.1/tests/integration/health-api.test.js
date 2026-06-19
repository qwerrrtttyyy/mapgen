import { describe, it } from 'node:test';
import assert from 'node:assert';
import healthRoute from '../../server/routes/health.js';

describe('Health Route', () => {
  describe('route definition', () => {
    it('should have correct method', () => {
      assert.strictEqual(healthRoute.method, 'GET');
    });

    it('should have correct path', () => {
      assert.strictEqual(healthRoute.path, '/health');
    });

    it('should have handler function', () => {
      assert.strictEqual(typeof healthRoute.handler, 'function');
    });
  });

  describe('handler()', () => {
    it('should return health status', async () => {
      const ctx = {
        json: (data) => {
          ctx.responseData = data;
        },
        services: {
          engine: {
            getStats: () => ({ status: 'running' }),
          },
        },
      };
      
      await healthRoute.handler(ctx);
      
      assert.ok(ctx.responseData);
      assert.strictEqual(ctx.responseData.status, 'ok');
    });

    it('should include server uptime', async () => {
      const ctx = {
        json: (data) => {
          ctx.responseData = data;
        },
        services: {
          engine: {
            getStats: () => ({ status: 'running' }),
          },
        },
      };
      
      await healthRoute.handler(ctx);
      
      assert.ok(ctx.responseData.uptime);
    });

    it('should include version info', async () => {
      const ctx = {
        json: (data) => {
          ctx.responseData = data;
        },
        services: {
          engine: {
            getStats: () => ({ status: 'running' }),
          },
        },
      };
      
      await healthRoute.handler(ctx);
      
      assert.ok(ctx.responseData.version);
    });
  });
});
