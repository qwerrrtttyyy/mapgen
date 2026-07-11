import { describe, it, expect } from 'vitest';
import {
  ok,
  err,
  unwrap,
  createError,
  MapGenException,
  type Result,
  type MapGenError,
  type ErrorCode,
} from '../errors.js';

describe('Result 类型', () => {
  describe('ok()', () => {
    it('返回 { ok: true, value }', () => {
      const r = ok(42);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe(42);
    });

    it('支持 null/undefined 值', () => {
      expect(ok(null).value).toBeNull();
      expect(ok(undefined).value).toBeUndefined();
    });

    it('支持对象/数组', () => {
      const r = ok({ a: 1, b: [2, 3] });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.b).toEqual([2, 3]);
    });
  });

  describe('err()', () => {
    it('返回 { ok: false, error }', () => {
      const e: MapGenError = { code: 'VALIDATION_ERROR', message: 'bad' };
      const r = err(e);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('unwrap()', () => {
    it('成功时返回 value', () => {
      expect(unwrap(ok(99))).toBe(99);
    });

    it('失败时抛出 MapGenException', () => {
      const e: MapGenError = { code: 'NETWORK_ERROR', message: 'disconnected' };
      expect(() => unwrap(err(e))).toThrow(MapGenException);
    });

    it('抛出的异常携带 mapGenError', () => {
      const e: MapGenError = { code: 'TIMEOUT', message: 'slow' };
      try {
        unwrap(err(e));
        expect.fail('should have thrown');
      } catch (ex) {
        expect(ex).toBeInstanceOf(MapGenException);
        const mge = ex as MapGenException;
        expect(mge.mapGenError.code).toBe('TIMEOUT');
        expect(mge.mapGenError.message).toBe('slow');
        expect(mge.message).toBe('slow');
        expect(mge.name).toBe('MapGenException');
      }
    });
  });

  describe('类型守卫', () => {
    it('可以用 if (r.ok) 收窄类型', () => {
      const r: Result<string> = ok('hello');
      if (r.ok) {
        expect(r.value.length).toBe(5);
      } else {
        expect.fail('should be ok');
      }
    });

    it('可以用 if (!r.ok) 收窄错误类型', () => {
      const r: Result<string> = err({ code: 'SERVER_ERROR', message: 'down' });
      if (!r.ok) {
        expect(r.error.code).toBe('SERVER_ERROR');
      } else {
        expect.fail('should be err');
      }
    });
  });
});

describe('createError()', () => {
  it('创建基本错误对象', () => {
    const e = createError('MAP_NOT_FOUND', 'not here');
    expect(e.code).toBe('MAP_NOT_FOUND');
    expect(e.message).toBe('not here');
    expect(e.details).toBeUndefined();
    expect(e.cause).toBeUndefined();
  });

  it('携带 details', () => {
    const e = createError('VALIDATION_ERROR', 'bad field', { field: 'seedStr', value: 42 });
    expect(e.details).toEqual({ field: 'seedStr', value: 42 });
  });

  it('携带 cause', () => {
    const root = new Error('disk full');
    const e = createError('STORAGE_ERROR', 'write failed', undefined, root);
    expect(e.cause).toBe(root);
  });

  it('所有 ErrorCode 值都被接受', () => {
    const codes: ErrorCode[] = [
      'VALIDATION_ERROR',
      'JOB_NOT_FOUND',
      'GENERATION_ABORTED',
      'GENERATION_FAILED',
      'OUT_OF_MEMORY',
      'MAP_NOT_FOUND',
      'CHECKPOINT_NOT_FOUND',
      'STORAGE_ERROR',
      'STORAGE_QUOTA_EXCEEDED',
      'NETWORK_ERROR',
      'TIMEOUT',
      'BACKEND_UNAVAILABLE',
      'SERVER_ERROR',
    ];
    for (const code of codes) {
      const e = createError(code, 'test');
      expect(e.code).toBe(code);
    }
  });
});

describe('MapGenException', () => {
  it('继承 Error', () => {
    const ex = new MapGenException({ code: 'SERVER_ERROR', message: 'boom' });
    expect(ex).toBeInstanceOf(Error);
  });

  it('name 属性为 MapGenException', () => {
    const ex = new MapGenException({ code: 'SERVER_ERROR', message: 'boom' });
    expect(ex.name).toBe('MapGenException');
  });

  it('message 取自 MapGenError.message', () => {
    const ex = new MapGenException({ code: 'SERVER_ERROR', message: 'custom msg' });
    expect(ex.message).toBe('custom msg');
  });

  it('mapGenError 持有原始错误对象', () => {
    const error: MapGenError = {
      code: 'GENERATION_FAILED',
      message: 'pipeline crashed',
      details: { phase: 'erosion' },
    };
    const ex = new MapGenException(error);
    expect(ex.mapGenError).toBe(error);
    expect(ex.mapGenError.details?.phase).toBe('erosion');
  });

  it('可以被 catch 块区分', () => {
    function risky(): void {
      throw new MapGenException({ code: 'TIMEOUT', message: 'slow' });
    }
    try {
      risky();
      expect.fail('should throw');
    } catch (e) {
      if (e instanceof MapGenException) {
        expect(e.mapGenError.code).toBe('TIMEOUT');
      } else {
        expect.fail('wrong exception type');
      }
    }
  });
});
