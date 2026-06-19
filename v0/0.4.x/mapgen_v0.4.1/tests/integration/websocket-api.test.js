import { describe, it } from 'node:test';
import assert from 'node:assert';
import eventsRoute from '../../server/routes/events.js';

describe('Events Route', () => {
  describe('route definition', () => {
    it('should have correct method', () => {
      assert.strictEqual(eventsRoute.method, 'GET');
    });

    it('should have correct path', () => {
      assert.strictEqual(eventsRoute.path, '/api/events');
    });

    it('should have handler function', () => {
      assert.strictEqual(typeof eventsRoute.handler, 'function');
    });
  });

  describe('handler()', () => {
    it('should handle WebSocket connection', async () => {
      const ctx = {
        req: {
          headers: {
            upgrade: 'websocket',
          },
        },
        res: {},
        services: {
          websocket: {
            handleUpgrade: (req, socket, head) => {
              ctx.upgradeHandled = true;
            },
          },
        },
      };
      
      await eventsRoute.handler(ctx);
      
      assert.strictEqual(ctx.upgradeHandled, true);
    });

    it('should handle SSE fallback', async () => {
      const ctx = {
        req: {
          headers: {},
          on: (event, callback) => {
            // 模拟 close 事件
            if (event === 'close') {
              ctx.closeCallback = callback;
            }
          },
        },
        res: {
          writeHead: (code, headers) => {
            ctx.statusCode = code;
            ctx.headers = headers;
          },
          end: () => {
            ctx.ended = true;
          },
        },
        services: {
          events: {
            send: (res, type, data) => {
              ctx.sentEvents = ctx.sentEvents || [];
              ctx.sentEvents.push({ type, data });
            },
            addClient: (client) => {
              ctx.addedClient = client;
            },
            removeClient: (client) => {
              ctx.removedClient = client;
            },
          },
        },
      };
      
      await eventsRoute.handler(ctx);
      
      assert.strictEqual(ctx.statusCode, 200);
      assert.strictEqual(ctx.headers['Content-Type'], 'text/event-stream');
      
      // 清理心跳间隔
      if (ctx.addedClient?.heartbeat) {
        clearInterval(ctx.addedClient.heartbeat);
      }
    });
  });
});
