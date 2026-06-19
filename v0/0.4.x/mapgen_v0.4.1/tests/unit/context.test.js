import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Context } from '../../server/core/context.js';

describe('Context', () => {
  describe('path', () => {
    it('should extract path from URL', () => {
      const req = { url: '/health?foo=bar' };
      const res = {};
      const server = {};
      
      const ctx = new Context(req, res, server);
      
      assert.strictEqual(ctx.path, '/health');
    });

    it('should handle URLs without query strings', () => {
      const req = { url: '/health' };
      const res = {};
      const server = {};
      
      const ctx = new Context(req, res, server);
      
      assert.strictEqual(ctx.path, '/health');
    });
  });

  describe('query', () => {
    it('should parse query parameters', () => {
      const req = { url: '/api?foo=bar&baz=qux', headers: { host: 'localhost' } };
      const res = {};
      const server = {};
      
      const ctx = new Context(req, res, server);
      
      assert.strictEqual(ctx.query.foo, 'bar');
      assert.strictEqual(ctx.query.baz, 'qux');
    });

    it('should handle empty query strings', () => {
      const req = { url: '/health', headers: { host: 'localhost' } };
      const res = {};
      const server = {};
      
      const ctx = new Context(req, res, server);
      
      assert.deepStrictEqual(ctx.query, {});
    });
  });

  describe('method', () => {
    it('should return request method', () => {
      const req = { method: 'GET', url: '/health' };
      const res = {};
      const server = {};
      
      const ctx = new Context(req, res, server);
      
      assert.strictEqual(ctx.method, 'GET');
    });
  });

  describe('setHeader()', () => {
    it('should set response header', () => {
      const req = { url: '/health' };
      const res = {
        setHeader: (name, value) => {
          res.headers = res.headers || {};
          res.headers[name] = value;
        },
      };
      const server = {};
      
      const ctx = new Context(req, res, server);
      ctx.setHeader('Content-Type', 'application/json');
      
      assert.strictEqual(res.headers['Content-Type'], 'application/json');
    });
  });

  describe('status()', () => {
    it('should set status code', () => {
      const req = { url: '/health' };
      const res = {};
      const server = {};
      
      const ctx = new Context(req, res, server);
      ctx.status(200);
      
      assert.strictEqual(ctx.res.statusCode, 200);
    });

    it('should return self for chaining', () => {
      const req = { url: '/health' };
      const res = {};
      const server = {};
      
      const ctx = new Context(req, res, server);
      const result = ctx.status(200);
      
      assert.strictEqual(result, ctx);
    });
  });

  describe('json()', () => {
    it('should send JSON response', () => {
      const req = { url: '/health' };
      const res = {
        writeHead: (code, headers) => {
          res.statusCode = code;
          res.headers = headers;
        },
        end: (data) => {
          res.body = data;
        },
      };
      const server = {};
      
      const ctx = new Context(req, res, server);
      ctx.json({ status: 'ok' });
      
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers['Content-Type'], 'application/json');
      assert.strictEqual(res.body, '{"status":"ok"}');
    });

    it('should not send response if already sent', () => {
      const req = { url: '/health' };
      const res = {
        writeHead: () => {},
        end: () => {},
      };
      const server = {};
      
      const ctx = new Context(req, res, server);
      ctx.responseSent = true;
      ctx.json({ status: 'ok' });
      
      // Should not throw
    });
  });

  describe('error()', () => {
    it('should send error response', () => {
      const req = { url: '/health' };
      const res = {
        writeHead: (code, headers) => {
          res.statusCode = code;
          res.headers = headers;
        },
        end: (data) => {
          res.body = data;
        },
      };
      const server = {};
      
      const ctx = new Context(req, res, server);
      ctx.error({ status: 404, message: 'Not Found' });
      
      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.headers['Content-Type'], 'application/json');
      assert.ok(res.body.includes('Not Found'));
    });

    it('should use default status 500', () => {
      const req = { url: '/health' };
      const res = {
        writeHead: (code, headers) => {
          res.statusCode = code;
        },
        end: () => {},
      };
      const server = {};
      
      const ctx = new Context(req, res, server);
      ctx.error({ message: 'Internal Error' });
      
      assert.strictEqual(res.statusCode, 500);
    });
  });

  describe('notFound()', () => {
    it('should send 404 response', () => {
      const req = { url: '/health' };
      const res = {
        writeHead: (code) => {
          res.statusCode = code;
        },
        end: () => {},
      };
      const server = {};
      
      const ctx = new Context(req, res, server);
      ctx.notFound();
      
      assert.strictEqual(res.statusCode, 404);
    });
  });

  describe('body()', () => {
    it('should parse JSON request body', async () => {
      const req = {
        url: '/api',
        on: (event, callback) => {
          if (event === 'data') {
            callback('{"key":"value"}');
          } else if (event === 'end') {
            callback();
          }
        },
      };
      const res = {};
      const server = {};
      
      const ctx = new Context(req, res, server);
      const body = await ctx.body();
      
      assert.deepStrictEqual(body, { key: 'value' });
    });

    it('should reject invalid JSON', async () => {
      const req = {
        url: '/api',
        on: (event, callback) => {
          if (event === 'data') {
            callback('invalid json');
          } else if (event === 'end') {
            callback();
          }
        },
      };
      const res = {};
      const server = {};
      
      const ctx = new Context(req, res, server);
      
      try {
        await ctx.body();
        assert.fail('Should have thrown');
      } catch (err) {
        assert.ok(err instanceof SyntaxError);
      }
    });
  });
});
