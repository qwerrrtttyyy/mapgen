import { HTTPServer } from './core/http-server.js';
import { corsMiddleware, loggingMiddleware, errorMiddleware } from './core/middleware.js';

// 路由导入
import healthRoute from './routes/health.js';
import versionRoute from './routes/version.js';
import configRoute from './routes/config.js';
import protocolRoute from './routes/protocol.js';
import checkpointsRoute from './routes/checkpoints.js';
import syncRoute from './routes/sync.js';
import generateRoute from './routes/generate.js';
import exportRoute from './routes/export.js';

// 服务导入
import { EventBus } from './services/event-bus.js';

export async function createServer(config) {
  // 创建 HTTP 服务器
  const httpServer = new HTTPServer(config);
  
  // 注册中间件
  httpServer.middleware.use(corsMiddleware);
  httpServer.middleware.use(loggingMiddleware);
  httpServer.middleware.use(errorMiddleware);
  
  // 注册路由
  httpServer.router.get(healthRoute.path, healthRoute.handler);
  httpServer.router.get(versionRoute.path, versionRoute.handler);
  httpServer.router.get(configRoute.get.path, configRoute.get.handler);
  httpServer.router.put(configRoute.put.path, configRoute.put.handler);
  httpServer.router.post(protocolRoute.path, protocolRoute.handler);
  httpServer.router.get(checkpointsRoute.get.path, checkpointsRoute.get.handler);
  httpServer.router.post(checkpointsRoute.post.path, checkpointsRoute.post.handler);
  httpServer.router.delete(checkpointsRoute.delete.path, checkpointsRoute.delete.handler);
  httpServer.router.put(syncRoute.path, syncRoute.handler);
  httpServer.router.post(generateRoute.path, generateRoute.handler);
  httpServer.router.post(exportRoute.path, exportRoute.handler);
  
  // 注册服务
  const eventBus = new EventBus();
  httpServer.registerService('events', eventBus);
  
  // 注册配置服务（简化版）
  const configService = {
    config: { ...config },
    get() {
      return this.config;
    },
    set(key, value) {
      this.config[key] = value;
    },
  };
  httpServer.registerService('config', configService);
  
  // 注册检查点服务（简化版）
  const checkpointService = {
    checkpoints: new Map(),
    list() {
      return Array.from(this.checkpoints.values());
    },
    create(checkpoint) {
      const id = `checkpoint_${Date.now()}`;
      this.checkpoints.set(id, { id, ...checkpoint });
      return this.checkpoints.get(id);
    },
    delete(id) {
      return this.checkpoints.delete(id);
    },
    sync(checkpoints) {
      let synced = 0;
      for (const checkpoint of checkpoints) {
        this.checkpoints.set(checkpoint.id, checkpoint);
        synced++;
      }
      return { synced };
    },
  };
  httpServer.registerService('checkpoint', checkpointService);
  
  // 注册引擎服务（简化版）
  const engineService = {
    generate: async (params) => {
      // 这里应该调用实际的引擎
      return {
        width: params.width,
        height: params.height,
        seed: params.seed,
        terrain: [],
        timestamp: Date.now(),
      };
    },
    exportPNG: async (params) => {
      // 这里应该导出实际的 PNG
      return {
        buffer: Buffer.from('fake-png-data'),
        contentType: 'image/png',
      };
    },
    getStats: () => ({
      status: 'running',
      uptime: process.uptime(),
    }),
  };
  httpServer.registerService('engine', engineService);
  
  return {
    httpServer,
    start: () => httpServer.start(),
    stop: () => httpServer.stop(),
  };
}
