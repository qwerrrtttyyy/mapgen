import type { MapData, SerializedMapData } from './map.js';

export function float32ToBase64(arr: Float32Array): string {
  const bytes = new Uint8Array(arr.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Float32Array(bytes.buffer);
}

export function serializeMapData(mapData: MapData): SerializedMapData {
  const textures: SerializedMapData['textures'] = {
    plateTex: float32ToBase64(mapData.plateTex),
    elevTex: float32ToBase64(mapData.elevTex),
    moistTex: float32ToBase64(mapData.moistTex),
    riverTex: float32ToBase64(mapData.riverTex),
    tempTex: float32ToBase64(mapData.tempTex),
  };
  if (mapData.currentTex) textures.currentTex = float32ToBase64(mapData.currentTex);
  if (mapData.iceTex) textures.iceTex = float32ToBase64(mapData.iceTex);
  if (mapData.coastDist) textures.coastDist = float32ToBase64(mapData.coastDist);
  if (mapData.biomeTex) textures.biomeTex = float32ToBase64(mapData.biomeTex);
  if (mapData.watershedTex) textures.watershedTex = float32ToBase64(mapData.watershedTex);
  if (mapData.volcanismTex) textures.volcanismTex = float32ToBase64(mapData.volcanismTex);
  if (mapData.seasonTex) textures.seasonTex = float32ToBase64(mapData.seasonTex);

  return {
    width: mapData.width,
    height: mapData.height,
    seed: mapData.seed,
    plates: mapData.plates,
    regions: mapData.regions,
    rivers: mapData.rivers,
    names: mapData.names,
    textures,
    volcanoSites: mapData.volcanoSites,
    hotspots: mapData.hotspots,
  };
}

export function deserializeMapData(serialized: SerializedMapData): MapData {
  return {
    width: serialized.width,
    height: serialized.height,
    seed: serialized.seed,
    plates: serialized.plates,
    regions: serialized.regions,
    rivers: serialized.rivers,
    names: serialized.names,
    plateTex: base64ToFloat32(serialized.textures.plateTex),
    elevTex: base64ToFloat32(serialized.textures.elevTex),
    moistTex: base64ToFloat32(serialized.textures.moistTex),
    riverTex: base64ToFloat32(serialized.textures.riverTex),
    tempTex: base64ToFloat32(serialized.textures.tempTex),
    currentTex: serialized.textures.currentTex ? base64ToFloat32(serialized.textures.currentTex) : undefined,
    iceTex: serialized.textures.iceTex ? base64ToFloat32(serialized.textures.iceTex) : undefined,
    coastDist: serialized.textures.coastDist ? base64ToFloat32(serialized.textures.coastDist) : undefined,
    biomeTex: serialized.textures.biomeTex ? base64ToFloat32(serialized.textures.biomeTex) : undefined,
    watershedTex: serialized.textures.watershedTex ? base64ToFloat32(serialized.textures.watershedTex) : undefined,
    volcanismTex: serialized.textures.volcanismTex ? base64ToFloat32(serialized.textures.volcanismTex) : undefined,
    seasonTex: serialized.textures.seasonTex ? base64ToFloat32(serialized.textures.seasonTex) : undefined,
    volcanoSites: serialized.volcanoSites,
    hotspots: serialized.hotspots,
  };
}
