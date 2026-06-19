export default {
  get: {
    method: 'GET',
    path: '/api/config',
    handler: async (ctx) => {
      const config = ctx.services.config?.get() || {};
      ctx.json(config);
    },
  },
  put: {
    method: 'PUT',
    path: '/api/config',
    handler: async (ctx) => {
      const updates = await ctx.body();
      
      // 更新配置
      for (const [key, value] of Object.entries(updates)) {
        ctx.services.config?.set(key, value);
      }
      
      // 返回更新后的配置
      const config = ctx.services.config?.get() || {};
      ctx.json(config);
    },
  },
};
