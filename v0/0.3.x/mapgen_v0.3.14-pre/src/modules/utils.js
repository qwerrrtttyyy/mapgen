/**
 * 工具函数模块
 * Material Map Generator v0.3.12-preview
 */

const DEG2RAD = Math.PI / 180;

export const createDeferred = () => {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
};

export const deepClone = (obj) => {
    if (obj === null || obj === undefined) return obj;
    try { return typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj)); }
    catch { try { return JSON.parse(JSON.stringify(obj)); } catch { return Object.assign({}, obj); } }
};

export const createAbortError = () => { const e = new Error('Aborted'); e.name = 'AbortError'; return e; };

export const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

export const escapeHTML = str => String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[m]));

export const debounce = (fn, delay = 50) => { 
    let timer = null; 
    return function (...args) { 
        clearTimeout(timer); 
        timer = setTimeout(() => fn.apply(this, args), delay); 
    }; 
};

export const throttle = (fn, limit) => { 
    let inThrottle; 
    return function (...args) { 
        if (!inThrottle) { 
            fn.apply(this, args); 
            inThrottle = true; 
            setTimeout(() => inThrottle = false, limit); 
        } 
    }; 
};

/**
 * rAF 合并——同一帧内多次调用只提交一次
 */
export const rafThrottle = (fn) => {
    let scheduled = false, lastArgs = null;
    return function (...args) {
        lastArgs = args;
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => { scheduled = false; fn.apply(this, lastArgs); });
    };
};

/**
 * 异步重试——IndexedDB 偶发故障自愈
 */
export const withRetry = async (fn, retries = 3, baseDelay = 50) => {
    let lastErr;
    for (let i = 0; i < retries; i++) {
        try { return await fn(); }
        catch (e) {
            lastErr = e;
            if (i < retries - 1) await new Promise(r => setTimeout(r, baseDelay * (1 << i)));
        }
    }
    throw lastErr;
};

/**
 * 值域钳制——滑块/加载值的统一收敛
 */
export const clamp = (v, lo, hi) => v !== v ? lo : v < lo ? lo : v > hi ? hi : v;

export const safeNum = (v, fallback = 0) => (typeof v === 'number' && isFinite(v)) ? v : fallback;

/**
 * 安全 localStorage 包装——隐私模式下不崩溃
 */
export const safeStorage = {
    get: (k, def = null) => { try { const v = localStorage.getItem(k); return v !== null ? v : def; } catch { return def; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* 隐私模式静默 */ } }
};

/**
 * 加载存档白名单——未知键不会污染 store
 */
const STATE_FIELD_WHITELIST = new Set([
    'seedStr', 'mapSize', 'plateCount', 'landmass', 'noiseType', 'fbmType',
    'octaves', 'lacunarity', 'persistence', 'seaLevel',
    'showBoundaries', 'boundaryWidth', 'boundaryColor',
    'pointLightEnabled', 'pointLightPos', 'pointLightIntensity', 'pointLightColor', 'glowEnabled',
    'style', 'showNames', 'laserActive', 'trailEnabled', 'laserSmooth', 'cursorActive',
    'lightAngle', 'fbmOctaves', 'fbmLacunarity', 'fbmPersistence',
    'erosionStrength', 'erosionIterations', 'mountainFold', 'tempOffset', 'snowLine', 'showRivers', 'contourInterval', 'showContours',
    'showTerrain', 'showSelection',
    'mapAspect', 'worldScale', 'coastDetail', 'lakeDensity', 'showClimate', 'geoLabels', 'showGrid',
    'detailRiverWidth', 'detailRiverCurve', 'detailCoastJagged', 'detailRidgeDensity', 'detailRainfallOffset', 'detailTempGradient', 'detailBiomeBlend',
    'showElevScale', 'showRegionNames', 'customPlateNames', 'customRegionNames'
]);

export const sanitizeState = (st) => {
    if (!st || typeof st !== 'object') return null;
    const out = {};
    for (const k of STATE_FIELD_WHITELIST) {
        if (!(k in st)) continue;
        const v = st[k];
        if (typeof v === 'number') out[k] = safeNum(v);
        else if (typeof v === 'string') out[k] = v.slice(0, 64).replace(/[\u0000-\u001f\u007f]/g, '');
        else if (Array.isArray(v) && v.length === 3 && v.every(x => typeof x === 'number')) {
            out[k] = v.map(safeNum);
        } else if (Array.isArray(v) && v.length === 2 && v.every(x => typeof x === 'number')) {
            out[k] = v.map(safeNum);
        } else if (typeof v === 'boolean') out[k] = v;
        else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
            try { out[k] = JSON.parse(JSON.stringify(v)); } catch { out[k] = {}; }
        }
    }
    return out;
};

/**
 * 通用安全 GL 包装——吃掉 context-lost 期间的操作
 */
export const safeGL = (gl) => (op, ...args) => {
    if (!gl || gl.isContextLost()) return null;
    try { return op.apply(gl, args); }
    catch (e) { console.warn('GL op failed:', e); return null; }
};

/**
 * 惰性加载器
 */
export const LazyLoader = (() => {
    const _cache = new Map();
    const _pending = new Map();
    const load = (id, factory) => {
        if (_cache.has(id)) return _cache.get(id);
        if (_pending.has(id)) return _pending.get(id);
        const promise = Promise.resolve().then(() => {
            const result = typeof factory === 'function' ? factory() : factory;
            _cache.set(id, result);
            _pending.delete(id);
            return result;
        });
        _pending.set(id, promise);
        return promise;
    };
    const get = id => _cache.get(id);
    const has = id => _cache.has(id);
    return { load, get, has };
})();

/**
 * 预加载器
 */
export const Preloader = (() => {
    const _queue = [];
    const _loaded = new Set();
    const enqueue = (id, factory, priority = 0) => {
        _queue.push({ id, factory, priority });
        _queue.sort((a, b) => b.priority - a.priority);
    };
    const runIdle = () => {
        if (!('requestIdleCallback' in window)) { _flush(); return; }
        requestIdleCallback(deadline => {
            while (_queue.length && deadline.timeRemaining() > 2) {
                const { id, factory } = _queue.shift();
                if (!_loaded.has(id)) { LazyLoader.load(id, factory); _loaded.add(id); }
            }
            if (_queue.length) runIdle();
        }, { timeout: 2000 });
    };
    const _flush = () => { while (_queue.length) { const { id, factory } = _queue.shift(); if (!_loaded.has(id)) { LazyLoader.load(id, factory); _loaded.add(id); } } };
    return { enqueue, runIdle };
})();
