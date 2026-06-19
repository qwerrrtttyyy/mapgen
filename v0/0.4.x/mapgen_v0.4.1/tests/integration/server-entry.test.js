import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createServer } from '../../server/index.js';

describe('Server Entry', () => {
  describe('createServer()', () => {
    it('should create HTTP server', async () => {
      const config = { port: 0, host: '127.0.0.1' };
      const server = await createServer(config);
      
      assert.ok(server);
      assert.ok(server.httpServer);
      
      await server.stop();
    });

    it('should register all routes', async () => {
      const config = { port: 0, host: '127.0.0.1' };
      const server = await createServer(config);
      
      // 检查路由是否注册
      const router = server.httpServer.router;
      
      // 精确路由
      assert.ok(router.routes.has('GET:/health'));
      assert.ok(router.routes.has('GET:/api/version'));
      assert.ok(router.routes.has('GET:/api/config'));
      assert.ok(router.routes.has('PUT:/api/config'));
      assert.ok(router.routes.has('POST:/api/protocol'));
      assert.ok(router.routes.has('GET:/api/checkpoints'));
      assert.ok(router.routes.has('POST:/api/checkpoints'));
      assert.ok(router.routes.has('PUT:/api/sync'));
      assert.ok(router.routes.has('POST:/api/generate'));
      assert.ok(router.routes.has('POST:/api/export'));
      
      // 参数化路由
      assert.ok(router.patterns.has('DELETE:/api/checkpoints/:id'));
      
      await server.stop();
    });

    it('should have middleware registered', async () => {
      const config = { port: 0, host: '127.0.0.1' };
      const server = await createServer(config);
      
      // 检查中间件是否注册
      const middlewares = server.httpServer.middleware.middlewares;
      assert.ok(middlewares.length > 0);
      
      await server.stop();
    });

    it('should provide services', async () => {
      const config = { port: 0, host: '127.0.0.1' };
      const server = await createServer(config);
      
      // 检查服务是否注册
      assert.ok(server.httpServer.services.engine);
      assert.ok(server.httpServer.services.config);
      assert.ok(server.httpServer.services.checkpoint);
      assert.ok(server.httpServer.services.events);
      
      await server.stop();
    });
  });
});
