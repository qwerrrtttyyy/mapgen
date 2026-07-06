export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'JOB_NOT_FOUND'
  | 'GENERATION_FAILED'
  | 'MAP_NOT_FOUND'
  | 'STORAGE_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'BACKEND_UNAVAILABLE';

export interface MapGenError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/** Result 类型 - 强制调用方处理错误 */
export type Result<T, E = MapGenError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<E extends MapGenError>(error: E): Result<never, E> {
  return { ok: false, error };
}
