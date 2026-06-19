export class Middleware {
  constructor() {
    this.middlewares = [];
  }

  // 添加中间件
  use(mw) {
    this.middlewares.push(mw);
  }

  // 执行中间件链
  async execute(ctx) {
    let index = 0;
    const next = async () => {
      if (index < this.middlewares.length) {
        const mw = this.middlewares[index++];
        await mw(ctx, next);
      }
    };
    await next();
  }
}

// 内置中间件
export const corsMiddleware = async (ctx, next) => {
  ctx.setHeader('Access-Control-Allow-Origin', '*');
  ctx.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  ctx.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (ctx.method === 'OPTIONS') {
    ctx.status(204).end();
    return;
  }
  
  await next();
};

export const loggingMiddleware = async (ctx, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  console.log(`${ctx.method} ${ctx.path} ${ctx.status} ${duration}ms`);
};

export const errorMiddleware = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.error(err);
  }
};
