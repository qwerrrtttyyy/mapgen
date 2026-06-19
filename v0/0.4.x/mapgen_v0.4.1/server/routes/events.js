export default {
  method: 'GET',
  path: '/api/events',
  handler: async (ctx) => {
    const { req, res } = ctx;
    
    // 检查是否为 WebSocket 升级请求
    if (req.headers.upgrade?.toLowerCase() === 'websocket') {
      // 处理 WebSocket 升级
      ctx.services.websocket?.handleUpgrade(req, res, null);
      return;
    }
    
    // SSE 降级模式
    // 设置 SSE 头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    
    // 发送连接确认
    ctx.services.events?.send(res, 'connected', {});
    
    // 心跳机制
    const heartbeat = setInterval(() => {
      ctx.services.events?.send(res, 'heartbeat', {});
    }, 30000);
    
    // 注册客户端
    const client = { res, heartbeat };
    ctx.services.events?.addClient(client);
    
    // 清理
    req.on('close', () => {
      clearInterval(heartbeat);
      ctx.services.events?.removeClient(client);
    });
  },
};
