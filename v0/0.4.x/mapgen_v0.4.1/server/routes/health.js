export default {
  method: 'GET',
  path: '/health',
  handler: async (ctx) => {
    const stats = ctx.services.engine?.getStats() || {};
    
    ctx.json({
      status: 'ok',
      uptime: process.uptime(),
      version: '0.4.3',
      timestamp: Date.now(),
      engine: stats,
    });
  },
};
