import type { MapParams } from '@mapgen/shared-types';
import { MAX_RESOLUTION } from '@mapgen/shared-types';

export interface ValidationError {
  field: string;
  message: string;
}

function checkNumber(
  val: unknown,
  field: string,
  min: number,
  max: number,
  errors: ValidationError[],
): void {
  if (val === undefined || val === null) return;
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    errors.push({ field, message: `${field} must be a finite number, got ${String(val)}` });
  } else if (val < min || val > max) {
    errors.push({ field, message: `${field} must be between ${min} and ${max}, got ${val}` });
  }
}

export function validateGenerateParams(params: MapParams): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!params.seedStr || typeof params.seedStr !== 'string') {
    errors.push({ field: 'seedStr', message: 'seedStr must be a non-empty string' });
  } else if (params.seedStr.length > 256) {
    errors.push({ field: 'seedStr', message: 'seedStr must be at most 256 characters' });
  }

  checkNumber(params.mapSize, 'mapSize', 16, MAX_RESOLUTION, errors);
  checkNumber(params.mapWidth, 'mapWidth', 16, MAX_RESOLUTION, errors);
  checkNumber(params.mapHeight, 'mapHeight', 16, MAX_RESOLUTION, errors);
  checkNumber(params.plateCount, 'plateCount', 2, 64, errors);
  checkNumber(params.octaves, 'octaves', 1, 12, errors);
  checkNumber(params.erosionIterations, 'erosionIterations', 0, 2000, errors);
  checkNumber(params.riverCount, 'riverCount', 0, 20000, errors);

  if (
    params.mapWidth !== undefined &&
    params.mapWidth !== null &&
    params.mapHeight !== undefined &&
    params.mapHeight !== null
  ) {
    const product = params.mapWidth * params.mapHeight;
    if (product > MAX_RESOLUTION * MAX_RESOLUTION) {
      errors.push({
        field: 'mapWidth*mapHeight',
        message: `mapWidth * mapHeight must not exceed ${MAX_RESOLUTION * MAX_RESOLUTION}, got ${product}`,
      });
    }
  }

  return errors;
}
