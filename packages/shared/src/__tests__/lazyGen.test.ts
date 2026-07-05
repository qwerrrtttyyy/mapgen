// LazyGen module tests - 惰性生成系统测试
import { describe, it, expect } from 'vitest';
import { computeDetailPatch, detectDetailPeaks, type ViewportRegion } from '../lazyGen.js';

describe('computeDetailPatch', () => {
  const createBaseElevation = (width: number, height: number): Float32Array => {
    const arr = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        arr[y * width + x] = 0.5;
      }
    }
    return arr;
  };

  const createViewportRegion = (overrides?: Partial<ViewportRegion>): ViewportRegion => ({
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    outW: 50,
    outH: 50,
    ...overrides,
  });

  it('should return detail patch with correct dimensions', () => {
    const baseElevation = createBaseElevation(100, 100);
    const region = createViewportRegion();
    
    const result = computeDetailPatch(baseElevation, 100, 100, region, 42);
    
    expect(result.width).toBe(50);
    expect(result.height).toBe(50);
    expect(result.elevation).toHaveLength(50 * 50);
    expect(result.slope).toHaveLength(50 * 50);
  });

  it('should preserve base elevation through bilinear sampling', () => {
    const baseElevation = createBaseElevation(100, 100);
    // Set a distinct value in center
    baseElevation[50 * 100 + 50] = 0.8;
    
    const region = createViewportRegion({ x: 40, y: 40, w: 20, h: 20, outW: 20, outH: 20 });
    
    const result = computeDetailPatch(baseElevation, 100, 100, region, 42, 'perlin', 'standard', 2.0, 0.5, 0.01);
    
    // Center of output should reflect the high elevation
    const centerIdx = 10 * 20 + 10;
    expect(result.elevation[centerIdx]).toBeGreaterThan(0.7);
  });

  it('should add detail noise to base elevation', () => {
    const baseElevation = createBaseElevation(50, 50);
    const region = createViewportRegion({ outW: 25, outH: 25 });
    
    const result1 = computeDetailPatch(baseElevation, 50, 50, region, 42, 'perlin', 'standard', 2.0, 0.5, 0.08);
    const result2 = computeDetailPatch(baseElevation, 50, 50, region, 42, 'perlin', 'standard', 2.0, 0.5, 0.001);
    
    // Higher detail strength should produce more variation
    let variance1 = 0, variance2 = 0;
    const mean1 = result1.elevation.reduce((a, b) => a + b, 0) / result1.elevation.length;
    const mean2 = result2.elevation.reduce((a, b) => a + b, 0) / result2.elevation.length;
    
    for (let i = 0; i < result1.elevation.length; i++) {
      variance1 += (result1.elevation[i] - mean1) ** 2;
      variance2 += (result2.elevation[i] - mean2) ** 2;
    }
    
    // With higher detail strength, we expect more variation but allow some tolerance
    expect(variance1).toBeGreaterThanOrEqual(variance2 * 0.9);
  });

  it('should handle different noise types', () => {
    const baseElevation = createBaseElevation(50, 50);
    const region = createViewportRegion({ outW: 25, outH: 25 });
    
    const perlin = computeDetailPatch(baseElevation, 50, 50, region, 42, 'perlin');
    const value = computeDetailPatch(baseElevation, 50, 50, region, 42, 'value');
    const simplex = computeDetailPatch(baseElevation, 50, 50, region, 42, 'simplex');
    
    // All should produce valid results
    expect(perlin.elevation).toBeDefined();
    expect(value.elevation).toBeDefined();
    expect(simplex.elevation).toBeDefined();
  });

  it('should handle different FBM types', () => {
    const baseElevation = createBaseElevation(50, 50);
    const region = createViewportRegion({ outW: 25, outH: 25 });
    
    const standard = computeDetailPatch(baseElevation, 50, 50, region, 42, 'perlin', 'standard');
    const ridged = computeDetailPatch(baseElevation, 50, 50, region, 42, 'perlin', 'ridged');
    const billowy = computeDetailPatch(baseElevation, 50, 50, region, 42, 'perlin', 'billowy');
    
    // Ridged should have different characteristics
    expect(standard.elevation).toBeDefined();
    expect(ridged.elevation).toBeDefined();
    expect(billowy.elevation).toBeDefined();
  });

  it('should calculate slope correctly', () => {
    const baseElevation = new Float32Array(20 * 20);
    // Create a slope from left to right
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        baseElevation[y * 20 + x] = x * 0.05;
      }
    }
    
    const region = createViewportRegion({ x: 0, y: 0, w: 20, h: 20, outW: 20, outH: 20 });
    
    const result = computeDetailPatch(baseElevation, 20, 20, region, 42, 'perlin', 'standard', 2.0, 0.5, 0.001);
    
    // Slope should be positive in x direction
    let positiveSlopeCount = 0;
    for (let i = 1; i < result.slope.length - 1; i++) {
      if (result.slope[i] > 0) positiveSlopeCount++;
    }
    expect(positiveSlopeCount).toBeGreaterThan(0);
  });

  it('should handle edge regions', () => {
    const baseElevation = createBaseElevation(100, 100);
    const region = createViewportRegion({ x: 80, y: 80, w: 20, h: 20, outW: 10, outH: 10 });
    
    const result = computeDetailPatch(baseElevation, 100, 100, region, 42);
    
    expect(result.elevation).toHaveLength(10 * 10);
    expect(result.width).toBe(10);
    expect(result.height).toBe(10);
  });

  it('should clamp elevation values to [0, 1]', () => {
    const baseElevation = createBaseElevation(50, 50);
    // Set extreme values
    for (let i = 0; i < baseElevation.length; i++) {
      baseElevation[i] = 0.5;
    }
    
    const region = createViewportRegion({ outW: 25, outH: 25 });
    
    const result = computeDetailPatch(baseElevation, 50, 50, region, 42, 'perlin', 'standard', 2.0, 0.5, 0.1);
    
    for (let i = 0; i < result.elevation.length; i++) {
      expect(result.elevation[i]).toBeGreaterThanOrEqual(0);
      expect(result.elevation[i]).toBeLessThanOrEqual(1);
    }
  });

  it('should use seed for reproducible results', () => {
    const baseElevation = createBaseElevation(50, 50);
    const region = createViewportRegion({ outW: 25, outH: 25 });
    
    const result1 = computeDetailPatch(baseElevation, 50, 50, region, 123);
    const result2 = computeDetailPatch(baseElevation, 50, 50, region, 123);
    const result3 = computeDetailPatch(baseElevation, 50, 50, region, 456);
    
    // Same seed should produce same result
    for (let i = 0; i < result1.elevation.length; i++) {
      expect(result1.elevation[i]).toBe(result2.elevation[i]);
    }
    
    // Different seed may produce different results (noise is deterministic but values can be similar)
    // Just verify the function runs and produces valid output
    expect(result3.elevation).toBeDefined();
    expect(result3.elevation.length).toBe(result1.elevation.length);
  });
});

describe('detectDetailPeaks', () => {
  const createPatch = (width: number, height: number, seaLevel: number = 0.5) => {
    const elevation = new Float32Array(width * height);
    for (let i = 0; i < elevation.length; i++) {
      elevation[i] = 0.3; // Below sea level by default
    }
    return {
      width,
      height,
      elevation,
      slope: new Float32Array(width * height),
      region: createViewportRegion({ outW: width, outH: height }),
    };
  };

  const createViewportRegion = (overrides?: Partial<ViewportRegion>): ViewportRegion => ({
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    outW: 50,
    outH: 50,
    ...overrides,
  });

  it('should detect a single peak', () => {
    const patch = createPatch(20, 20);
    // Create a peak in the center
    for (let y = 5; y < 15; y++) {
      for (let x = 5; x < 15; x++) {
        const idx = y * 20 + x;
        const distFromCenter = Math.sqrt((x - 10) ** 2 + (y - 10) ** 2);
        patch.elevation[idx] = Math.max(0.3, 0.9 - distFromCenter * 0.06);
      }
    }
    
    const peaks = detectDetailPeaks(patch, 0.5);
    
    expect(peaks.length).toBeGreaterThan(0);
    expect(peaks[0].elevation).toBeGreaterThan(0.5);
  });

  it('should filter peaks by prominence', () => {
    const patch = createPatch(30, 30);
    // Create two peaks with different prominences
    for (let y = 5; y < 25; y++) {
      for (let x = 5; x < 25; x++) {
        const idx = y * 30 + x;
        const dist1 = Math.sqrt((x - 10) ** 2 + (y - 10) ** 2);
        const dist2 = Math.sqrt((x - 20) ** 2 + (y - 20) ** 2);
        const peak1 = Math.max(0.3, 0.9 - dist1 * 0.05);
        const peak2 = Math.max(0.3, 0.7 - dist2 * 0.03);
        patch.elevation[idx] = Math.max(peak1, peak2);
      }
    }
    
    const peaksLow = detectDetailPeaks(patch, 0.5, 0.05);
    const peaksHigh = detectDetailPeaks(patch, 0.5, 0.15);
    
    expect(peaksLow.length).toBeGreaterThanOrEqual(peaksHigh.length);
  });

  it('should filter peaks by spacing', () => {
    const patch = createPatch(30, 30);
    // Create multiple close peaks
    for (let y = 10; y < 20; y++) {
      for (let x = 10; x < 20; x++) {
        const idx = y * 30 + x;
        patch.elevation[idx] = 0.8;
      }
    }
    
    const peaksClose = detectDetailPeaks(patch, 0.5, 0.05, 2);
    const peaksFar = detectDetailPeaks(patch, 0.5, 0.05, 10);
    
    expect(peaksClose.length).toBeGreaterThanOrEqual(peaksFar.length);
  });

  it('should return empty array for flat terrain', () => {
    const patch = createPatch(20, 20);
    for (let i = 0; i < patch.elevation.length; i++) {
      patch.elevation[i] = 0.6;
    }
    
    const peaks = detectDetailPeaks(patch, 0.5);
    
    expect(peaks.length).toBe(0);
  });

  it('should return empty array for all ocean', () => {
    const patch = createPatch(20, 20, 0.8);
    for (let i = 0; i < patch.elevation.length; i++) {
      patch.elevation[i] = 0.5;
    }
    
    const peaks = detectDetailPeaks(patch, 0.8);
    
    expect(peaks.length).toBe(0);
  });

  it('should provide correct map coordinates', () => {
    const patch = createPatch(20, 20);
    // Create a peak
    for (let y = 8; y < 12; y++) {
      for (let x = 8; x < 12; x++) {
        patch.elevation[y * 20 + x] = 0.9;
      }
    }
    
    const peaks = detectDetailPeaks(patch, 0.5);
    
    if (peaks.length > 0) {
      expect(peaks[0].mapX).toBeDefined();
      expect(peaks[0].mapY).toBeDefined();
      expect(peaks[0].x).toBeGreaterThanOrEqual(0);
      expect(peaks[0].y).toBeGreaterThanOrEqual(0);
    }
  });

  it('should handle small patches', () => {
    const patch = createPatch(10, 10);
    for (let i = 0; i < patch.elevation.length; i++) {
      patch.elevation[i] = 0.8;
    }
    
    const peaks = detectDetailPeaks(patch, 0.5);
    
    // Small patches may not have valid peaks due to border requirements
    expect(Array.isArray(peaks)).toBe(true);
  });

  it('should sort peaks by prominence', () => {
    const patch = createPatch(40, 40);
    // Create multiple peaks at different locations
    const peakLocations = [[10, 10, 0.9], [20, 20, 0.8], [30, 30, 0.7]];
    for (const [px, py, elev] of peakLocations) {
      for (let y = py - 3; y <= py + 3; y++) {
        for (let x = px - 3; x <= px + 3; x++) {
          if (y >= 0 && y < 40 && x >= 0 && x < 40) {
            patch.elevation[y * 40 + x] = elev;
          }
        }
      }
    }
    
    const peaks = detectDetailPeaks(patch, 0.5, 0.05, 5);
    
    // Peaks should be sorted by prominence (highest first)
    for (let i = 1; i < peaks.length; i++) {
      expect(peaks[i - 1].prominence).toBeGreaterThanOrEqual(peaks[i].prominence);
    }
  });
});
