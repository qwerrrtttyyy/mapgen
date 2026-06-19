export class Router {
  constructor() {
    this.routes = new Map();
    this.patterns = new Map();
  }

  // 注册路由
  register(method, path, handler) {
    // 检查是否有动态参数
    if (path.includes(':')) {
      const pattern = this.pathToRegex(path);
      this.patterns.set(`${method}:${pattern.key}`, { pattern, handler, method });
    } else {
      this.routes.set(`${method}:${path}`, { path, handler, method });
    }
  }

  // 匹配路由
  match(method, path) {
    // 精确匹配
    const exact = this.routes.get(`${method}:${path}`);
    if (exact) return exact;

    // 模式匹配
    for (const [, route] of this.patterns) {
      if (route.method !== method) continue;
      const match = path.match(route.pattern.regex);
      if (match) {
        const params = {};
        route.pattern.params.forEach((param, i) => {
          params[param] = match[i + 1];
        });
        return { ...route, params };
      }
    }

    return null;
  }

  // 路径转正则
  pathToRegex(path) {
    const params = [];
    const regex = path.replace(/:(\w+)/g, (_, name) => {
      params.push(name);
      return '([^/]+)';
    });
    return { regex: new RegExp(`^${regex}$`), params, key: path };
  }

  // 便捷注册方法
  get(path, handler) {
    this.register('GET', path, handler);
  }

  post(path, handler) {
    this.register('POST', path, handler);
  }

  put(path, handler) {
    this.register('PUT', path, handler);
  }

  delete(path, handler) {
    this.register('DELETE', path, handler);
  }
}
