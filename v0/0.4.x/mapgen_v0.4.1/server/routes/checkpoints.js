export default {
  get: {
    method: 'GET',
    path: '/api/checkpoints',
    handler: async (ctx) => {
      const checkpoints = ctx.services.checkpoint?.list() || [];
      ctx.json(checkpoints);
    },
  },
  post: {
    method: 'POST',
    path: '/api/checkpoints',
    handler: async (ctx) => {
      const { name, data } = await ctx.body();
      
      const checkpoint = ctx.services.checkpoint?.create({
        name,
        data,
        createdAt: Date.now(),
      });
      
      ctx.json(checkpoint);
    },
  },
  delete: {
    method: 'DELETE',
    path: '/api/checkpoints/:id',
    handler: async (ctx) => {
      const { id } = ctx.params;
      
      const success = ctx.services.checkpoint?.delete(id);
      
      if (!success) {
        ctx.error({
          status: 404,
          message: `Checkpoint not found: ${id}`,
        });
        return;
      }
      
      ctx.json({ success: true, id });
    },
  },
};
