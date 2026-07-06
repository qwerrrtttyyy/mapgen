import { describe, it, expect, beforeAll } from 'vitest';
import app from '../index.js';

describe('server', () => {
  it('returns health status', async () => {
    const res = await app.request('/api/v1/health');
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; capabilities: { supportsPersistence: boolean } };
    expect(body.status).toBe('ok');
    expect(body.capabilities.supportsPersistence).toBe(true);
  });

  it('creates a generation job', async () => {
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
    const body = await res.json() as { jobId: string };
    expect(body.jobId).toBeDefined();
  });
});
