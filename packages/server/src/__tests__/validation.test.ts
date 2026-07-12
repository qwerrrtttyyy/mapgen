import { describe, it, expect } from 'vitest';
import { validateGenerateParams } from '../validation.js';

describe('validateGenerateParams', () => {
  const validParams = {
    seedStr: 'test-seed',
    mapSize: 512,
    seaLevel: 0.45,
    plateCount: 8,
    octaves: 6,
    lacunarity: 2.0,
    persistence: 0.5,
    erosionIterations: 100,
    erosionStrength: 0.3,
    noiseType: 'perlin' as const,
    fbmType: 'standard' as const,
    mountainFold: 0.5,
    coastDetail: 0.5,
    lakeDensity: 0.3,
    riverCount: 500,
    tempOffset: 0,
    snowLine: 0.7,
    landmass: 0.5,
    windDirX: 1,
    windDirY: 0,
    rainStrength: 1,
    seed: 12345,
  };

  it('returns no errors for valid params', () => {
    const errors = validateGenerateParams(validParams);
    expect(errors).toEqual([]);
  });

  it('rejects missing seedStr', () => {
    const errors = validateGenerateParams({ ...validParams, seedStr: '' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('seedStr');
  });

  it('rejects seedStr over 256 chars', () => {
    const errors = validateGenerateParams({ ...validParams, seedStr: 'a'.repeat(257) });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('seedStr');
  });

  it('rejects mapSize over 4096', () => {
    const errors = validateGenerateParams({ ...validParams, mapSize: 5000 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('mapSize');
  });

  it('rejects mapSize under 16', () => {
    const errors = validateGenerateParams({ ...validParams, mapSize: 4 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects plateCount over 64', () => {
    const errors = validateGenerateParams({ ...validParams, plateCount: 100 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('plateCount');
  });

  it('rejects plateCount under 2', () => {
    const errors = validateGenerateParams({ ...validParams, plateCount: 1 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects octaves over 12', () => {
    const errors = validateGenerateParams({ ...validParams, octaves: 20 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('octaves');
  });

  it('rejects erosionIterations over 2000', () => {
    const errors = validateGenerateParams({ ...validParams, erosionIterations: 5000 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('erosionIterations');
  });

  it('rejects riverCount over 20000', () => {
    const errors = validateGenerateParams({ ...validParams, riverCount: 50000 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('riverCount');
  });

  it('rejects mapWidth*mapHeight exceeding 4096^2', () => {
    const errors = validateGenerateParams({
      ...validParams,
      mapWidth: 4096,
      mapHeight: 4097,
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.field === 'mapWidth*mapHeight')).toBe(true);
  });

  it('accepts optional fields as undefined', () => {
    const params = { seedStr: 'test', mapSize: 256, seaLevel: 0.45, plateCount: 4, octaves: 4, lacunarity: 2, persistence: 0.5, erosionIterations: 0, erosionStrength: 0, noiseType: 'perlin' as const, fbmType: 'standard' as const, mountainFold: 0, coastDetail: 0, lakeDensity: 0, tempOffset: 0, snowLine: 0.7, landmass: 0.5, seed: 1 };
    const errors = validateGenerateParams(params);
    expect(errors).toEqual([]);
  });

  it('collects multiple errors', () => {
    const errors = validateGenerateParams({
      ...validParams,
      seedStr: '',
      mapSize: 9999,
      plateCount: 0,
    });
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});
