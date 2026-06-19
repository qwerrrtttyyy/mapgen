import { describe, it } from 'node:test';
import assert from 'node:assert';
import { WebSocketManager } from '../../server/core/websocket.js';

describe('WebSocketManager', () => {
  describe('constructor()', () => {
    it('should create manager with server', () => {
      const server = {};
      const manager = new WebSocketManager(server);
      
      assert.ok(manager);
      assert.strictEqual(manager.server, server);
      assert.ok(manager.clients);
      assert.ok(manager.channels);
    });
  });

  describe('getStats()', () => {
    it('should return connection stats', () => {
      const server = {};
      const manager = new WebSocketManager(server);
      
      const stats = manager.getStats();
      
      assert.strictEqual(stats.totalClients, 0);
      assert.strictEqual(stats.totalChannels, 0);
    });

    it('should track connected clients', () => {
      const server = {};
      const manager = new WebSocketManager(server);
      
      // 模拟客户端连接
      manager.clients.set('client1', {
        ws: {},
        id: 'client1',
        channels: new Set(),
        lastHeartbeat: Date.now(),
      });
      
      const stats = manager.getStats();
      
      assert.strictEqual(stats.totalClients, 1);
    });

    it('should track channels', () => {
      const server = {};
      const manager = new WebSocketManager(server);
      
      // 模拟频道订阅
      manager.channels.set('channel1', new Set(['client1', 'client2']));
      manager.channels.set('channel2', new Set(['client1']));
      
      const stats = manager.getStats();
      
      assert.strictEqual(stats.totalChannels, 2);
    });
  });

  describe('broadcastToChannel()', () => {
    it('should send message to channel subscribers', () => {
      const server = {};
      const manager = new WebSocketManager(server);
      
      // 模拟客户端
      const messages = [];
      manager.clients.set('client1', {
        ws: {
          readyState: 1, // OPEN
          send: (data) => messages.push(data),
        },
        id: 'client1',
        channels: new Set(['channel1']),
        lastHeartbeat: Date.now(),
      });
      
      manager.channels.set('channel1', new Set(['client1']));
      
      manager.broadcastToChannel('channel1', 'test', { data: 'hello' });
      
      assert.strictEqual(messages.length, 1);
      const message = JSON.parse(messages[0]);
      assert.strictEqual(message.type, 'test');
      assert.deepStrictEqual(message.data, { data: 'hello' });
    });
  });
});
