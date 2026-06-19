export default {
  method: 'GET',
  path: '/api/version',
  handler: async (ctx) => {
    ctx.json({
      version: '0.4.3',
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      timestamp: Date.now(),
    });
  },
};
