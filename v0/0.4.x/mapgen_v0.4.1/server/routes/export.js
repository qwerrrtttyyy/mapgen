export default {
  method: 'POST',
  path: '/api/export',
  handler: async (ctx) => {
    const params = await ctx.body();
    
    try {
      // 调用引擎导出 PNG
      const result = await ctx.services.engine?.exportPNG(params);
      
      ctx.json(result);
    } catch (err) {
      ctx.error({
        status: 500,
        message: err.message,
      });
    }
  },
};
