import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { extname } from 'path';

export class Context {
  constructor(req, res, server) {
    this.req = req;
    this.res = res;
    this.server = server;
    this.services = server?.services || {};
    this.params = {};
    this.responseSent = false;
    this.headers = {};
  }

  // 获取请求路径
  get path() {
    return this.req.url.split('?')[0];
  }

  // 获取查询参数
  get query() {
    const url = new URL(this.req.url, `http://${this.req.headers?.host || 'localhost'}`);
    return Object.fromEntries(url.searchParams);
  }

  // 获取请求方法
  get method() {
    return this.req.method;
  }

  // 设置响应头
  setHeader(name, value) {
    this.headers[name] = value;
    if (this.res.setHeader) {
      this.res.setHeader(name, value);
    }
  }

  // 设置状态码
  status(code) {
    this.res.statusCode = code;
    return this;
  }

  // 发送 JSON 响应
  json(data) {
    if (this.responseSent) return;
    this.responseSent = true;
    
    this.res.writeHead(this.res.statusCode || 200, {
      'Content-Type': 'application/json',
      ...this.headers,
    });
    this.res.end(JSON.stringify(data));
  }

  // 发送错误响应
  error(err) {
    if (this.responseSent) return;
    this.responseSent = true;
    
    const status = err.status || 500;
    this.res.writeHead(status, {
      'Content-Type': 'application/json',
      ...this.headers,
    });
    this.res.end(JSON.stringify({
      error: err.message,
      status,
    }));
  }

  // 发送 404
  notFound() {
    this.error({ status: 404, message: 'Not Found' });
  }

  // 发送静态文件
  async sendFile(filePath) {
    try {
      const fileStat = await stat(filePath);
      const ext = extname(filePath);
      const mimeTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
      };

      this.res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Content-Length': fileStat.size,
        ...this.headers,
      });

      createReadStream(filePath).pipe(this.res);
    } catch (err) {
      this.notFound();
    }
  }

  // 解析请求体
  async body() {
    return new Promise((resolve, reject) => {
      let data = '';
      this.req.on('data', chunk => {
        data += chunk;
      });
      this.req.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
      this.req.on('error', reject);
    });
  }
}
