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

export class FrontendStore {
  constructor() {
    this._memory = { checkpoints: {} };
    this._db = null;
    this._ready = this._init();
  }

  async _init() {
    try {
      if (typeof indexedDB === 'undefined') throw new Error('No IndexedDB');
      this._db = await new Promise((resolve, reject) => {
        const req = indexedDB.open('mapgen-cache', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('checkpoints')) {
            db.createObjectStore('checkpoints', { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('FrontendStore: IndexedDB unavailable, using memory fallback');
    }
  }

  _tx(mode) {
    if (!this._db) return null;
    const tx = this._db.transaction('checkpoints', mode);
    return tx.objectStore('checkpoints');
  }

  async _withStore(fn) {
    await this._ready;
    const store = this._tx('readwrite');
    if (!store) return fn(this._memory.checkpoints);
    return new Promise((resolve, reject) => {
      const req = fn(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async saveLocal(id, params, mapData) {
    const entry = {
      id,
      params,
      mapData,
      version: 1,
      synced: false,
      lastModified: Date.now(),
    };
    const store = this._tx('readwrite');
    if (!store) {
      this._memory.checkpoints[id] = entry;
      return entry;
    }
    return new Promise((resolve, reject) => {
      const req = store.put(entry);
      req.onsuccess = () => resolve(entry);
      req.onerror = () => reject(req.error);
    });
  }

  async loadLocal() {
    const results = await this._withStore(store => {
      return store.getAll ? store.getAll() : Object.values(store).map(k => store[k]);
    });
    return results || [];
  }

  async getLocal(id) {
    const result = await this._withStore(store => {
      return store.get ? store.get(id) : store[id] || null;
    });
    return result || null;
  }

  async deleteLocal(id) {
    await this._withStore(store => {
      if (store.delete) return store.delete(id);
      delete store[id];
    });
  }

  async syncToServer(id) {
    const entry = await this.getLocal(id);
    if (!entry) throw new Error('Not found locally');

    try {
      const res = await fetch('/api/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry.mapData),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      entry.synced = true;
      entry.lastSynced = Date.now();
      await this.saveLocal(id, entry.params, entry.mapData);
      return entry;
    } catch (e) {
      entry.syncError = e.message;
      await this.saveLocal(id, entry.params, entry.mapData);
      throw e;
    }
  }

  async syncFromServer() {
    const res = await fetch('/api/checkpoints');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const serverList = await res.json();

    const store = this._tx('readwrite');
    if (!store) {
      for (const ckpt of serverList) {
        this._memory.checkpoints[ckpt.id] = {
          ...this._memory.checkpoints[ckpt.id],
          serverMeta: ckpt,
          synced: true,
          lastSynced: Date.now(),
        };
      }
      return serverList;
    }

    await new Promise((resolve, reject) => {
      const tx = this._db.transaction('checkpoints', 'readwrite');
      const s = tx.objectStore('checkpoints');
      for (const ckpt of serverList) {
        const existing = this._memory.checkpoints[ckpt.id];
        s.put({
          id: ckpt.id,
          params: existing?.params || {},
          mapData: existing?.mapData || null,
          version: 1,
          synced: true,
          lastSynced: Date.now(),
          serverMeta: ckpt,
        });
      }
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });

    return serverList;
  }
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
