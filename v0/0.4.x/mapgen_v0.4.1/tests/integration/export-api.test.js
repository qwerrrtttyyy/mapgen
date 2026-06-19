import { describe, it } from 'node:test';
import assert from 'node:assert';
import exportRoute from '../../server/routes/export.js';

describe('Export Route', () => {
  describe('route definition', () => {
    it('should have correct method', () => {
      assert.strictEqual(exportRoute.method, 'POST');
    });

    it('should have correct path', () => {
      assert.strictEqual(exportRoute.path, '/api/export');
    });

    it('should have handler function', () => {
      assert.strictEqual(typeof exportRoute.handler, 'function');
    });
  });

  describe('handler()', () => {
    it('should export map as PNG', async () => {
      const ctx = {
        body: async () => ({
          width: 256,
          height: 256,
        }),
        json: (data) => {
          ctx.responseData = data;
        },
        services: {
          engine: {
            exportPNG: async (params) => ({
              buffer: Buffer.from('fake-png-data'),
              contentType: 'image/png',
            }),
          },
        },
      };
      
      await exportRoute.handler(ctx);
      
      assert.ok(ctx.responseData);
      assert.ok(ctx.responseData.buffer);
    });

    it('should handle export errors', async () => {
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
            exportPNG: async () => {
              throw new Error('Export failed');
            },
          },
        },
      };
      
      await exportRoute.handler(ctx);
      
      assert.ok(ctx.errorData);
      assert.strictEqual(ctx.errorData.status, 500);
    });
  });
});
