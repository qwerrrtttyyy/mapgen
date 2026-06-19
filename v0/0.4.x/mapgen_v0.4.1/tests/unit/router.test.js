import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Router } from '../../server/core/router.js';

describe('Router', () => {
  describe('register()', () => {
    it('should register exact routes', () => {
      const router = new Router();
      const handler = () => {};
      
      router.register('GET', '/health', handler);
      
      const route = router.match('GET', '/health');
      assert.strictEqual(route.path, '/health');
      assert.strictEqual(route.handler, handler);
    });

    it('should register parameterized routes', () => {
      const router = new Router();
      const handler = () => {};
      
      router.register('GET', '/api/checkpoints/:id', handler);
      
      const route = router.match('GET', '/api/checkpoints/123');
      assert.strictEqual(route.params.id, '123');
    });

    it('should register multiple parameters', () => {
      const router = new Router();
      const handler = () => {};
      
      router.register('GET', '/api/:resource/:id', handler);
      
      const route = router.match('GET', '/api/users/456');
      assert.strictEqual(route.params.resource, 'users');
      assert.strictEqual(route.params.id, '456');
    });
  });

  describe('match()', () => {
    it('should match exact routes', () => {
      const router = new Router();
      const handler = () => {};
      
      router.register('GET', '/health', handler);
      
      const route = router.match('GET', '/health');
      assert.ok(route);
      assert.strictEqual(route.path, '/health');
    });

    it('should return null for non-existent routes', () => {
      const router = new Router();
      router.register('GET', '/health', () => {});
      
      const route = router.match('GET', '/nonexistent');
      assert.strictEqual(route, null);
    });

    it('should match parameterized routes', () => {
      const router = new Router();
      const handler = () => {};
      
      router.register('GET', '/api/checkpoints/:id', handler);
      
      const route = router.match('GET', '/api/checkpoints/123');
      assert.ok(route);
      assert.strictEqual(route.params.id, '123');
    });

    it('should not match different methods', () => {
      const router = new Router();
      router.register('GET', '/health', () => {});
      
      const route = router.match('POST', '/health');
      assert.strictEqual(route, null);
    });

    it('should handle trailing slashes', () => {
      const router = new Router();
      const handler = () => {};
      
      router.register('GET', '/health', handler);
      
      const route = router.match('GET', '/health/');
      assert.strictEqual(route, null);
    });
  });

  describe('convenience methods', () => {
    it('should register GET routes', () => {
      const router = new Router();
      const handler = () => {};
      
      router.get('/health', handler);
      
      const route = router.match('GET', '/health');
      assert.ok(route);
    });

    it('should register POST routes', () => {
      const router = new Router();
      const handler = () => {};
      
      router.post('/api/generate', handler);
      
      const route = router.match('POST', '/api/generate');
      assert.ok(route);
    });

    it('should register PUT routes', () => {
      const router = new Router();
      const handler = () => {};
      
      router.put('/api/config', handler);
      
      const route = router.match('PUT', '/api/config');
      assert.ok(route);
    });

    it('should register DELETE routes', () => {
      const router = new Router();
      const handler = () => {};
      
      router.delete('/api/checkpoints/:id', handler);
      
      const route = router.match('DELETE', '/api/checkpoints/123');
      assert.ok(route);
    });
  });

  describe('pathToRegex()', () => {
    it('should convert simple paths', () => {
      const router = new Router();
      const result = router.pathToRegex('/health');
      
      assert.ok(result.regex.test('/health'));
      assert.strictEqual(result.params.length, 0);
    });

    it('should convert parameterized paths', () => {
      const router = new Router();
      const result = router.pathToRegex('/api/checkpoints/:id');
      
      assert.ok(result.regex.test('/api/checkpoints/123'));
      assert.strictEqual(result.params.length, 1);
      assert.strictEqual(result.params[0], 'id');
    });

    it('should convert multiple parameters', () => {
      const router = new Router();
      const result = router.pathToRegex('/api/:resource/:id');
      
      assert.ok(result.regex.test('/api/users/456'));
      assert.strictEqual(result.params.length, 2);
      assert.strictEqual(result.params[0], 'resource');
      assert.strictEqual(result.params[1], 'id');
    });
  });
});
