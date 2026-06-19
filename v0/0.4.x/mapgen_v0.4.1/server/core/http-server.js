import { createServer } from 'http';
import { Router } from './router.js';
import { Middleware } from './middleware.js';
import { Context } from './context.js';

export class HTTPServer {
  constructor(config) {
    this.config = config;
    this.router = new Router();
    this.middleware = new Middleware();
    this.server = null;
    this.services = {};
    this.stats = {
      requests: 0,
      errors: 0,
      startTime: null,
    };
  }

  // 注册服务
  registerService(name, service) {
    this.services[name] = service;
  }

  // 启动服务器
  async start() {
    this.server = createServer(async (req, res) => {
      const ctx = new Context(req, res, this);
      
      try {
        this.stats.requests++;
        await this.middleware.execute(ctx);
        
        if (!ctx.responseSent) {
          const route = this.router.match(req.method, ctx.path);
          if (route) {
            ctx.params = route.params || {};
            await route.handler(ctx);
          } else {
            ctx.notFound();
          }
        }
      } catch (err) {
        this.stats.errors++;
        ctx.error(err);
      }
    });

    return new Promise((resolve) => {
      this.server.listen(this.config.port, this.config.host, () => {
        this.stats.startTime = Date.now();
        resolve();
      });
    });
  }

  // 关闭服务器
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(resolve);
      } else {
        resolve();
      }
    });
  }

  // 获取统计信息
  getStats() {
    return {
      ...this.stats,
      uptime: this.stats.startTime ? Date.now() - this.stats.startTime : 0,
    };
  }
}
