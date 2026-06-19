export default {
  method: 'POST',
  path: '/api/generate',
  handler: async (ctx) => {
    const params = await ctx.body();
    
    // 设置默认参数
    const generateParams = {
      width: params.width || 256,
      height: params.height || 256,
      seed: params.seed || Date.now(),
      ...params,
    };
    
    // 检查引擎是否可用
    if (!ctx.services.engine) {
      ctx.json({ error: 'Server-side engine not loaded' }, 503);
      return;
    }
    
    // 触发生成开始事件
    ctx.services.events?.emit('generation:start', { params: generateParams });
    
    try {
      // 调用引擎生成
      const result = await ctx.services.engine.generate(generateParams);
      
      // 触发生成完成事件
      ctx.services.events?.emit('generation:complete', { result });
      
      ctx.json(result);
    } catch (err) {
      // 触发生成错误事件
      ctx.services.events?.emit('generation:error', { error: err.message });
      
      ctx.error({
        status: 500,
        message: err.message,
      });
    }
  },
};
