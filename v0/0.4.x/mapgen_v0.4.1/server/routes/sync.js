export default {
  method: 'PUT',
  path: '/api/sync',
  handler: async (ctx) => {
    const { checkpoints } = await ctx.body();
    
    // 同步检查点到服务器
    const result = ctx.services.checkpoint?.sync(checkpoints) || { synced: 0 };
    
    ctx.json({
      synced: result.synced,
      timestamp: Date.now(),
    });
  },
};
