export class WebSocketClient {
  constructor(url, options = {}) {
    this.url = url;
    this.state = 'disconnected';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.reconnectDelay = options.reconnectDelay || 1000;
    
    this._socket = null;
    this._subscriptions = new Map();
    this._messageHandlers = new Set();
    this._reconnectTimer = null;
  }

  connect() {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }
    
    this.state = 'connecting';
    this._socket = this._createSocket();
    
    this._socket.onopen = () => {
      this.state = 'connected';
      this.reconnectAttempts = 0;
      this._notifyStateChange('connected');
    };
    
    this._socket.onclose = (event) => {
      this.state = 'disconnected';
      this._notifyStateChange('disconnected');
      
      if (!event.wasClean) {
        this._attemptReconnect();
      }
    };
    
    this._socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    this._socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this._handleMessage(data);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };
  }

  _createSocket() {
    // 在浏览器环境中使用原生 WebSocket
    if (typeof WebSocket !== 'undefined') {
      return new WebSocket(this.url);
    }
    
    // 在 Node.js 环境中返回模拟对象
    return {
      readyState: 0,
      close: () => {},
      send: () => {},
    };
  }

  disconnect() {
    if (this._socket) {
      this._socket.close();
      this._socket = null;
    }
    
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    
    this.state = 'disconnected';
    this._notifyStateChange('disconnected');
  }

  subscribe(channel, callback) {
    if (!this._subscriptions.has(channel)) {
      this._subscriptions.set(channel, new Set());
    }
    
    this._subscriptions.get(channel).add(callback);
    
    // 发送订阅消息
    if (this.state === 'connected') {
      this.send({
        type: 'subscribe',
        channel,
      });
    }
    
    return () => {
      const subscribers = this._subscriptions.get(channel);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this._subscriptions.delete(channel);
          
          // 发送取消订阅消息
          if (this.state === 'connected') {
            this.send({
              type: 'unsubscribe',
              channel,
            });
          }
        }
      }
    };
  }

  send(message) {
    if (this.state !== 'connected' || !this._socket) {
      throw new Error('WebSocket not connected');
    }
    
    this._socket.send(JSON.stringify(message));
  }

  onMessage(handler) {
    this._messageHandlers.add(handler);
    return () => {
      this._messageHandlers.delete(handler);
    };
  }

  _handleMessage(data) {
    // 通知所有消息处理器
    for (const handler of this._messageHandlers) {
      try {
        handler(data);
      } catch (err) {
        console.error('WebSocket message handler error:', err);
      }
    }
    
    // 处理频道消息
    if (data.type === 'message' && data.channel) {
      const subscribers = this._subscriptions.get(data.channel);
      if (subscribers) {
        for (const callback of subscribers) {
          try {
            callback(data.payload);
          } catch (err) {
            console.error('WebSocket subscription callback error:', err);
          }
        }
      }
    }
  }

  _attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('Max reconnect attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this._reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  _notifyStateChange(state) {
    // 可以扩展为事件系统
  }
}
