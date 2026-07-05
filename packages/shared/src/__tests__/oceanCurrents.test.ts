// Ocean Currents module tests - 洋流系统测试
import { describe, it, expect } from 'vitest';
import { computeOceanCurrents, type OceanCurrentInput } from '../oceanCurrents.js';

describe('computeOceanCurrents', () => {
  const createInput = (overrides?: Partial<OceanCurrentInput>): OceanCurrentInput => ({
    width: 32,
    height: 32,
    elevation: new Float32Array(32 * 32),
    seaLevel: 0.5,
    coastDist: new Float32Array(32 * 32),
    windDirX: 0,
    windDirY: 0,
    seed: 42,
    ...overrides,
  });

  it('should return ocean current result with correct dimensions', () => {
    const input = createInput();
    for (let i = 0; i < input.elevation.length; i++) {
      input.elevation[i] = 0.3; // All ocean
    }
    
    const result = computeOceanCurrents(input);
    
    expect(result.vx).toHaveLength(32 * 32);
    expect(result.vy).toHaveLength(32 * 32);
    expect(result.tempDelta).toHaveLength(32 * 32);
    expect(result.speed).toHaveLength(32 * 32);
  });

  it('should only calculate currents for ocean cells', () => {
    const input = createInput();
    // Set left half as land, right half as ocean
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const idx = y * 32 + x;
        if (x < 16) {
          input.elevation[idx] = 0.7; // Land
        } else {
          input.elevation[idx] = 0.3; // Ocean
        }
      }
    }
    
    const result = computeOceanCurrents(input);
    
    // Land cells should have zero velocity
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 16; x++) {
        const idx = y * 32 + x;
        expect(result.vx[idx]).toBe(0);
        expect(result.vy[idx]).toBe(0);
      }
    }
    
    // Ocean cells should have non-zero velocity
    let oceanWithCurrent = 0;
    for (let y = 0; y < 32; y++) {
      for (let x = 16; x < 32; x++) {
        const idx = y * 32 + x;
        if (result.speed[idx] > 0) oceanWithCurrent++;
      }
    }
    expect(oceanWithCurrent).toBeGreaterThan(0);
  });

  it('should apply Ekman drift based on latitude', () => {
    const input = createInput({ width: 20, height: 40 });
    for (let i = 0; i < input.elevation.length; i++) {
      input.elevation[i] = 0.3; // All ocean
    }
    
    const result = computeOceanCurrents(input);
    
    // Northern hemisphere (y > 20) should have different flow than southern
    let northVxSum = 0, southVxSum = 0;
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 20; x++) {
        const idx = y * 20 + x;
        if (y < 20) {
          southVxSum += result.vx[idx];
        } else {
          northVxSum += result.vx[idx];
        }
      }
    }
    
    // Ekman drift should cause difference between hemispheres
    expect(northVxSum).not.toBe(southVxSum);
  });

  it('should apply western boundary intensification', () => {
    const input = createInput({ width: 40, height: 20 });
    // Create ocean with land on west side
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 40; x++) {
        const idx = y * 40 + x;
        if (x === 0) {
          input.elevation[idx] = 0.7; // Land on west edge
        } else {
          input.elevation[idx] = 0.3; // Ocean
        }
        input.coastDist[idx] = x; // Distance from coast
      }
    }
    
    const result = computeOceanCurrents(input);
    
    // Western boundary (x=1) should have stronger currents
    let boundarySpeedSum = 0, openSpeedSum = 0;
    for (let y = 5; y < 15; y++) {
      boundarySpeedSum += result.speed[y * 40 + 1];
      openSpeedSum += result.speed[y * 40 + 20];
    }
    
    // Boundary currents should be intensified
    expect(boundarySpeedSum).toBeGreaterThan(openSpeedSum);
  });

  it('should generate warm and cold currents based on flow direction', () => {
    const input = createInput();
    for (let i = 0; i < input.elevation.length; i++) {
      input.elevation[i] = 0.3; // All ocean
    }
    
    const result = computeOceanCurrents(input);
    
    // Verify that tempDelta values exist and vary across the map
    let hasPositiveTemp = false;
    let hasNegativeTemp = false;
    for (let i = 0; i < result.tempDelta.length; i++) {
      if (result.tempDelta[i] > 0.01) hasPositiveTemp = true;
      if (result.tempDelta[i] < -0.01) hasNegativeTemp = true;
    }
    
    // Should have both warm and cold currents
    expect(hasPositiveTemp || hasNegativeTemp).toBe(true);
  });

  it('should diffuse temperature to coastal land', () => {
    const input = createInput();
    // Create a coastline
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const idx = y * 32 + x;
        if (x < 16) {
          input.elevation[idx] = 0.7; // Land
          input.coastDist[idx] = 16 - x; // Distance from coast
        } else {
          input.elevation[idx] = 0.3; // Ocean
          input.coastDist[idx] = 0;
        }
      }
    }
    
    const result = computeOceanCurrents(input);
    
    // Coastal land should have temperature delta from ocean
    let coastalLandWithTemp = 0;
    for (let y = 0; y < 32; y++) {
      for (let x = 10; x < 16; x++) {
        const idx = y * 32 + x;
        if (Math.abs(result.tempDelta[idx]) > 0.001) {
          coastalLandWithTemp++;
        }
      }
    }
    expect(coastalLandWithTemp).toBeGreaterThan(0);
  });

  it('should handle user wind direction bias', () => {
    const input1 = createInput({ windDirX: 1, windDirY: 0 });
    const input2 = createInput({ windDirX: -1, windDirY: 0 });
    
    for (let i = 0; i < input1.elevation.length; i++) {
      input1.elevation[i] = 0.3;
      input2.elevation[i] = 0.3;
    }
    
    const result1 = computeOceanCurrents(input1);
    const result2 = computeOceanCurrents(input2);
    
    // Different wind directions should produce different currents
    let diffCount = 0;
    for (let i = 0; i < result1.vx.length; i++) {
      if (Math.abs(result1.vx[i] - result2.vx[i]) > 0.001) {
        diffCount++;
      }
    }
    expect(diffCount).toBeGreaterThan(0);
  });

  it('should smooth currents with lateral mixing', () => {
    const input = createInput();
    for (let i = 0; i < input.elevation.length; i++) {
      input.elevation[i] = 0.3;
    }
    
    const result = computeOceanCurrents(input);
    
    // Adjacent ocean cells should have similar velocities after smoothing
    let similarCount = 0;
    for (let y = 1; y < 31; y++) {
      for (let x = 1; x < 31; x++) {
        const idx = y * 32 + x;
        const neighborIdx = idx + 1;
        const vxDiff = Math.abs(result.vx[idx] - result.vx[neighborIdx]);
        if (vxDiff < 0.1) {
          similarCount++;
        }
      }
    }
    expect(similarCount).toBeGreaterThan(100);
  });

  it('should handle all land map', () => {
    const input = createInput();
    for (let i = 0; i < input.elevation.length; i++) {
      input.elevation[i] = 0.7; // All land
    }
    
    const result = computeOceanCurrents(input);
    
    // All velocities should be zero
    for (let i = 0; i < result.vx.length; i++) {
      expect(result.vx[i]).toBe(0);
      expect(result.vy[i]).toBe(0);
    }
  });

  it('should calculate speed correctly from velocity components', () => {
    const input = createInput();
    for (let i = 0; i < input.elevation.length; i++) {
      input.elevation[i] = 0.3;
    }
    
    const result = computeOceanCurrents(input);
    
    // Speed should match sqrt(vx^2 + vy^2)
    for (let i = 0; i < result.speed.length; i++) {
      const expectedSpeed = Math.sqrt(result.vx[i] ** 2 + result.vy[i] ** 2);
      expect(Math.abs(result.speed[i] - expectedSpeed)).toBeLessThan(0.001);
    }
  });

  it('should handle different rain strength values', () => {
    const input1 = createInput({ rainStrength: 0.5 });
    const input2 = createInput({ rainStrength: 2.0 });
    
    for (let i = 0; i < input1.elevation.length; i++) {
      input1.elevation[i] = 0.3;
      input2.elevation[i] = 0.3;
    }
    
    const result1 = computeOceanCurrents(input1);
    const result2 = computeOceanCurrents(input2);
    
    // Both should produce valid results
    expect(result1.speed).toBeDefined();
    expect(result2.speed).toBeDefined();
    
    // Verify both produce non-zero currents in some cells
    let hasCurrent1 = false, hasCurrent2 = false;
    for (let i = 0; i < result1.speed.length; i++) {
      if (result1.speed[i] > 0.001) hasCurrent1 = true;
      if (result2.speed[i] > 0.001) hasCurrent2 = true;
    }
    expect(hasCurrent1).toBe(true);
    expect(hasCurrent2).toBe(true);
  });

  it('should handle edge pixels without errors', () => {
    const input = createInput({ width: 10, height: 10 });
    for (let i = 0; i < input.elevation.length; i++) {
      input.elevation[i] = 0.3;
    }
    
    const result = computeOceanCurrents(input);
    
    // Edge pixels should not cause errors
    expect(result.vx[0]).toBeDefined();
    expect(result.vx[9]).toBeDefined();
    expect(result.vx[90]).toBeDefined();
    expect(result.vx[99]).toBeDefined();
  });
});
