import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createServer } from '../../server/index.js';

describe('Modular Server Integration', () => {
  describe('createServer()', () => {
    it('should create server instance', async () => {
      const server = await createServer({
        port: 19501,
        host: '127.0.0.1',
        openBrowser: false,
      });
      
      assert.ok(server);
      assert.ok(server.httpServer);
      assert.ok(server.start);
      assert.ok(server.stop);
    });

    it('should register routes', async () => {
      const server = await createServer({
        port: 19502,
        host: '127.0.0.1',
        openBrowser: false,
      });
      
      const routes = server.httpServer.router.routes;
      
      // 检查是否注册了路由
      assert.ok(routes.size > 0);
      
      // 检查是否有健康检查路由
      const hasHealthRoute = Array.from(routes.keys()).some(key => 
        key.includes('/health')
      );
      assert.ok(hasHealthRoute);
    });

    it('should register services', async () => {
      const server = await createServer({
        port: 19503,
        host: '127.0.0.1',
        openBrowser: false,
      });
      
      const services = server.httpServer.services;
      
      assert.ok(services.events);
      assert.ok(services.config);
      assert.ok(services.checkpoint);
      assert.ok(services.engine);
    });
  });

  describe('HTTPServer', () => {
    it('should track stats', async () => {
      const server = await createServer({
        port: 19504,
        host: '127.0.0.1',
        openBrowser: false,
      });
      
      const stats = server.httpServer.getStats();
      
      assert.ok(stats);
      assert.strictEqual(typeof stats.requests, 'number');
      assert.strictEqual(typeof stats.errors, 'number');
    });
  });
});
