export class WebSocketManager {
  constructor(server) {
    this.server = server;
    this.clients = new Map();
    this.channels = new Map();
    this.heartbeatInterval = null;
  }

  // 初始化 WebSocket 服务器（需要 ws 库）
  init(httpServer) {
    // 这里需要 ws 库的支持
    // 实际实现时需要：
    // import { WebSocketServer } from 'ws';
    // this.wss = new WebSocketServer({ server: httpServer });
    // this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    
    console.log('[WebSocket] Manager initialized (stub mode)');
  }

  // 处理客户端连接
  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    console.log(`[WebSocket] Client connected: ${clientId}`);
    
    // 注册客户端
    this.clients.set(clientId, {
      ws,
      id: clientId,
      channels: new Set(),
      lastHeartbeat: Date.now(),
    });

    // 发送连接确认
    this.send(ws, 'connected', { clientId });

    // 处理消息
    ws.on('message', (data) => {
      this.handleMessage(clientId, data);
    });

    // 处理断开连接
    ws.on('close', () => {
      console.log(`[WebSocket] Client disconnected: ${clientId}`);
      this.clients.delete(clientId);
    });

    // 处理错误
    ws.on('error', (err) => {
      console.error(`[WebSocket] Client error: ${clientId}`, err);
      this.clients.delete(clientId);
    });
  }

  // 处理客户端消息
  handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'subscribe':
          this.subscribe(clientId, message.channel);
          break;
        case 'unsubscribe':
          this.unsubscribe(clientId, message.channel);
          break;
        case 'heartbeat':
          this.handleHeartbeat(clientId);
          break;
        default:
          console.log(`[WebSocket] Unknown message type: ${message.type}`);
      }
    } catch (err) {
      console.error(`[WebSocket] Invalid message from ${clientId}:`, err);
    }
  }

  // 订阅频道
  subscribe(clientId, channel) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.channels.add(channel);
    
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel).add(clientId);
    
    console.log(`[WebSocket] Client ${clientId} subscribed to ${channel}`);
  }

  // 取消订阅
  unsubscribe(clientId, channel) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.channels.delete(channel);
    
    const channelClients = this.channels.get(channel);
    if (channelClients) {
      channelClients.delete(clientId);
      if (channelClients.size === 0) {
        this.channels.delete(channel);
      }
    }
    
    console.log(`[WebSocket] Client ${clientId} unsubscribed from ${channel}`);
  }

  // 发送消息给单个客户端
  send(ws, type, data) {
    if (ws.readyState === 1) { // OPEN
      ws.send(JSON.stringify({ type, data, timestamp: Date.now() }));
    }
  }

  // 广播消息给所有客户端
  broadcast(type, data) {
    for (const [, client] of this.clients) {
      this.send(client.ws, type, data);
    }
  }

  // 发送到特定频道
  broadcastToChannel(channel, type, data) {
    const clientIds = this.channels.get(channel) || new Set();
    for (const clientId of clientIds) {
      const client = this.clients.get(clientId);
      if (client) {
        this.send(client.ws, type, data);
      }
    }
  }

  // 启动心跳检测
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      for (const [clientId, client] of this.clients) {
        if (now - client.lastHeartbeat > 30000) {
          console.log(`[WebSocket] Client ${clientId} heartbeat timeout`);
          client.ws.terminate?.();
          this.clients.delete(clientId);
        }
      }
    }, 10000);
  }

  // 停止心跳检测
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // 处理心跳
  handleHeartbeat(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastHeartbeat = Date.now();
      this.send(client.ws, 'heartbeat', {});
    }
  }

  // 生成客户端 ID
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 获取连接统计
  getStats() {
    return {
      totalClients: this.clients.size,
      totalChannels: this.channels.size,
      channels: Object.fromEntries(
        Array.from(this.channels.entries()).map(([channel, clients]) => [
          channel,
          clients.size,
        ])
      ),
    };
  }
}
