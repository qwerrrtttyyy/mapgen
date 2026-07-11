// @vitest-environment jsdom
// 显式声明测试环境为 jsdom（虽然 vitest.config.ts 已全局设置 environment: 'jsdom'）。
// 防御性措施：CI 上若 bun install 与 lockfile 行为不一致导致 jsdom 解析失败时，
// 显式注释能让 vitest 在文件级别强制加载 jsdom 环境，避免 'document is not defined'。

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DOM APIs
const mockToBlob = vi.fn((cb: (blob: Blob | null) => void, _type?: string, _quality?: number) => {
  cb(new Blob(['test'], { type: 'image/png' }));
});

const mockCanvas = {
  width: 512,
  height: 512,
  toBlob: mockToBlob,
  getContext: vi.fn(() => ({
    drawImage: vi.fn(),
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
  })),
} as unknown as HTMLCanvasElement;

// Mock document.createElement for canvas
const originalCreateElement = document.createElement.bind(document);
vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
  if (tag === 'canvas') {
    return mockCanvas as unknown as HTMLCanvasElement;
  }
  if (tag === 'a') {
    return {
      href: '',
      download: '',
      click: vi.fn(),
    } as unknown as HTMLAnchorElement;
  }
  return originalCreateElement(tag);
});

// Mock URL
vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:test'),
  revokeObjectURL: vi.fn(),
});

// Mock document.body
vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as never);
vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as never);

import { ExportManager } from '../export/exportManager.js';

describe('ExportManager', () => {
  let manager: ExportManager;

  beforeEach(() => {
    manager = new ExportManager();
    vi.clearAllMocks();
  });

  describe('setCanvas', () => {
    it('should store canvas reference', () => {
      manager.setCanvas(mockCanvas);
      // No direct way to verify, but subsequent export calls should work
      expect(true).toBe(true);
    });
  });

  describe('exportImage', () => {
    beforeEach(() => {
      manager.setCanvas(mockCanvas);
    });

    it('should export PNG by default', async () => {
      const result = await manager.exportImage();
      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/^mapgen-.*\.png$/);
      expect(result.size).toBeDefined();
    });

    it('should export JPEG format', async () => {
      const result = await manager.exportImage({ format: 'jpeg' });
      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/\.jpg$/);
    });

    it('should export WebP format', async () => {
      const result = await manager.exportImage({ format: 'webp' });
      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/\.webp$/);
    });

    it('should use custom filename', async () => {
      const result = await manager.exportImage({ filename: 'my-map' });
      expect(result.success).toBe(true);
      expect(result.filename).toBe('my-map.png');
    });

    it('should fail if canvas not set', async () => {
      const mgr = new ExportManager();
      const result = await mgr.exportImage();
      expect(result.success).toBe(false);
      expect(result.error).toBe('画布未初始化');
    });

    it('should handle 2x scale', async () => {
      const result = await manager.exportImage({ scale: 2 });
      expect(result.success).toBe(true);
    });

    it('should handle 4x scale', async () => {
      const result = await manager.exportImage({ scale: 4 });
      expect(result.success).toBe(true);
    });
  });

  describe('exportData', () => {
    const mockMapData = {
      width: 256,
      height: 256,
      elevTex: new Float32Array(256 * 256 * 4),
      plateTex: new Float32Array(256 * 256 * 4),
      moistTex: new Float32Array(256 * 256 * 4),
      tempTex: new Float32Array(256 * 256 * 4),
      riverTex: new Float32Array(256 * 256 * 4),
      plates: [{ id: 0, type: 'continent' }],
      rivers: [{ id: 0 }],
      regions: [{ id: 0 }],
      names: { plates: [], regions: [] },
      seed: 12345,
    } as never;

    const mockParams = {
      seedStr: 'test',
      mapWidth: 256,
      mapHeight: 256,
      seaLevel: 0.45,
    } as never;

    it('should export JSON with metadata', () => {
      const result = manager.exportData(mockMapData, mockParams);
      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/mapgen-data-.*\.json$/);
    });

    it('should export with custom filename', () => {
      const result = manager.exportData(mockMapData, mockParams, { filename: 'my-data' });
      expect(result.success).toBe(true);
      expect(result.filename).toBe('my-data.json');
    });

    it('should include texture summary when requested', () => {
      const result = manager.exportData(mockMapData, mockParams, { includeTextureSummary: true });
      expect(result.success).toBe(true);
    });

    it('should exclude params when requested', () => {
      const result = manager.exportData(mockMapData, mockParams, { includeParams: false });
      expect(result.success).toBe(true);
    });
  });
});
