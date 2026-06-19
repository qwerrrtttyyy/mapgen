import { describe, it } from 'node:test';
import assert from 'node:assert';
import checkpointsRoute from '../../server/routes/checkpoints.js';

describe('Checkpoints Route', () => {
  describe('route definition', () => {
    it('should have GET method', () => {
      assert.strictEqual(checkpointsRoute.get.method, 'GET');
    });

    it('should have POST method', () => {
      assert.strictEqual(checkpointsRoute.post.method, 'POST');
    });

    it('should have DELETE method', () => {
      assert.strictEqual(checkpointsRoute.delete.method, 'DELETE');
    });

    it('should have correct paths', () => {
      assert.strictEqual(checkpointsRoute.get.path, '/api/checkpoints');
      assert.strictEqual(checkpointsRoute.post.path, '/api/checkpoints');
      assert.strictEqual(checkpointsRoute.delete.path, '/api/checkpoints/:id');
    });
  });

  describe('GET handler()', () => {
    it('should return checkpoints list', async () => {
      const ctx = {
        json: (data) => {
          ctx.responseData = data;
        },
        services: {
          checkpoint: {
            list: () => [
              { id: '1', name: 'Checkpoint 1' },
              { id: '2', name: 'Checkpoint 2' },
            ],
          },
        },
      };
      
      await checkpointsRoute.get.handler(ctx);
      
      assert.ok(ctx.responseData);
      assert.strictEqual(ctx.responseData.length, 2);
    });
  });

  describe('POST handler()', () => {
    it('should create checkpoint', async () => {
      const ctx = {
        body: async () => ({
          name: 'New Checkpoint',
          data: { terrain: [1, 2, 3] },
        }),
        json: (data) => {
          ctx.responseData = data;
        },
        services: {
          checkpoint: {
            create: (checkpoint) => ({
              id: '123',
              ...checkpoint,
              createdAt: Date.now(),
            }),
          },
        },
      };
      
      await checkpointsRoute.post.handler(ctx);
      
      assert.ok(ctx.responseData);
      assert.strictEqual(ctx.responseData.name, 'New Checkpoint');
      assert.ok(ctx.responseData.id);
    });
  });

  describe('DELETE handler()', () => {
    it('should delete checkpoint', async () => {
      const ctx = {
        params: { id: '123' },
        json: (data) => {
          ctx.responseData = data;
        },
        services: {
          checkpoint: {
            delete: (id) => {
              ctx.deletedId = id;
              return true;
            },
          },
        },
      };
      
      await checkpointsRoute.delete.handler(ctx);
      
      assert.ok(ctx.responseData);
      assert.strictEqual(ctx.deletedId, '123');
    });

    it('should handle non-existent checkpoint', async () => {
      const ctx = {
        params: { id: 'nonexistent' },
        json: (data) => {
          ctx.responseData = data;
        },
        error: (err) => {
          ctx.errorData = err;
        },
        services: {
          checkpoint: {
            delete: () => false,
          },
        },
      };
      
      await checkpointsRoute.delete.handler(ctx);
      
      assert.ok(ctx.errorData);
      assert.strictEqual(ctx.errorData.status, 404);
    });
  });
});
