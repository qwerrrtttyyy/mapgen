export class RateLimiter {
  constructor(config = {}) {
    this.windowMs = config.windowMs || 60000; // 1 分钟
    this.maxRequests = config.maxRequests || 100;
    this.clients = new Map();
  }

  // 检查客户端是否允许发送
  isAllowed(clientId) {
    const client = this.clients.get(clientId);
    
    if (!client) {
      // 新客户端
      this.clients.set(clientId, {
        count: 1,
        windowStart: Date.now(),
      });
      return true;
    }

    // 检查窗口是否过期
    if (Date.now() - client.windowStart > this.windowMs) {
      // 重置窗口
      client.count = 1;
      client.windowStart = Date.now();
      return true;
    }

    // 检查是否超过限制
    if (client.count >= this.maxRequests) {
      return false;
    }

    client.count++;
    return true;
  }

  // 清理过期客户端
  cleanup() {
    const now = Date.now();
    for (const [clientId, client] of this.clients) {
      if (now - client.windowStart > this.windowMs) {
        this.clients.delete(clientId);
      }
    }
  }

  // 获取统计信息
  getStats() {
    return {
      totalClients: this.clients.size,
      windowMs: this.windowMs,
      maxRequests: this.maxRequests,
    };
  }
}
