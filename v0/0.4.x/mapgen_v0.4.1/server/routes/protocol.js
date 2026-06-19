export default {
  method: 'POST',
  path: '/api/protocol',
  handler: async (ctx) => {
    const { mode } = await ctx.body();
    
    // 验证模式
    const validModes = ['server', 'client', 'hybrid'];
    if (!validModes.includes(mode)) {
      ctx.error({
        status: 400,
        message: `Invalid mode. Must be one of: ${validModes.join(', ')}`,
      });
      return;
    }
    
    // 更新配置
    ctx.services.config?.set('protocol', mode);
    
    // 触发事件
    ctx.services.events?.emit('protocol:changed', { mode });
    
    ctx.json({
      mode,
      timestamp: Date.now(),
    });
  },
};
