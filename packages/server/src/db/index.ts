export interface InMemoryDatabase {
  maps: Map<string, {
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
  }>;
  presets: Map<string, {
    id: string;
    name: string;
    params: string;
    builtin: number;
    createdAt: number;
  }>;
}

export function createDatabase(): InMemoryDatabase {
  return {
    maps: new Map(),
    presets: new Map(),
  };
}
