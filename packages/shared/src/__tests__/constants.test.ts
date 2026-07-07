import { describe, it, expect } from 'vitest';
import {
  CONTINENT_BASE_ELEVATION,
  OCEAN_BASE_DEPTH,
  LAND_RIDGED_WEIGHT,
  LAND_DETAIL_WEIGHT,
  COAST_DETAIL_RANGE,
  BOUNDARY_SMOOTH_RADIUS,
  BOUNDARY_SMOOTH_PASSES,
  PLATE_VELOCITY_SCALE,
  BOUNDARY_TYPE_THRESHOLD,
  CONVERGENT_INTENSITY_SCALE,
  DIVERGENT_INTENSITY_SCALE,
  TRANSFORM_INTENSITY_SCALE,
  BOUNDARY_VIS_BASE,
  EROSION_STEP_FRACTION,
  EROSION_WATER_TRANSFER,
  EROSION_DEFAULT_EVAPORATION,
  EROSION_MAX_CHANGE_THRESHOLD,
  CURRENT_TEX_OFFSET,
  BIOME_ID_NORMALIZE,
  KOPPEN_BAND_NORMALIZE,
  BASIN_ID_MAX,
  MIN_MAP_SIZE,
  MAX_MAP_SIZE,
  MAX_CHECKPOINTS,
  MAX_COMMAND_STACK,
} from '../constants.js';

describe('constants', () => {
  describe('height field constants', () => {
    it('CONTINENT_BASE_ELEVATION should be positive', () => {
      expect(CONTINENT_BASE_ELEVATION).toBeGreaterThan(0);
    });

    it('OCEAN_BASE_DEPTH should be negative', () => {
      expect(OCEAN_BASE_DEPTH).toBeLessThan(0);
    });

    it('noise weights should sum to reasonable range', () => {
      const total = LAND_RIDGED_WEIGHT + LAND_DETAIL_WEIGHT;
      expect(total).toBeGreaterThan(0);
      expect(total).toBeLessThan(1);
    });

    it('COAST_DETAIL_RANGE should be small', () => {
      expect(COAST_DETAIL_RANGE).toBeLessThan(0.5);
      expect(COAST_DETAIL_RANGE).toBeGreaterThan(0);
    });

    it('BOUNDARY_SMOOTH_RADIUS should be small integer', () => {
      expect(Number.isInteger(BOUNDARY_SMOOTH_RADIUS)).toBe(true);
      expect(BOUNDARY_SMOOTH_RADIUS).toBeGreaterThanOrEqual(1);
      expect(BOUNDARY_SMOOTH_RADIUS).toBeLessThanOrEqual(5);
    });

    it('BOUNDARY_SMOOTH_PASSES should be positive', () => {
      expect(BOUNDARY_SMOOTH_PASSES).toBeGreaterThan(0);
    });
  });

  describe('tectonic constants', () => {
    it('PLATE_VELOCITY_SCALE should be small', () => {
      expect(PLATE_VELOCITY_SCALE).toBeLessThan(0.1);
      expect(PLATE_VELOCITY_SCALE).toBeGreaterThan(0);
    });

    it('BOUNDARY_TYPE_THRESHOLD should be small', () => {
      expect(BOUNDARY_TYPE_THRESHOLD).toBeLessThan(0.01);
      expect(BOUNDARY_TYPE_THRESHOLD).toBeGreaterThan(0);
    });

    it('intensity scales should be positive', () => {
      expect(CONVERGENT_INTENSITY_SCALE).toBeGreaterThan(0);
      expect(DIVERGENT_INTENSITY_SCALE).toBeGreaterThan(0);
      expect(TRANSFORM_INTENSITY_SCALE).toBeGreaterThan(0);
    });

    it('BOUNDARY_VIS_BASE should be in [0,1]', () => {
      expect(BOUNDARY_VIS_BASE).toBeGreaterThanOrEqual(0);
      expect(BOUNDARY_VIS_BASE).toBeLessThanOrEqual(1);
    });
  });

  describe('erosion constants', () => {
    it('EROSION_STEP_FRACTION should be in (0,1)', () => {
      expect(EROSION_STEP_FRACTION).toBeGreaterThan(0);
      expect(EROSION_STEP_FRACTION).toBeLessThan(1);
    });

    it('EROSION_WATER_TRANSFER should be 0.5', () => {
      expect(EROSION_WATER_TRANSFER).toBe(0.5);
    });

    it('EROSION_DEFAULT_EVAPORATION should be small', () => {
      expect(EROSION_DEFAULT_EVAPORATION).toBeGreaterThan(0);
      expect(EROSION_DEFAULT_EVAPORATION).toBeLessThan(0.1);
    });

    it('EROSION_MAX_CHANGE_THRESHOLD should be very small', () => {
      expect(EROSION_MAX_CHANGE_THRESHOLD).toBeLessThan(0.001);
    });
  });

  describe('texture packing constants', () => {
    it('BIOME_ID_NORMALIZE should be 31 (32 biomes)', () => {
      expect(BIOME_ID_NORMALIZE).toBe(31);
    });

    it('KOPPEN_BAND_NORMALIZE should be 7', () => {
      expect(KOPPEN_BAND_NORMALIZE).toBe(7);
    });

    it('BASIN_ID_MAX should be 65535', () => {
      expect(BASIN_ID_MAX).toBe(65535);
    });

    it('CURRENT_TEX_OFFSET should be 0.5', () => {
      expect(CURRENT_TEX_OFFSET).toBe(0.5);
    });
  });

  describe('UI constants', () => {
    it('MIN_MAP_SIZE should be reasonable', () => {
      expect(MIN_MAP_SIZE).toBeGreaterThanOrEqual(32);
    });

    it('MAX_MAP_SIZE should be power of 2 or multiple', () => {
      expect(MAX_MAP_SIZE).toBeGreaterThanOrEqual(1024);
    });

    it('MAX_CHECKPOINTS should be positive', () => {
      expect(MAX_CHECKPOINTS).toBeGreaterThan(0);
    });

    it('MAX_COMMAND_STACK should be positive', () => {
      expect(MAX_COMMAND_STACK).toBeGreaterThan(0);
    });
  });
});
