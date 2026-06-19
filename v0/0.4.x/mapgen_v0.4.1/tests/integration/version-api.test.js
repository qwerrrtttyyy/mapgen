import { describe, it } from 'node:test';
import assert from 'node:assert';
import versionRoute from '../../server/routes/version.js';

describe('Version Route', () => {
  describe('route definition', () => {
    it('should have correct method', () => {
      assert.strictEqual(versionRoute.method, 'GET');
    });

    it('should have correct path', () => {
      assert.strictEqual(versionRoute.path, '/api/version');
    });

    it('should have handler function', () => {
      assert.strictEqual(typeof versionRoute.handler, 'function');
    });
  });

  describe('handler()', () => {
    it('should return version info', async () => {
      const ctx = {
        json: (data) => {
          ctx.responseData = data;
        },
      };
      
      await versionRoute.handler(ctx);
      
      assert.ok(ctx.responseData);
      assert.strictEqual(ctx.responseData.version, '0.4.3');
    });

    it('should include Node.js version', async () => {
      const ctx = {
        json: (data) => {
          ctx.responseData = data;
        },
      };
      
      await versionRoute.handler(ctx);
      
      assert.ok(ctx.responseData.node);
    });

    it('should include platform info', async () => {
      const ctx = {
        json: (data) => {
          ctx.responseData = data;
        },
      };
      
      await versionRoute.handler(ctx);
      
      assert.ok(ctx.responseData.platform);
    });
  });
});
