import { describe, it } from 'node:test';
import assert from 'node:assert';
import { RendererFactory, BaseRenderer } from '../../public/js/renderer/renderer-factory.js';

describe('RendererFactory', () => {
  describe('create()', () => {
    it('should create WebGL renderer', () => {
      const renderer = RendererFactory.create('webgl', {
        canvas: { width: 800, height: 600, getContext: () => ({}) },
      });
      
      assert.ok(renderer);
      assert.strictEqual(renderer.type, 'webgl');
    });

    it('should create Canvas2D renderer', () => {
      const renderer = RendererFactory.create('canvas2d', {
        canvas: { width: 800, height: 600, getContext: () => ({}) },
      });
      
      assert.ok(renderer);
      assert.strictEqual(renderer.type, 'canvas2d');
    });

    it('should throw for unknown renderer type', () => {
      try {
        RendererFactory.create('unknown', {});
        assert.fail('Should have thrown');
      } catch (err) {
        assert.ok(err.message.includes('Unknown renderer type'));
      }
    });
  });

  describe('getAvailableRenderers()', () => {
    it('should return list of available renderers', () => {
      const renderers = RendererFactory.getAvailableRenderers();
      
      assert.ok(Array.isArray(renderers));
      // 在 Node.js 环境中可能没有 WebGL
      assert.ok(renderers.includes('canvas2d'));
    });
  });
});

describe('BaseRenderer', () => {
  describe('constructor()', () => {
    it('should create base renderer', () => {
      const renderer = new BaseRenderer({ type: 'test' });
      
      assert.ok(renderer);
      assert.strictEqual(renderer.type, 'test');
    });
  });

  describe('resize()', () => {
    it('should update dimensions', () => {
      const renderer = new BaseRenderer({ type: 'test' });
      
      renderer.resize(1024, 768);
      
      assert.strictEqual(renderer.width, 1024);
      assert.strictEqual(renderer.height, 768);
    });
  });

  describe('render()', () => {
    it('should throw if not implemented', () => {
      const renderer = new BaseRenderer({ type: 'test' });
      
      try {
        renderer.render({});
        assert.fail('Should have thrown');
      } catch (err) {
        assert.ok(err.message.includes('must implement render()'));
      }
    });
  });
});
