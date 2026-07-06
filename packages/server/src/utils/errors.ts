import type { MapGenError, ErrorCode } from '@mapgen/shared-types';

export function makeError(code: ErrorCode, message: string, details?: Record<string, unknown>): MapGenError {
  return { code, message, details };
}
