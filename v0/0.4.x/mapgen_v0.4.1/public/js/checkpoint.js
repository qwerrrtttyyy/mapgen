const CHECKPOINT_API = '/api/checkpoints';

export class CheckpointManager {
  constructor() {
    this.checkpoints = [];
    this._loaded = false;
  }

  async load() {
    try {
      const res = await fetch(CHECKPOINT_API);
      this.checkpoints = await res.json();
      this._loaded = true;
      return this.checkpoints;
    } catch (e) {
      console.warn('Checkpoint load failed:', e);
      this.checkpoints = [];
      return [];
    }
  }

  async save(name, phase, mapData, params) {
    const ckpt = {
      name,
      phase,
      time: Date.now(),
      seed: params.seedStr || '',
      mapWidth: mapData.width,
      mapHeight: mapData.height,
      data: {
        params,
        elevation: this._packFloat(mapData.elevTex, mapData.width, mapData.height),
        plates: mapData.plates,
        plateId: this._packFloat(null, 0, 0),
        moisture: this._packFloat(mapData.moistTex, mapData.width, mapData.height),
        temperature: this._packFloat(mapData.tempTex, mapData.width, mapData.height),
      },
    };

    if (mapData.checkpoints && mapData.checkpoints[phase]) {
      const cp = mapData.checkpoints[phase];
      if (cp.elevation) ckpt.data.elevation = this._packFloat(cp.elevation, mapData.width, mapData.height);
      if (cp.plateId) ckpt.data.plateId = this._packFloat(cp.plateId, mapData.width, mapData.height);
      if (cp.plates) ckpt.data.plates = cp.plates;
      if (cp.moisture) ckpt.data.moisture = this._packFloat(cp.moisture, mapData.width, mapData.height);
      if (cp.temperature) ckpt.data.temperature = this._packFloat(cp.temperature, mapData.width, mapData.height);
    }

    try {
      const res = await fetch(CHECKPOINT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phase,
          time: ckpt.time,
          seed: ckpt.seed,
          mapWidth: ckpt.mapWidth,
          mapHeight: ckpt.mapHeight,
          data: ckpt.data,
        }),
      });
      const result = await res.json();
      await this.load();
      return result;
    } catch (e) {
      console.warn('Checkpoint save failed:', e);
      return null;
    }
  }

  async restore(id) {
    try {
      const res = await fetch(`${CHECKPOINT_API}/${id}`);
      if (!res.ok) throw new Error('Not found');
      return await res.json();
    } catch (e) {
      console.warn('Checkpoint restore failed:', e);
      return null;
    }
  }

  async delete(id) {
    try {
      await fetch(`${CHECKPOINT_API}/${id}`, { method: 'DELETE' });
      await this.load();
    } catch (e) {
      console.warn('Checkpoint delete failed:', e);
    }
  }

  _packFloat(data, w, h) {
    if (!data || !w || !h) return null;
    const arr = data.length ? data : (data.elevation || data.plateId || data.riverMask);
    if (!arr) return null;
    const len = arr.length;
    const result = new Float32Array(len);
    for (let i = 0; i < len; i++) result[i] = arr[i];
    return {
      width: w,
      height: h,
      data: Array.from(result),
    };
  }
}

function isCheckpointPhase(phase) {
  return ['tectonic', 'elevation', 'erosion', 'climate', 'rivers', 'full'].includes(phase);
}

export function getCheckpointPhases() {
  return [
    { id: 'tectonic', name: '板块构造' },
    { id: 'elevation', name: '高程生成' },
    { id: 'erosion', name: '水力侵蚀' },
    { id: 'climate', name: '气候计算' },
    { id: 'rivers', name: '河流湖泊' },
    { id: 'full', name: '完整地图' },
  ];
}
