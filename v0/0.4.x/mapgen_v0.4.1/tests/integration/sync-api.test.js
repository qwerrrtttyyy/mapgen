import { describe, it } from 'node:test';
import assert from 'node:assert';
import syncRoute from '../../server/routes/sync.js';

describe('Sync Route', () => {
  describe('route definition', () => {
    it('should have correct method', () => {
      assert.strictEqual(syncRoute.method, 'PUT');
    });

    it('should have correct path', () => {
      assert.strictEqual(syncRoute.path, '/api/sync');
    });

    it('should have handler function', () => {
      assert.strictEqual(typeof syncRoute.handler, 'function');
    });
  });

  describe('handler()', () => {
    it('should sync client data to server', async () => {
      const ctx = {
        body: async () => ({
          checkpoints: [
            { id: '1', name: 'Client Checkpoint' },
          ],
        }),
        json: (data) => {
          ctx.responseData = data;
        },
        services: {
          checkpoint: {
            sync: (checkpoints) => {
              ctx.syncedCheckpoints = checkpoints;
              return { synced: checkpoints.length };
            },
          },
        },
      };
      
      await syncRoute.handler(ctx);
      
      assert.ok(ctx.responseData);
      assert.strictEqual(ctx.responseData.synced, 1);
    });

    it('should handle empty sync data', async () => {
      const ctx = {
        body: async () => ({
          checkpoints: [],
        }),
        json: (data) => {
          ctx.responseData = data;
        },
        services: {
          checkpoint: {
            sync: (checkpoints) => ({
              synced: checkpoints.length,
            }),
          },
        },
      };
      
      await syncRoute.handler(ctx);
      
      assert.ok(ctx.responseData);
      assert.strictEqual(ctx.responseData.synced, 0);
    });
  });
});
