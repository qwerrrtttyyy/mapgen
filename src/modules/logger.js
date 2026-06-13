/**
 * 日志、错误处理与通知模块
 * Material Map Generator v0.3.12-preview
 */

import { deepClone, withRetry } from './utils.js';

export function createLogger() {
    const logs = [];
    const push = (level, msg, data) => {
        logs.push({ level, msg, data, time: new Date().toISOString() });
        if (logs.length > 500) logs.shift();
        console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`[${level}] ${msg}`, data ?? '');
    };
    return { 
        info: (m, d) => push('info', m, d), 
        warn: (m, d) => push('warn', m, d), 
        error: (m, d) => push('error', m, d), 
        getLogs: () => deepClone(logs), 
        export: () => { 
            const b = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' }); 
            const u = URL.createObjectURL(b); 
            const a = document.createElement('a'); 
            a.href = u; 
            a.download = `logs_${Date.now()}.json`; 
            a.click(); 
            URL.revokeObjectURL(u); 
        } 
    };
}

export function initErrorHandler(logger, showToast) {
    window.addEventListener('error', (e) => { 
        logger.error('Uncaught', { msg: e.message, stack: e.error?.stack }); 
        showToast('系统未知错误', true); 
    });
    window.addEventListener('unhandledrejection', (e) => { 
        logger.error('Rejection', { reason: String(e.reason) }); 
        showToast('异步操作失败', true); 
    });
}

export function showToast(msg, isError = false) {
    const c = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = isError ? 'toast error' : 'toast'; 
    el.textContent = msg; 
    el.setAttribute('role', 'alert');
    c.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { 
        el.classList.remove('show'); 
        setTimeout(() => el.remove(), 500); 
    }, 3000);
}

/**
 * 本地存储管理器
 */
export function createStorageManager(logger) {
    let db = null;
    const DB = 'MapGenDB_v2', STORE = 'maps';
    
    const init = () => withRetry(() => new Promise((resolve, reject) => {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = e => { 
            if (!e.target.result.objectStoreNames.contains(STORE)) 
                e.target.result.createObjectStore(STORE, { keyPath: 'id' }); 
        };
        r.onsuccess = e => { 
            db = e.target.result; 
            logger.info('DB Ready'); 
            resolve(); 
        };
        r.onerror = e => reject(e.target.error);
    }), 3, 80);
    
    const tx = m => db.transaction(STORE, m).objectStore(STORE);
    
    const wrap = (op, label) => withRetry(() => new Promise((resolve, reject) => {
        if (!db) return reject(new Error('DB not initialized'));
        const r = op();
        r.onsuccess = () => resolve(r.result);
        r.onerror = e => reject(e.target.error);
    }), 3, 60).catch(e => { 
        logger.warn(`Storage ${label} failed after retries`, e); 
        throw e; 
    });
    
    return {
        init,
        save: (id, state) => wrap(() => tx('readwrite').put({ id, state, ts: Date.now() }), 'save'),
        load: (id) => wrap(() => tx('readonly').get(id), 'load').then(r => r?.state),
        list: () => wrap(() => tx('readonly').getAll(), 'list').then(r => (r || []).sort((a, b) => b.ts - a.ts)),
        delete: (id) => wrap(() => tx('readwrite').delete(id), 'delete')
    };
}

/**
 * 性能监控器
 */
export function createPerfMonitor() {
    let enabled = false, frames = 0, lastTime = performance.now();
    const el = document.getElementById('perf-card');
    const fpsEl = document.getElementById('info-fps');
    const m = { gen: 0, render: 0, fps: 0 };
    
    return { 
        setEnabled: v => { 
            enabled = v; 
            if (el) { 
                el.classList.toggle('visible', v); 
                if (!v) el.textContent = ''; 
            } 
        }, 
        recordGen: ms => m.gen = ms, 
        recordRender: ms => m.render = ms, 
        tick: () => { 
            frames++; 
            const now = performance.now(); 
            if (now - lastTime >= 1000) { 
                m.fps = frames; 
                frames = 0; 
                lastTime = now; 
                if (fpsEl) fpsEl.textContent = `${m.fps} FPS`; 
                if (enabled && el) { 
                    const mem = performance.memory ? `${(performance.memory.usedJSHeapSize / 1048576).toFixed(1)}MB` : 'N/A'; 
                    el.innerHTML = `FPS: ${m.fps}<br>Render: ${m.render.toFixed(2)}ms<br>Gen: ${m.gen.toFixed(0)}ms<br>Mem: ${mem}`; 
                } 
            } 
        } 
    };
}
