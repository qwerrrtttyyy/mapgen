import { describe, it } from 'node:test';
import assert from 'node:assert';
import configRoute from '../../server/routes/config.js';

describe('Config Route', () => {
  describe('route definition', () => {
    it('should have GET method', () => {
      assert.strictEqual(configRoute.get.method, 'GET');
    });

    it('should have PUT method', () => {
      assert.strictEqual(configRoute.put.method, 'PUT');
    });

    it('should have correct paths', () => {
      assert.strictEqual(configRoute.get.path, '/api/config');
      assert.strictEqual(configRoute.put.path, '/api/config');
    });

    it('should have handler functions', () => {
      assert.strictEqual(typeof configRoute.get.handler, 'function');
      assert.strictEqual(typeof configRoute.put.handler, 'function');
    });
  });

  describe('GET handler()', () => {
    it('should return config', async () => {
      const ctx = {
        json: (data) => {
          ctx.responseData = data;
        },
        services: {
          config: {
            get: () => ({ port: 8765, host: '127.0.0.1' }),
          },
        },
      };
      
      await configRoute.get.handler(ctx);
      
      assert.ok(ctx.responseData);
      assert.strictEqual(ctx.responseData.port, 8765);
    });
  });

  describe('PUT handler()', () => {
    it('should update config', async () => {
      const ctx = {
        body: async () => ({ port: 9000 }),
        json: (data) => {
          ctx.responseData = data;
        },
        services: {
          config: {
            set: (key, value) => {
              ctx.configUpdates = ctx.configUpdates || {};
              ctx.configUpdates[key] = value;
            },
            get: () => ({ port: 9000 }),
          },
        },
      };
      
      await configRoute.put.handler(ctx);
      
      assert.ok(ctx.responseData);
      assert.strictEqual(ctx.responseData.port, 9000);
    });
  });
});
