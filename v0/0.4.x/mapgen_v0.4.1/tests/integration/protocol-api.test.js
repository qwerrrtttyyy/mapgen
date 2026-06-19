import { describe, it } from 'node:test';
import assert from 'node:assert';
import protocolRoute from '../../server/routes/protocol.js';

describe('Protocol Route', () => {
  describe('route definition', () => {
    it('should have correct method', () => {
      assert.strictEqual(protocolRoute.method, 'POST');
    });

    it('should have correct path', () => {
      assert.strictEqual(protocolRoute.path, '/api/protocol');
    });

    it('should have handler function', () => {
      assert.strictEqual(typeof protocolRoute.handler, 'function');
    });
  });

  describe('handler()', () => {
    it('should switch to server mode', async () => {
      const ctx = {
        body: async () => ({ mode: 'server' }),
        json: (data) => {
          ctx.responseData = data;
        },
        services: {
          config: {
            set: (key, value) => {
              ctx.configUpdates = ctx.configUpdates || {};
              ctx.configUpdates[key] = value;
            },
          },
        },
      };
      
      await protocolRoute.handler(ctx);
      
      assert.ok(ctx.responseData);
      assert.strictEqual(ctx.responseData.mode, 'server');
    });

    it('should switch to client mode', async () => {
      const ctx = {
        body: async () => ({ mode: 'client' }),
        json: (data) => {
          ctx.responseData = data;
        },
        services: {
          config: {
            set: (key, value) => {
              ctx.configUpdates = ctx.configUpdates || {};
              ctx.configUpdates[key] = value;
            },
          },
        },
      };
      
      await protocolRoute.handler(ctx);
      
      assert.ok(ctx.responseData);
      assert.strictEqual(ctx.responseData.mode, 'client');
    });

    it('should switch to hybrid mode', async () => {
      const ctx = {
        body: async () => ({ mode: 'hybrid' }),
        json: (data) => {
          ctx.responseData = data;
        },
        services: {
          config: {
            set: (key, value) => {
              ctx.configUpdates = ctx.configUpdates || {};
              ctx.configUpdates[key] = value;
            },
          },
        },
      };
      
      await protocolRoute.handler(ctx);
      
      assert.ok(ctx.responseData);
      assert.strictEqual(ctx.responseData.mode, 'hybrid');
    });

    it('should reject invalid mode', async () => {
      const ctx = {
        body: async () => ({ mode: 'invalid' }),
        json: (data) => {
          ctx.responseData = data;
        },
        error: (err) => {
          ctx.errorData = err;
        },
        services: {
          config: {
            set: () => {},
          },
        },
      };
      
      await protocolRoute.handler(ctx);
      
      assert.ok(ctx.errorData);
      assert.strictEqual(ctx.errorData.status, 400);
    });
  });
});
