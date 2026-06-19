import { describe, it } from 'node:test';
import assert from 'node:assert';
import { WebSocketClient } from '../../public/js/websocket-client.js';

describe('WebSocketClient', () => {
  describe('constructor()', () => {
    it('should create client with URL', () => {
      const client = new WebSocketClient('ws://localhost:8765');
      
      assert.ok(client);
      assert.strictEqual(client.url, 'ws://localhost:8765');
      assert.strictEqual(client.state, 'disconnected');
    });

    it('should have default options', () => {
      const client = new WebSocketClient('ws://localhost:8765');
      
      assert.strictEqual(client.reconnectAttempts, 0);
      assert.strictEqual(client.maxReconnectAttempts, 5);
      assert.strictEqual(client.reconnectDelay, 1000);
    });
  });

  describe('connect()', () => {
    it('should set state to connecting', () => {
      const client = new WebSocketClient('ws://localhost:8765');
      
      // 模拟 WebSocket
      client._createSocket = () => ({
        readyState: 0,
        close: () => {},
      });
      
      client.connect();
      
      assert.strictEqual(client.state, 'connecting');
    });
  });

  describe('disconnect()', () => {
    it('should set state to disconnected', () => {
      const client = new WebSocketClient('ws://localhost:8765');
      client.state = 'connected';
      
      client.disconnect();
      
      assert.strictEqual(client.state, 'disconnected');
    });
  });

  describe('subscribe()', () => {
    it('should subscribe to channel', () => {
      const client = new WebSocketClient('ws://localhost:8765');
      
      const unsubscribe = client.subscribe('test-channel', (data) => {});
      
      assert.strictEqual(typeof unsubscribe, 'function');
      assert.ok(client._subscriptions.has('test-channel'));
    });

    it('should unsubscribe from channel', () => {
      const client = new WebSocketClient('ws://localhost:8765');
      
      const unsubscribe = client.subscribe('test-channel', (data) => {});
      unsubscribe();
      
      assert.ok(!client._subscriptions.has('test-channel'));
    });
  });

  describe('send()', () => {
    it('should send message when connected', () => {
      const client = new WebSocketClient('ws://localhost:8765');
      client.state = 'connected';
      client._socket = {
        send: (data) => {
          client._lastSent = data;
        },
      };
      
      client.send({ type: 'test', data: 'hello' });
      
      assert.ok(client._lastSent);
    });

    it('should throw when not connected', () => {
      const client = new WebSocketClient('ws://localhost:8765');
      
      try {
        client.send({ type: 'test' });
        assert.fail('Should have thrown');
      } catch (err) {
        assert.ok(err.message.includes('not connected'));
      }
    });
  });

  describe('onMessage()', () => {
    it('should handle incoming messages', () => {
      const client = new WebSocketClient('ws://localhost:8765');
      const messages = [];
      
      client.onMessage((msg) => {
        messages.push(msg);
      });
      
      // 模拟消息
      client._handleMessage({ type: 'test', data: 'hello' });
      
      assert.strictEqual(messages.length, 1);
      assert.strictEqual(messages[0].type, 'test');
    });
  });
});
