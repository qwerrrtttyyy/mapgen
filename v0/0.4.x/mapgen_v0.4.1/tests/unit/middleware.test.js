import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Middleware, corsMiddleware, loggingMiddleware, errorMiddleware } from '../../server/core/middleware.js';

describe('Middleware', () => {
  describe('use()', () => {
    it('should add middleware to the stack', () => {
      const middleware = new Middleware();
      const mw = async (ctx, next) => await next();
      
      middleware.use(mw);
      
      assert.strictEqual(middleware.middlewares.length, 1);
      assert.strictEqual(middleware.middlewares[0], mw);
    });

    it('should add multiple middleware', () => {
      const middleware = new Middleware();
      const mw1 = async (ctx, next) => await next();
      const mw2 = async (ctx, next) => await next();
      
      middleware.use(mw1);
      middleware.use(mw2);
      
      assert.strictEqual(middleware.middlewares.length, 2);
    });
  });

  describe('execute()', () => {
    it('should execute middleware in order', async () => {
      const middleware = new Middleware();
      const order = [];
      
      middleware.use(async (ctx, next) => {
        order.push(1);
        await next();
      });
      
      middleware.use(async (ctx, next) => {
        order.push(2);
        await next();
      });
      
      middleware.use(async (ctx, next) => {
        order.push(3);
        await next();
      });
      
      const ctx = {};
      await middleware.execute(ctx);
      
      assert.deepStrictEqual(order, [1, 2, 3]);
    });

    it('should allow middleware to modify context', async () => {
      const middleware = new Middleware();
      
      middleware.use(async (ctx, next) => {
        ctx.data = 'modified';
        await next();
      });
      
      const ctx = {};
      await middleware.execute(ctx);
      
      assert.strictEqual(ctx.data, 'modified');
    });

    it('should allow middleware to stop chain', async () => {
      const middleware = new Middleware();
      const order = [];
      
      middleware.use(async (ctx, next) => {
        order.push(1);
        // 不调用 next()
      });
      
      middleware.use(async (ctx, next) => {
        order.push(2);
        await next();
      });
      
      const ctx = {};
      await middleware.execute(ctx);
      
      assert.deepStrictEqual(order, [1]);
    });

    it('should handle empty middleware stack', async () => {
      const middleware = new Middleware();
      const ctx = {};
      
      await middleware.execute(ctx);
      
      assert.ok(true);
    });
  });
});

describe('Built-in Middleware', () => {
  describe('corsMiddleware', () => {
    it('should set CORS headers', async () => {
      const ctx = {
        method: 'GET',
        setHeader: (name, value) => {
          ctx.headers = ctx.headers || {};
          ctx.headers[name] = value;
        },
      };
      
      await corsMiddleware(ctx, async () => {});
      
      assert.strictEqual(ctx.headers['Access-Control-Allow-Origin'], '*');
      assert.ok(ctx.headers['Access-Control-Allow-Methods']);
      assert.ok(ctx.headers['Access-Control-Allow-Headers']);
    });

    it('should handle OPTIONS requests', async () => {
      const ctx = {
        method: 'OPTIONS',
        setHeader: (name, value) => {
          ctx.headers = ctx.headers || {};
          ctx.headers[name] = value;
        },
        status: (code) => {
          ctx.statusCode = code;
          return ctx;
        },
        end: () => {
          ctx.ended = true;
        },
      };
      
      await corsMiddleware(ctx, async () => {});
      
      assert.strictEqual(ctx.statusCode, 204);
      assert.strictEqual(ctx.ended, true);
    });
  });

  describe('loggingMiddleware', () => {
    it('should log request details', async () => {
      const logs = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args);
      
      const ctx = {
        method: 'GET',
        path: '/health',
        status: 200,
      };
      
      await loggingMiddleware(ctx, async () => {});
      
      console.log = originalLog;
      assert.ok(logs.length > 0);
    });
  });

  describe('errorMiddleware', () => {
    it('should catch errors', async () => {
      const ctx = {
        error: (err) => {
          ctx.errorData = err;
        },
      };
      
      const error = new Error('Test error');
      await errorMiddleware(ctx, async () => {
        throw error;
      });
      
      assert.strictEqual(ctx.errorData, error);
    });

    it('should pass through if no error', async () => {
      const ctx = {};
      let called = false;
      
      await errorMiddleware(ctx, async () => {
        called = true;
      });
      
      assert.strictEqual(called, true);
    });
  });
});
