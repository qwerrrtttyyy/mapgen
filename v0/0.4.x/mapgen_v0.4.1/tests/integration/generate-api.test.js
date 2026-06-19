import { describe, it } from 'node:test';
import assert from 'node:assert';
import generateRoute from '../../server/routes/generate.js';

describe('Generate Route', () => {
  describe('route definition', () => {
    it('should have correct method', () => {
      assert.strictEqual(generateRoute.method, 'POST');
    });

    it('should have correct path', () => {
      assert.strictEqual(generateRoute.path, '/api/generate');
    });

    it('should have handler function', () => {
      assert.strictEqual(typeof generateRoute.handler, 'function');
    });
  });

  describe('handler()', () => {
    it('should generate map with default params', async () => {
      const ctx = {
        body: async () => ({}),
        json: (data) => {
          ctx.responseData = data;
        },
        services: {
          engine: {
            generate: async (params) => ({
              width: params.width || 256,
              height: params.height || 256,
              terrain: [1, 2, 3],
            }),
          },
        },
      };
      
      await generateRoute.handler(ctx);
      
      assert.ok(ctx.responseData);
      assert.strictEqual(ctx.responseData.width, 256);
      assert.ok(ctx.responseData.terrain);
    });

    it('should generate map with custom params', async () => {
      const ctx = {
        body: async () => ({
          width: 512,
          height: 512,
          seed: 12345,
        }),
        json: (data) => {
          ctx.responseData = data;
        },
        services: {
          engine: {
            generate: async (params) => ({
              width: params.width,
              height: params.height,
              seed: params.seed,
            }),
          },
        },
      };
      
      await generateRoute.handler(ctx);
      
      assert.ok(ctx.responseData);
      assert.strictEqual(ctx.responseData.width, 512);
      assert.strictEqual(ctx.responseData.height, 512);
      assert.strictEqual(ctx.responseData.seed, 12345);
    });

    it('should handle generation errors', async () => {
      const ctx = {
        body: async () => ({}),
        json: (data) => {
          ctx.responseData = data;
        },
        error: (err) => {
          ctx.errorData = err;
        },
        services: {
          engine: {
            generate: async () => {
              throw new Error('Generation failed');
            },
          },
        },
      };
      
      await generateRoute.handler(ctx);
      
      assert.ok(ctx.errorData);
      assert.strictEqual(ctx.errorData.status, 500);
    });
  });
});
