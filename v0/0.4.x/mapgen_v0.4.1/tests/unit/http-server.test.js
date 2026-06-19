import { describe, it } from 'node:test';
import assert from 'node:assert';
import { HTTPServer } from '../../server/core/http-server.js';

describe('HTTPServer', () => {
  describe('constructor()', () => {
    it('should create server with config', () => {
      const config = { port: 8765, host: '127.0.0.1' };
      const server = new HTTPServer(config);
      
      assert.strictEqual(server.config.port, 8765);
      assert.strictEqual(server.config.host, '127.0.0.1');
    });

    it('should initialize router and middleware', () => {
      const config = { port: 8765, host: '127.0.0.1' };
      const server = new HTTPServer(config);
      
      assert.ok(server.router);
      assert.ok(server.middleware);
    });

    it('should initialize stats', () => {
      const config = { port: 8765, host: '127.0.0.1' };
      const server = new HTTPServer(config);
      
      assert.strictEqual(server.stats.requests, 0);
      assert.strictEqual(server.stats.errors, 0);
      assert.strictEqual(server.stats.startTime, null);
    });
  });

  describe('registerService()', () => {
    it('should register service', () => {
      const config = { port: 8765, host: '127.0.0.1' };
      const server = new HTTPServer(config);
      const service = { name: 'test' };
      
      server.registerService('test', service);
      
      assert.strictEqual(server.services.test, service);
    });
  });

  describe('getStats()', () => {
    it('should return server stats', () => {
      const config = { port: 8765, host: '127.0.0.1' };
      const server = new HTTPServer(config);
      server.stats.startTime = Date.now() - 1000;
      
      const stats = server.getStats();
      
      assert.ok(stats.requests >= 0);
      assert.ok(stats.errors >= 0);
      assert.ok(stats.uptime > 0);
    });
  });
});
