import { describe, it, expect } from 'vitest';
import app from '../index.js';
import type { SerializedMapData } from '@mapgen/shared-types';

/** 最小可用的 SerializedMapData，用于 POST /maps 测试 */
function makeMap(seed: number = 42): SerializedMapData {
  return {
    width: 4,
    height: 4,
    seed,
    plates: [],
    regions: [],
    rivers: [],
    names: { plates: [], regions: [] },
    textures: {
      plateTex: btoa('AAAA'),
      elevTex: btoa('AAAA'),
      moistTex: btoa('AAAA'),
      riverTex: btoa('AAAA'),
      tempTex: btoa('AAAA'),
    },
    volcanoSites: [],
    hotspots: [],
  };
}

describe('Maps API (/api/v1/maps)', () => {
  describe('POST /maps', () => {
    it('创建地图并返回 201 + id', async () => {
      const res = await app.request('/api/v1/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ map: makeMap(1), meta: { name: '测试地图' } }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { id: string; createdAt: number };
      expect(body.id).toBeDefined();
      expect(body.createdAt).toBeGreaterThan(0);
    });

    it('不带 meta 也能创建', async () => {
      const res = await app.request('/api/v1/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ map: makeMap(2) }),
      });
      expect(res.status).toBe(201);
    });
  });

  describe('GET /maps', () => {
    it('返回空列表（初始状态）', async () => {
      // 注意：由于 server 是 in-memory 且单例，其他测试可能已写入数据
      // 这里只验证返回结构正确
      const res = await app.request('/api/v1/maps');
      expect(res.status).toBe(200);
      const body = (await res.json()) as { maps: unknown[]; total: number };
      expect(body.maps).toBeInstanceOf(Array);
      expect(body.total).toBeGreaterThanOrEqual(0);
    });

    it('支持 limit 参数', async () => {
      // 先写入 2 条
      await app.request('/api/v1/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ map: makeMap(10), meta: { name: 'A' } }),
      });
      await app.request('/api/v1/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ map: makeMap(11), meta: { name: 'B' } }),
      });

      const res = await app.request('/api/v1/maps?limit=1');
      expect(res.status).toBe(200);
      const body = (await res.json()) as { maps: unknown[]; total: number };
      expect(body.maps.length).toBeLessThanOrEqual(1);
    });
  });

  describe('GET /maps/:id', () => {
    it('返回已存在的地图', async () => {
      const createRes = await app.request('/api/v1/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ map: makeMap(20), meta: { name: '查找测试' } }),
      });
      const { id } = (await createRes.json()) as { id: string };

      const res = await app.request(`/api/v1/maps/${id}`);
      expect(res.status).toBe(200);
      const map = (await res.json()) as SerializedMapData;
      expect(map.seed).toBe(20);
      expect(map.width).toBe(4);
    });

    it('不存在的 id 返回 404 + MAP_NOT_FOUND', async () => {
      const res = await app.request('/api/v1/maps/nonexistent-id-12345');
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string; message: string } };
      expect(body.error.code).toBe('MAP_NOT_FOUND');
    });
  });

  describe('DELETE /maps/:id', () => {
    it('删除已存在的地图返回 204', async () => {
      const createRes = await app.request('/api/v1/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ map: makeMap(30), meta: { name: '待删除' } }),
      });
      const { id } = (await createRes.json()) as { id: string };

      const delRes = await app.request(`/api/v1/maps/${id}`, { method: 'DELETE' });
      expect(delRes.status).toBe(204);

      // 二次 GET 应 404
      const getRes = await app.request(`/api/v1/maps/${id}`);
      expect(getRes.status).toBe(404);
    });

    it('删除不存在的 id 返回 404', async () => {
      const res = await app.request('/api/v1/maps/nonexistent-delete-id', {
        method: 'DELETE',
      });
      expect(res.status).toBe(404);
    });
  });
});

describe('Presets API (/api/v1/presets)', () => {
  it('GET /presets 返回 200 + presets 数组', async () => {
    const res = await app.request('/api/v1/presets');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { presets: unknown[] };
    expect(body.presets).toBeInstanceOf(Array);
  });
});

describe('Generate API (/api/v1/generate)', () => {
  it('有效参数返回 202 + jobId', async () => {
    const res = await app.request('/api/v1/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        params: {
          seedStr: 'test',
          plateCount: 4,
          landmass: 0.3,
          noiseType: 'perlin',
          fbmType: 'standard',
          octaves: 3,
          lacunarity: 2,
          persistence: 0.5,
          seaLevel: 0.45,
          mountainFold: 0.3,
          coastDetail: 0.5,
          erosionIterations: 10,
          erosionStrength: 0.5,
          lakeDensity: 0.02,
          tempOffset: 0,
          snowLine: 0.5,
        },
      }),
    });
    expect(res.status).toBe(202);
    const body = (await res.json()) as { jobId: string; status: string };
    expect(body.jobId).toBeDefined();
    expect(body.status).toBe('queued');
  });
});

describe('Jobs API (/api/v1/jobs/:id)', () => {
  it('不存在的 job id 返回 404 + JOB_NOT_FOUND', async () => {
    const res = await app.request('/api/v1/jobs/nonexistent-job-9999');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('JOB_NOT_FOUND');
  });
});

describe('Health API (/api/v1/health)', () => {
  it('返回 ok 状态与能力清单', async () => {
    const res = await app.request('/api/v1/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      version: string;
      capabilities: { supportsPersistence: boolean; features: string[] };
    };
    expect(body.status).toBe('ok');
    expect(body.version).toBeDefined();
    expect(body.capabilities.supportsPersistence).toBe(true);
    expect(body.capabilities.features).toBeInstanceOf(Array);
    expect(body.capabilities.features.length).toBeGreaterThan(0);
  });
});
