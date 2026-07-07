export interface MapRecord {
  id: string;
  name: string | null;
  seed: string;
  params: string;
  mapData: Buffer;
  width: number;
  height: number;
  createdAt: number;
  updatedAt: number;
  tags: string;
}

export interface PresetRecord {
  id: string;
  name: string;
  params: string;
  builtin: number;
  createdAt: number;
}

export interface InMemoryDatabase {
  maps: Map<string, MapRecord>;
  presets: Map<string, PresetRecord>;
}

export function createDatabase(): InMemoryDatabase {
  return {
    maps: new Map(),
    presets: new Map(),
  };
}
