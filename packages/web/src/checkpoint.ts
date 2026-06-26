export interface CheckpointData {
  name: string;
  phase: string;
  time: number;
  seed: string;
  mapWidth: number;
  mapHeight: number;
  data: {
    params: Record<string, unknown>;
    elevation?: { width: number; height: number; data: number[] } | null;
    plates?: unknown[];
    plateId?: { width: number; height: number; data: number[] } | null;
    moisture?: { width: number; height: number; data: number[] } | null;
    temperature?: { width: number; height: number; data: number[] } | null;
  };
}

export class CheckpointManager {
  checkpoints: CheckpointData[] = [];
  private _loaded = false;

  async load(): Promise<CheckpointData[]> {
    try {
      // 本地存储实现（无服务端）
      const stored = localStorage.getItem('mapgen-checkpoints');
      if (stored) {
        this.checkpoints = JSON.parse(stored);
      }
      this._loaded = true;
      return this.checkpoints;
    } catch (e) {
      console.warn('Checkpoint load failed:', e);
      this.checkpoints = [];
      return [];
    }
  }

  async save(
    name: string,
    phase: string,
    mapData: { width: number; height: number; elevTex: Float32Array; moistTex: Float32Array; tempTex: Float32Array; plates: unknown[] },
    params: Record<string, unknown>
  ): Promise<CheckpointData | null> {
    const ckpt: CheckpointData = {
      name,
      phase,
      time: Date.now(),
      seed: (params.seedStr as string) || '',
      mapWidth: mapData.width,
      mapHeight: mapData.height,
      data: {
        params,
        elevation: this._packFloat(mapData.elevTex, mapData.width, mapData.height),
        plates: mapData.plates as unknown[],
        plateId: this._packFloat(null, 0, 0),
        moisture: this._packFloat(mapData.moistTex, mapData.width, mapData.height),
        temperature: this._packFloat(mapData.tempTex, mapData.width, mapData.height),
      },
    };

    try {
      this.checkpoints.push(ckpt);
      localStorage.setItem('mapgen-checkpoints', JSON.stringify(this.checkpoints));
      return ckpt;
    } catch (e) {
      console.warn('Checkpoint save failed:', e);
      return null;
    }
  }

  async restore(id: number): Promise<CheckpointData | null> {
    try {
      return this.checkpoints[id] || null;
    } catch (e) {
      console.warn('Checkpoint restore failed:', e);
      return null;
    }
  }

  async delete(id: number): Promise<void> {
    try {
      this.checkpoints.splice(id, 1);
      localStorage.setItem('mapgen-checkpoints', JSON.stringify(this.checkpoints));
    } catch (e) {
      console.warn('Checkpoint delete failed:', e);
    }
  }

  private _packFloat(
    data: Float32Array | null,
    w: number,
    h: number
  ): { width: number; height: number; data: number[] } | null {
    if (!data || !w || !h) return null;
    const len = data.length;
    const result = new Float32Array(len);
    for (let i = 0; i < len; i++) result[i] = data[i];
    return {
      width: w,
      height: h,
      data: Array.from(result),
    };
  }
}
