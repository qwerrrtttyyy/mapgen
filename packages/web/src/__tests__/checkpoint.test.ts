// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';

// Test the float32ToBase64 / base64ToFloat32 round-trip
// We replicate the functions here to test the core logic.

function float32ToBase64(arr: Float32Array): string {
  // Use byteOffset/byteLength to correctly handle sub-array views.
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  const len = bytes.byteLength;
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < len; i += chunkSize) {
    const end = Math.min(i + chunkSize, len);
    binary += String.fromCharCode.apply(null, bytes.subarray(i, end) as unknown as number[]);
  }
  return btoa(binary);
}

function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Float32Array(bytes.buffer);
}

describe('checkpoint serialization', () => {
  describe('float32ToBase64 / base64ToFloat32 round-trip', () => {
    it('round-trips a basic array', () => {
      const original = new Float32Array([1.0, 2.5, -3.7, 0.0, 100.1]);
      const encoded = float32ToBase64(original);
      const decoded = base64ToFloat32(encoded);
      expect(decoded.length).toBe(original.length);
      for (let i = 0; i < original.length; i++) {
        expect(decoded[i]).toBeCloseTo(original[i], 5);
      }
    });

    it('round-trips extreme values', () => {
      const original = new Float32Array([0, 1, -1, Infinity, -Infinity]);
      const encoded = float32ToBase64(original);
      const decoded = base64ToFloat32(encoded);
      expect(decoded[0]).toBe(0);
      expect(decoded[1]).toBe(1);
      expect(decoded[2]).toBe(-1);
      expect(decoded[3]).toBe(Infinity);
      expect(decoded[4]).toBe(-Infinity);
    });

    it('round-trips NaN', () => {
      const original = new Float32Array([NaN]);
      const encoded = float32ToBase64(original);
      const decoded = base64ToFloat32(encoded);
      expect(isNaN(decoded[0])).toBe(true);
    });

    it('round-trips empty array', () => {
      const original = new Float32Array(0);
      const encoded = float32ToBase64(original);
      const decoded = base64ToFloat32(encoded);
      expect(decoded.length).toBe(0);
    });

    it('round-trips large array', () => {
      const size = 1024;
      const original = new Float32Array(size);
      for (let i = 0; i < size; i++) original[i] = Math.sin(i) * 100;
      const encoded = float32ToBase64(original);
      const decoded = base64ToFloat32(encoded);
      expect(decoded.length).toBe(size);
      for (let i = 0; i < size; i++) {
        expect(decoded[i]).toBeCloseTo(original[i], 3);
      }
    });

    it('round-trips a sub-array view (byteOffset)', () => {
      // This is the key bug fix: subarray() creates a view with non-zero byteOffset
      const buffer = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const sub = buffer.subarray(2, 6); // [3, 4, 5, 6]
      expect(sub.byteOffset).toBeGreaterThan(0);

      const encoded = float32ToBase64(sub);
      const decoded = base64ToFloat32(encoded);
      expect(decoded.length).toBe(4);
      expect(decoded[0]).toBeCloseTo(3, 5);
      expect(decoded[1]).toBeCloseTo(4, 5);
      expect(decoded[2]).toBeCloseTo(5, 5);
      expect(decoded[3]).toBeCloseTo(6, 5);
    });
  });
});
