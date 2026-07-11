/** 创建默认 `ArrayBufferLike` 类型的 typed array，避免 TS 5.7+ 泛型不兼容。 */
export function f32(size: number): Float32Array {
  return new Float32Array(size) as unknown as Float32Array;
}

export function u8(size: number): Uint8Array {
  return new Uint8Array(size) as unknown as Uint8Array;
}

export function i32(size: number): Int32Array {
  return new Int32Array(size) as unknown as Int32Array;
}

export function f64(size: number): Float64Array {
  return new Float64Array(size) as unknown as Float64Array;
}
