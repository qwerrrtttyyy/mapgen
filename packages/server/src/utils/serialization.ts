import { pack, unpack } from 'msgpackr';
import type { SerializedMapData } from '@mapgen/shared-types';

export function encodeMapData(map: SerializedMapData): Buffer {
  return pack(map);
}

export function decodeMapData(buffer: Buffer): SerializedMapData {
  return unpack(buffer) as SerializedMapData;
}
