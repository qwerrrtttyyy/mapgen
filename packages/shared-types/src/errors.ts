export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'JOB_NOT_FOUND'
  | 'GENERATION_ABORTED'
  | 'GENERATION_FAILED'
  | 'OUT_OF_MEMORY'
  | 'MAP_NOT_FOUND'
  | 'CHECKPOINT_NOT_FOUND'
  | 'STORAGE_ERROR'
  | 'STORAGE_QUOTA_EXCEEDED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'BACKEND_UNAVAILABLE'
  | 'SERVER_ERROR';

export interface MapGenError {
  code: ErrorCode;
  message: string;
  cause?: unknown;
  details?: Record<string, unknown>;
}

/** Result 类型 - 强制调用方处理错误 */
export type Result<T, E = MapGenError> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<E extends MapGenError>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** 解包 Result，失败时抛出 MapGenException */
export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  throw new MapGenException(result.error);
}

/** 创建标准化错误对象 */
export function createError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
  cause?: unknown
): MapGenError {
  return { code, message, details, cause };
}

/** 业务异常类 - 携带结构化错误信息 */
export class MapGenException extends Error {
  public readonly mapGenError: MapGenError;

  constructor(error: MapGenError) {
    super(error.message);
    this.name = 'MapGenException';
    this.mapGenError = error;
  }
}
