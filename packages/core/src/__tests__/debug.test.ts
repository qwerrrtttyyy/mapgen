import { describe, it, expect, beforeEach } from 'vitest';
import { debug, setupDebugGlobal, getDebug } from '../debug.js';

describe('Debug 调试模块', () => {
  beforeEach(() => {
    debug.enable(false);
    debug.resetMetrics();
  });

  describe('基本开关控制', () => {
    it('默认禁用', () => {
      expect(debug.enabled).toBe(false);
    });

    it('启用/禁用', () => {
      debug.enable(true);
      expect(debug.enabled).toBe(true);
      debug.enable(false);
      expect(debug.enabled).toBe(false);
    });

    it('toggle 切换', () => {
      expect(debug.toggle()).toBe(true);
      expect(debug.enabled).toBe(true);
      expect(debug.toggle()).toBe(false);
      expect(debug.enabled).toBe(false);
    });
  });

  describe('显示选项', () => {
    it('showOverlay 默认开启', () => {
      expect(debug.showOverlay).toBe(true);
    });

    it('showWireframe 默认关闭', () => {
      expect(debug.showWireframe).toBe(false);
    });

    it('showNormals 默认关闭', () => {
      expect(debug.showNormals).toBe(false);
    });

    it('setShowOverlay 设置正确', () => {
      debug.setShowOverlay(false);
      expect(debug.showOverlay).toBe(false);
    });

    it('setShowWireframe 设置正确', () => {
      debug.setShowWireframe(true);
      expect(debug.showWireframe).toBe(true);
    });

    it('setShowNormals 设置正确', () => {
      debug.setShowNormals(true);
      expect(debug.showNormals).toBe(true);
    });
  });

  describe('日志级别', () => {
    it('默认 warn 级别', () => {
      expect(debug.logLevel).toBe('warn');
    });

    it('setLogLevel 设置正确', () => {
      debug.setLogLevel('debug');
      expect(debug.logLevel).toBe('debug');
      debug.setLogLevel('error');
      expect(debug.logLevel).toBe('error');
    });
  });

  describe('性能指标', () => {
    it('初始值为零', () => {
      const m = debug.metrics;
      expect(m.fps).toBe(0);
      expect(m.frameTime).toBe(0);
      expect(m.drawCalls).toBe(0);
      expect(m.textureCount).toBe(0);
      expect(m.memoryUsage).toBe(0);
    });

    it('updateMetrics 更新部分值', () => {
      debug.updateMetrics({ fps: 60, drawCalls: 12 });
      const m = debug.metrics;
      expect(m.fps).toBe(60);
      expect(m.drawCalls).toBe(12);
      expect(m.frameTime).toBe(0);
    });

    it('resetMetrics 重置所有值', () => {
      debug.updateMetrics({ fps: 60, drawCalls: 12, memoryUsage: 100 });
      debug.resetMetrics();
      const m = debug.metrics;
      expect(m.fps).toBe(0);
      expect(m.drawCalls).toBe(0);
      expect(m.memoryUsage).toBe(0);
    });

    it('metrics 返回副本而非引用', () => {
      const m1 = debug.metrics;
      debug.updateMetrics({ fps: 60 });
      const m2 = debug.metrics;
      expect(m1.fps).toBe(0);
      expect(m2.fps).toBe(60);
    });
  });

  describe('计时统计', () => {
    beforeEach(() => {
      debug.enable(true);
    });

    it('addTiming 添加计时', () => {
      debug.addTiming('test', 12.5);
      const timings = debug.timings;
      expect(timings.length).toBe(1);
      expect(timings[0].name).toBe('test');
      expect(timings[0].duration).toBe(12.5);
    });

    it('禁用时 measure 不记录', () => {
      debug.enable(false);
      const result = debug.measure('test', () => 42);
      expect(result).toBe(42);
      expect(debug.timings.length).toBe(0);
    });

    it('启用时 measure 记录并返回值', () => {
      const result = debug.measure('test-op', () => 123);
      expect(result).toBe(123);
      expect(debug.timings.length).toBe(1);
      expect(debug.timings[0].name).toBe('test-op');
    });

    it('measureAsync 异步计时', async () => {
      const result = await debug.measureAsync('async-op', async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        return 'done';
      });
      expect(result).toBe('done');
      expect(debug.timings.length).toBe(1);
      expect(debug.timings[0].duration).toBeGreaterThanOrEqual(10);
    });

    it('getTimingStats 返回统计', () => {
      debug.addTiming('test', 10);
      debug.addTiming('test', 20);
      debug.addTiming('test', 30);

      const stats = debug.getTimingStats('test');
      expect(stats).not.toBeNull();
      expect(stats?.avg).toBe(20);
      expect(stats?.min).toBe(10);
      expect(stats?.max).toBe(30);
      expect(stats?.count).toBe(3);
    });

    it('getAllTimingStats 返回所有统计', () => {
      debug.addTiming('op1', 10);
      debug.addTiming('op1', 20);
      debug.addTiming('op2', 100);

      const all = debug.getAllTimingStats();
      expect(Object.keys(all).length).toBe(2);
      expect(all['op1'].count).toBe(2);
      expect(all['op2'].count).toBe(1);
    });

    it('最大计时数限制', () => {
      for (let i = 0; i < 100; i++) {
        debug.addTiming('test', i);
      }
      expect(debug.timings.length).toBe(60);
    });
  });

  describe('断言功能', () => {
    beforeEach(() => {
      debug.enable(true);
    });

    it('条件为真时不触发', () => {
      expect(() => debug.assert(true, 'test')).not.toThrow();
    });
  });

  describe('全局注册', () => {
    it('setupDebugGlobal 注册到全局', () => {
      setupDebugGlobal();
      const d = getDebug();
      expect(d).toBeDefined();
      expect(d.enabled).toBeDefined();
    });
  });

  describe('toJSON 序列化', () => {
    it('返回完整状态', () => {
      debug.enable(true);
      debug.updateMetrics({ fps: 60 });
      const json = debug.toJSON();
      expect(json.enabled).toBe(true);
      expect(json.metrics.fps).toBe(60);
      expect(Array.isArray(json.timings)).toBe(true);
    });
  });
});
