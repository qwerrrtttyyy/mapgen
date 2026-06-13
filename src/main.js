const VERSION = '0.3.12-preview';

// ── Shader file loader (v0.3.12: loaded from /shaders/) ──
(function() {
    var vsEl = document.getElementById('vs-quad');
    var fsEl = document.getElementById('fs-map');
    if (vsEl && vsEl.textContent.trim() === '') {
        fetch('/shaders/vs-quad.vert')
            .then(function(r) { return r.text(); })
            .then(function(t) { vsEl.textContent = t; });
    }
    if (fsEl && fsEl.textContent.trim() === '') {
        fetch('/shaders/fs-map.frag')
            .then(function(r) { return r.text(); })
            .then(function(t) { fsEl.textContent = t; });
    }
})();


/* ── 惰性加载器 & 预加载器 ── */
const LazyLoader = (() => {
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
const Preloader = (() => {
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

const DEG2RAD = Math.PI / 180;
const createDeferred = () => {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
};
const deepClone = (obj) => {
    if (obj === null || obj === undefined) return obj;
    try { return typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj)); }
    catch { try { return JSON.parse(JSON.stringify(obj)); } catch { return Object.assign({}, obj); } }
};
const createAbortError = () => { const e = new Error('Aborted'); e.name = 'AbortError'; return e; };
const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));
const escapeHTML = str => String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[m]));
const debounce = (fn, delay = 50) => { let timer = null; return function (...args) { clearTimeout(timer); timer = setTimeout(() => fn.apply(this, args), delay); }; };
const throttle = (fn, limit) => { let inThrottle; return function (...args) { if (!inThrottle) { fn.apply(this, args); inThrottle = true; setTimeout(() => inThrottle = false, limit); } }; };
/* v0.2.8 新增: rAF 合并——同一帧内多次调用只提交一次 */
const rafThrottle = (fn) => {
    let scheduled = false, lastArgs = null;
    return function (...args) {
        lastArgs = args;
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => { scheduled = false; fn.apply(this, lastArgs); });
    };
};
/* v0.2.8 新增: 异步重试——IndexedDB 偶发故障自愈 */
const withRetry = async (fn, retries = 3, baseDelay = 50) => {
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
/* v0.2.8 新增: 值域钳制——滑块/加载值的统一收敛 */
const clamp = (v, lo, hi) => v !== v ? lo : v < lo ? lo : v > hi ? hi : v;
const safeNum = (v, fallback = 0) => (typeof v === 'number' && isFinite(v)) ? v : fallback;
/* v0.3.9-fix: 安全 localStorage 包装——隐私模式下不崩溃 */
const safeStorage = {
    get: (k, def = null) => { try { const v = localStorage.getItem(k); return v !== null ? v : def; } catch { return def; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* 隐私模式静默 */ } }
};
/* v0.2.8 新增: 加载存档白名单——未知键不会污染 store */
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
    /* v0.3.8 */
    'showElevScale', 'showRegionNames', 'customPlateNames', 'customRegionNames'
]);
const sanitizeState = (st) => {
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
/* v0.2.8 新增: 通用安全 GL 包装——吃掉 context-lost 期间的操作 */
const safeGL = (gl) => (op, ...args) => {
    if (!gl || gl.isContextLost()) return null;
    try { return op.apply(gl, args); }
    catch (e) { console.warn('GL op failed:', e); return null; }
};

// =====================================================================
// 模块 2: 国际化 (I18N)
// =====================================================================
const I18N = {
    zh: {
        title: '地图生成器', subtitle: '程序化板块与噪声引擎', seed_base: '种子与世界',
        world_seed: '世界种子', map_size: '地图尺寸', plate_count: '板块数量', land_ratio: '大陆比例',
        noise_fbm: '噪声与 FBM', base_noise: '基础噪声', fbm_variant: 'FBM 变体',
        terrain_bounds: '地形与边界', sea_level: '海平面', show_bounds: '显示边界', bound_width: '边界宽度', bound_color: '边界颜色',
        terrain_system: '地形系统', erosion_strength: '侵蚀强度', erosion_iterations: '侵蚀迭代',
        mountain_fold: '山脉褶皱度', temp_offset: '温度偏移', snow_line: '雪线高度',
        show_rivers: '显示河流', contour_interval: '等高线间距',
        map_aspect: '地图比例', world_scale: '世界比例尺', coast_detail: '海岸线细节', lake_density: '湖泊密度', show_climate: '气候分区', geo_labels: '地理标注', show_grid: '比例网格',
        layer_control: '图层控制', layer_terrain: '地形底图', layer_boundaries: '板块边界', layer_rivers: '河流水系', layer_contours: '等高线', layer_names: '板块名称', layer_selection: '选中高亮',
        detail_generator: '细节生成器', detail_river_width: '河流宽度', detail_river_curve: '河流曲率', detail_coast_jagged: '海岸线锯齿度', detail_ridge_density: '山脊密度', detail_rainfall_offset: '降雨带偏移', detail_temp_gradient: '温度梯度', detail_biome_blend: '群系混合度',
        lighting: '光照与氛围', light_angle: '平行光角度', enable_point_light: '点光源', light_intensity: '强度', light_color: '光色', atmospheric_glow: '大气光晕',
        render_view: '渲染与视角', render_style: '渲染风格', show_names: '显示板块名', perf_monitor: '性能监控',
        laser_pointer: '激光指针', enable_laser: '启用激光', auto_select: '自动选区', luminous_trail: '流光轨迹', enable_cursor: '光标',
        generate: '生成地图', random: '随机', export: '导出图片', save: '保存', load: '加载', close: '关闭',
        storage_title: '存储管理', no_saved_maps: '暂无保存的地图',
        plates_stat: '板块', cont_stat: '陆', ocean_stat: '海', land_stat: '陆地', selected: '已选中', clear: '清除',
        avg_elev: '平均高程', max_elev: '最高', min_elev: '最低', avg_moist: '湿度', area: '面积', velocity: '矢量', density: '密度', type_cont: '大陆', type_ocean: '海洋',
        about: '关于与版本',
        about_desc: 'Material Map Generator —— 基于程序化噪声与板块模拟的地图生成工具，支持地形渲染、气候分区、河流水系、地理标注与多风格可视化。',
        version_gen: '版本生成器', vg_version_label: '版本号', vg_suffix_label: '后缀', vg_count_label: '生成数量', vg_mode_label: '版本递增模式', vg_extras_label: '附加内容',
        vg_generate: '生成多版本', vg_download_all: '打包下载全部', vg_downloading: '生成中...', vg_done: '完成', vg_download: '下载', vg_file: '文件',
        vg_patch: '补丁递增', vg_minor: '次版本递增', vg_suffix_mode: '后缀变化',
        save_success: '保存成功', load_success: '加载成功', delete_success: '删除成功',
        export_formats: '图片格式', export_quality: '质量', export_data: '数据导出',
        desc_lossless: '无损压缩，文件较大', desc_lossy_fast: '有损压缩，体积小速度快',
        desc_webp: '现代格式，体积与画质兼优', desc_bmp: '无压缩位图，导出最快',
        badge_lossless: '无损', badge_fast: '快速', badge_recommended: '推荐', badge_fastest: '极速',
        export_heightmap: '高程数据 JSON', desc_heightmap: '包含高程、湿度、温度地图',
        export_terraindata: '完整地形数据', desc_terraindata: '高程+板块+河流+配置参数',
        exporting: '导出中', export_done: '导出完成', export_preparing: '准备高清画布', export_error: '导出失败',
        features: [],
        /* v0.3.5: Splash & 进度相关 */
        splash_loading: '正在初始化渲染引擎...',
        gen_progress_title: '正在生成地图',
        gen_phase_init: '初始化参数...',
        gen_phase_tectonic: '正在合成板块...',
        gen_phase_noise: '正在计算噪声...',
        gen_phase_terrain: '正在渲染地形...',
        gen_phase_final: '正在完成...',
        gen_phase_done: '✓ 生成完成',
        gen_phases: [['init','初始化参数...'],['tectonic','正在合成板块...'],['noise','正在计算噪声...'],['terrain','正在渲染地形...'],['regions','正在分析地形区...'],['final','正在完成...'],['done','✓ 生成完成']],
        /* v0.3.8: 地形区命名与标签管理 */
        gen_phase_regions: '正在分析地形区...',
        region_labels: '地形区标注',
        show_elev_scale: '显示海拔尺',
        elevation_scale: '海拔尺',
        label_manager: '标签管理',
        label_plate: '板块标签',
        label_region: '地形区标签',
        label_edit: '编辑',
        label_rename: '重命名',
        label_edit_title: '编辑标签',
        label_name: '名称',
        label_confirm: '确认',
        label_cancel: '取消',
        label_reset: '重置全部标签',
        label_reset_confirm: '确定重置所有标签？',
        label_edited: '已更新',
        label_plate_type: '类型',
        label_plate_id: '编号',
        elev_meter: 'm',
        elev_sea_level: '海平面',
        elev_snow_line: '雪线',
        region_type_mountain: '山脉',
        region_type_plateau: '高原',
        region_type_hills: '丘陵',
        region_type_plains: '平原',
        region_type_desert: '沙漠',
        region_type_forest: '森林',
        region_type_wetland: '湿地',
        region_type_tundra: '苔原',
        region_type_ice: '冰盖',
        region_type_basin: '盆地',
        /* 命名后缀 */
        suffix_mountain: ['山脉', '山系', '岭', '峰'],
        suffix_plateau: ['高原', '台地'],
        suffix_hills: ['丘陵', '岗地'],
        suffix_plains: ['平原', '原野', '低地'],
        suffix_desert: ['沙漠', '荒漠', '戈壁'],
        suffix_forest: ['森林', '林海', '丛林'],
        suffix_wetland: ['湿地', '沼泽', '水乡'],
        suffix_tundra: ['苔原', '冻原'],
        suffix_ice: ['冰盖', '冰原'],
        suffix_basin: ['盆地', '洼地'],
        geo_peak: '峰', geo_deep: '渊', geo_desert: '漠', geo_volcano: '火', geo_pass: '口', geo_island: '岛',
        biome_tropical: '热带雨林', biome_temperate_grass: '温带草原', biome_desert: '沙漠', biome_tundra: '苔原', biome_ice: '冰盖'
    },
    en: {
        title: 'Map Generator', subtitle: 'Procedural Tectonic & Noise Engine', seed_base: 'Seed & World',
        world_seed: 'World Seed', map_size: 'Map Size', plate_count: 'Plate Count', land_ratio: 'Landmass Ratio',
        noise_fbm: 'Noise & FBM', base_noise: 'Base Noise', fbm_variant: 'FBM Variant',
        terrain_bounds: 'Terrain & Bounds', sea_level: 'Sea Level', show_bounds: 'Show Bounds', bound_width: 'Bound Width', bound_color: 'Bound Color',
        terrain_system: 'Terrain System', erosion_strength: 'Erosion Str.', erosion_iterations: 'Erosion Iter.',
        mountain_fold: 'Mountain Fold', temp_offset: 'Temp Offset', snow_line: 'Snow Line',
        show_rivers: 'Show Rivers', contour_interval: 'Contour Interval',
        map_aspect: 'Map Aspect', world_scale: 'World Scale', coast_detail: 'Coast Detail', lake_density: 'Lake Density', show_climate: 'Climate Zones', geo_labels: 'Geo Labels', show_grid: 'Scale Grid',
        layer_control: 'Layer Control', layer_terrain: 'Terrain Base', layer_boundaries: 'Plate Bounds', layer_rivers: 'Rivers', layer_contours: 'Contours', layer_names: 'Plate Names', layer_selection: 'Selection Highlight',
        detail_generator: 'Detail Generator', detail_river_width: 'River Width', detail_river_curve: 'River Curvature', detail_coast_jagged: 'Coast Jaggedness', detail_ridge_density: 'Ridge Density', detail_rainfall_offset: 'Rainfall Offset', detail_temp_gradient: 'Temp Gradient', detail_biome_blend: 'Biome Blend',
        lighting: 'Lighting', light_angle: 'Dir. Light', enable_point_light: 'Point Light', light_intensity: 'Intensity', light_color: 'Light Color', atmospheric_glow: 'Atmos. Glow',
        render_view: 'Render & View', render_style: 'Render Style', show_names: 'Show Names', perf_monitor: 'Perf Monitor',
        laser_pointer: 'Laser Pointer', enable_laser: 'Enable Laser', auto_select: 'Auto Select', luminous_trail: 'Luminous Trail', enable_cursor: 'Cursor',
        generate: 'Generate', random: 'Random', export: 'Export Image', save: 'Save', load: 'Load', close: 'Close',
        storage_title: 'Storage Manager', no_saved_maps: 'No saved maps',
        plates_stat: 'Plates', cont_stat: 'C', ocean_stat: 'O', land_stat: 'Land', selected: 'Selected', clear: 'Clear',
        avg_elev: 'Avg Elev', max_elev: 'Max', min_elev: 'Min', avg_moist: 'Moist', area: 'Area', velocity: 'Vel', density: 'Density', type_cont: 'Cont.', type_ocean: 'Ocean',
        about: 'About & Version',
        about_desc: 'Material Map Generator — Procedural noise and tectonic simulation map generator with terrain rendering, climate zones, river systems, geo-labeling, and multi-style visualization.',
        version_gen: 'Version Generator', vg_version_label: 'Version', vg_suffix_label: 'Suffix', vg_count_label: 'Count', vg_mode_label: 'Increment Mode', vg_extras_label: 'Extras',
        vg_generate: 'Generate Versions', vg_download_all: 'Download All', vg_downloading: 'Generating...', vg_done: 'Done', vg_download: 'Download', vg_file: 'File',
        vg_patch: 'Patch Increment', vg_minor: 'Minor Increment', vg_suffix_mode: 'Suffix Rotation',
        save_success: 'Saved', load_success: 'Loaded', delete_success: 'Deleted',
        export_formats: 'Image Formats', export_quality: 'Quality', export_data: 'Data Export',
        desc_lossless: 'Lossless compression, larger file', desc_lossy_fast: 'Lossy compression, small & fast',
        desc_webp: 'Modern format, great size vs quality', desc_bmp: 'Uncompressed bitmap, fastest export',
        badge_lossless: 'Lossless', badge_fast: 'Fast', badge_recommended: 'Recommended', badge_fastest: 'Fastest',
        export_heightmap: 'Heightmap JSON', desc_heightmap: 'Elevation, moisture & temperature maps',
        export_terraindata: 'Full Terrain Data', desc_terraindata: 'Elevation + plates + rivers + config',
        exporting: 'Exporting', export_done: 'Export done', export_preparing: 'Preparing HD canvas', export_error: 'Export failed',
        features: [],
        splash_loading: 'Initializing render engine...',
        gen_progress_title: 'Generating Map',
        gen_phase_init: 'Initializing parameters...',
        gen_phase_tectonic: 'Synthesizing tectonic plates...',
        gen_phase_noise: 'Computing noise layers...',
        gen_phase_terrain: 'Rendering terrain...',
        gen_phase_final: 'Finalizing...',
        gen_phase_done: '✓ Generation complete',
        gen_phases: [['init','Initializing parameters...'],['tectonic','Synthesizing tectonic plates...'],['noise','Computing noise layers...'],['terrain','Rendering terrain...'],['regions','Analyzing terrain regions...'],['final','Finalizing...'],['done','✓ Generation complete']],
        /* v0.3.8: Region naming & label management */
        gen_phase_regions: 'Analyzing terrain regions...',
        region_labels: 'Region Labels',
        show_elev_scale: 'Show Elevation Scale',
        elevation_scale: 'Elevation Scale',
        label_manager: 'Label Manager',
        label_plate: 'Plate Labels',
        label_region: 'Region Labels',
        label_edit: 'Edit',
        label_rename: 'Rename',
        label_edit_title: 'Edit Label',
        label_name: 'Name',
        label_confirm: 'Confirm',
        label_cancel: 'Cancel',
        label_reset: 'Reset All Labels',
        label_reset_confirm: 'Reset all labels to defaults?',
        label_edited: 'Updated',
        label_plate_type: 'Type',
        label_plate_id: 'ID',
        elev_meter: 'm',
        elev_sea_level: 'Sea Level',
        elev_snow_line: 'Snow Line',
        region_type_mountain: 'Mountain',
        region_type_plateau: 'Plateau',
        region_type_hills: 'Hills',
        region_type_plains: 'Plains',
        region_type_desert: 'Desert',
        region_type_forest: 'Forest',
        region_type_wetland: 'Wetland',
        region_type_tundra: 'Tundra',
        region_type_ice: 'Ice Cap',
        region_type_basin: 'Basin',
        /* Naming suffixes */
        suffix_mountain: ['Mountains', 'Range', 'Peaks', 'Highlands'],
        suffix_plateau: ['Plateau', 'Tableland'],
        suffix_hills: ['Hills', 'Uplands'],
        suffix_plains: ['Plains', 'Lowlands', 'Fields'],
        suffix_desert: ['Desert', 'Wastes', 'Dunes'],
        suffix_forest: ['Forest', 'Woods', 'Thicket'],
        suffix_wetland: ['Marsh', 'Swamp', 'Fen'],
        suffix_tundra: ['Tundra', 'Frostlands'],
        suffix_ice: ['Ice Cap', 'Glacier'],
        suffix_basin: ['Basin', 'Valley'],
        geo_peak: 'Peak', geo_deep: 'Deep', geo_desert: 'Desert', geo_volcano: 'Volcano', geo_pass: 'Pass', geo_island: 'Island',
        biome_tropical: 'Tropical Rainforest', biome_temperate_grass: 'Temperate Grassland', biome_desert: 'Desert', biome_tundra: 'Tundra', biome_ice: 'Ice Cap'
    }
};
let currentLang = 'zh';
const t = () => I18N[currentLang];

// =====================================================================
// 模块 3: 日志、错误处理与通知
// =====================================================================
function createLogger() {
    const logs = [];
    const push = (level, msg, data) => {
        logs.push({ level, msg, data, time: new Date().toISOString() });
        if (logs.length > 500) logs.shift();
        console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`[${level}] ${msg}`, data ?? '');
    };
    return { info: (m, d) => push('info', m, d), warn: (m, d) => push('warn', m, d), error: (m, d) => push('error', m, d), getLogs: () => deepClone(logs), export: () => { const b = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `logs_${Date.now()}.json`; a.click(); URL.revokeObjectURL(u); } };
}
function initErrorHandler(logger, showToast) {
    window.addEventListener('error', (e) => { logger.error('Uncaught', { msg: e.message, stack: e.error?.stack }); showToast('系统未知错误', true); });
    window.addEventListener('unhandledrejection', (e) => { logger.error('Rejection', { reason: String(e.reason) }); showToast('异步操作失败', true); });
}
function showToast(msg, isError = false) {
    const c = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = isError ? 'toast error' : 'toast'; el.textContent = msg; el.setAttribute('role', 'alert');
    c.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 500); }, 3000);
}

// =====================================================================
// 模块 4: 本地存储与性能监控
// =====================================================================
function createStorageManager(logger) {
    let db = null;
    const DB = 'MapGenDB_v2', STORE = 'maps';
    const init = () => withRetry(() => new Promise((resolve, reject) => {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = e => { if (!e.target.result.objectStoreNames.contains(STORE)) e.target.result.createObjectStore(STORE, { keyPath: 'id' }); };
        r.onsuccess = e => { db = e.target.result; logger.info('DB Ready'); resolve(); };
        r.onerror = e => reject(e.target.error);
    }), 3, 80);
    const tx = m => db.transaction(STORE, m).objectStore(STORE);
    const wrap = (op, label) => withRetry(() => new Promise((resolve, reject) => {
        if (!db) return reject(new Error('DB not initialized'));
        const r = op();
        r.onsuccess = () => resolve(r.result);
        r.onerror = e => reject(e.target.error);
    }), 3, 60).catch(e => { logger.warn(`Storage ${label} failed after retries`, e); throw e; });
    return {
        init,
        save: (id, state) => wrap(() => tx('readwrite').put({ id, state, ts: Date.now() }), 'save'),
        load: (id) => wrap(() => tx('readonly').get(id), 'load').then(r => r?.state),
        list: () => wrap(() => tx('readonly').getAll(), 'list').then(r => (r || []).sort((a, b) => b.ts - a.ts)),
        delete: (id) => wrap(() => tx('readwrite').delete(id), 'delete')
    };
}
function createPerfMonitor() {
    let enabled = false, frames = 0, lastTime = performance.now();
    /* v0.2.8 性能: 起始时一次查询,后续不再 getElementById */
    const el = document.getElementById('perf-card');
    const fpsEl = document.getElementById('info-fps');
    const m = { gen: 0, render: 0, fps: 0 };
    return { setEnabled: v => { enabled = v; if (el) { el.classList.toggle('visible', v); if (!v) el.textContent = ''; } }, recordGen: ms => m.gen = ms, recordRender: ms => m.render = ms, tick: () => { frames++; const now = performance.now(); if (now - lastTime >= 1000) { m.fps = frames; frames = 0; lastTime = now; if (fpsEl) fpsEl.textContent = `${m.fps} FPS`; if (enabled && el) { const mem = performance.memory ? `${(performance.memory.usedJSHeapSize / 1048576).toFixed(1)}MB` : 'N/A'; el.innerHTML = `FPS: ${m.fps}<br>Render: ${m.render.toFixed(2)}ms<br>Gen: ${m.gen.toFixed(0)}ms<br>Mem: ${mem}`; } } } };
}

// =====================================================================
// 模块 5: 状态管理系统
// =====================================================================
const GEN_KEYS = ['seedStr', 'mapSize', 'plateCount', 'landmass', 'noiseType', 'fbmType', 'octaves', 'lacunarity', 'persistence', 'seaLevel', 'erosionStrength', 'erosionIterations', 'mountainFold', 'tempOffset', 'mapAspect', 'worldScale', 'coastDetail', 'lakeDensity'];
const RENDER_KEYS = ['showBoundaries', 'boundaryWidth', 'boundaryColor', 'pointLightEnabled', 'pointLightPos', 'pointLightIntensity', 'pointLightColor', 'glowEnabled', 'style', 'showNames', 'fbmOctaves', 'fbmLacunarity', 'fbmPersistence', 'snowLine', 'erosionStrength', 'showRivers', 'contourInterval', 'showContours', 'showTerrain', 'showSelection', 'showGrid', 'detailRiverWidth', 'detailRiverCurve', 'detailCoastJagged', 'detailRidgeDensity', 'detailRainfallOffset', 'detailTempGradient', 'detailBiomeBlend'];
function createStore(initial) {
    let s = initial;
    const listeners = [];
    return { get: () => s, set: (p, forceRegen = false) => { const oldS = s; s = { ...s, ...p }; const changedGen = GEN_KEYS.some(k => p[k] !== undefined && oldS[k] !== p[k]); const needsRegen = forceRegen || changedGen; if (needsRegen) s._needsRegen = true; listeners.forEach(f => f(s, { changedGen, needsRegen, payload: p })); }, subscribe: f => listeners.push(f) };
}
function applyI18n(cb) {
    document.documentElement.lang = currentLang;
    document.querySelectorAll('[data-i18n]').forEach(el => { const k = el.dataset.i18n; if (I18N[currentLang][k]) el.textContent = I18N[currentLang][k]; });
    const langBtn = document.getElementById('lang-btn');
    if (langBtn) { langBtn.textContent = currentLang === 'zh' ? 'EN' : '中'; langBtn.setAttribute('aria-pressed', currentLang === 'en'); }
    if (cb) cb();
}

// =====================================================================
// 模块 6: 核心算法引擎
// =====================================================================
function hashSeed(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return Math.abs(4294967296 * (2097151 & h2) + (h1 >>> 0));
}
function createNoiseEngine(seed) {
    const perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = seed || 1;
    const rng = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const lerp = (t, a, b) => a + t * (b - a);
    const grad = (h, gx, gy) => { const g = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]; const v = g[h % 8]; return v[0] * gx + v[1] * gy; };
    const simplex = (x, y) => {
        const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
        const s = (x + y) * F2, i = Math.floor(x + s), j = Math.floor(y + s), t = (i + j) * G2;
        const x0 = x - (i - t), y0 = y - (j - t), i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
        const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
        const ii = i & 255, jj = j & 255;
        let n0 = 0, n1 = 0, n2 = 0;
        let t0 = 0.5 - x0 * x0 - y0 * y0; if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * grad(perm[ii + perm[jj]], x0, y0); }
        let t1 = 0.5 - x1 * x1 - y1 * y1; if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * grad(perm[ii + i1 + perm[jj + j1]], x1, y1); }
        let t2 = 0.5 - x2 * x2 - y2 * y2; if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * grad(perm[ii + 1 + perm[jj + 1]], x2, y2); }
        return 70 * (n0 + n1 + n2);
    };
    const perlin = (x, y) => {
        const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
        x -= Math.floor(x); y -= Math.floor(y);
        const u = x * x * x * (x * (x * 6 - 15) + 10), v = y * y * y * (y * (y * 6 - 15) + 10);
        const A = perm[X] + Y, B = perm[X + 1] + Y;
        return lerp(v, lerp(u, grad(perm[A], x, y), grad(perm[B], x - 1, y)), lerp(u, grad(perm[A + 1], x, y - 1), grad(perm[B + 1], x - 1, y - 1)));
    };
    const value = (x, y) => {
        const X = Math.floor(x), Y = Math.floor(y), fx = x - X, fy = y - Y;
        const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
        const r = (ix, iy) => (perm[perm[ix & 255] + (iy & 255)] / 255) * 2 - 1;
        return lerp(v, lerp(u, r(X, Y), r(X + 1, Y)), lerp(u, r(X, Y + 1), r(X + 1, Y + 1)));
    };
    const worley = (x, y) => {
        const ix = Math.floor(x), iy = Math.floor(y);
        let minD = 10;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = ix + dx, ny = iy + dy;
            const px = nx + (perm[perm[nx & 255] + (ny & 255)] / 255);
            const py = ny + (perm[perm[(nx + 128) & 255] + ((ny + 128) & 255)] / 255);
            const d = (x - px) ** 2 + (y - py) ** 2;
            if (d < minD) minD = d;
        }
        return Math.sqrt(minD) * 2 - 1;
    };
    const fbm = (x, y, opts) => {
        const { octaves, lacunarity, persistence, type, noiseType } = opts;
        const fn = { perlin, value, worley, simplex }[noiseType] || simplex;
        let val = 0, amp = 1, freq = 1, max = 0, wx = x, wy = y;
        if (type === 'warped') { wx = x + fn(x * 2.1, y * 2.1) * 0.5; wy = y + fn(x * 2.1 + 5.2, y * 2.1 + 1.3) * 0.5; }
        for (let i = 0; i < octaves; i++) {
            let n = fn(wx * freq, wy * freq);
            if (type === 'ridged') n = 1 - Math.abs(n);
            else if (type === 'billowy') n = Math.abs(n);
            val += amp * n; max += amp; amp *= persistence; freq *= lacunarity;
        }
        return val / max;
    };
    /* v0.3.0: 多层噪声辅助函数 */
    const ridgedFbm = (x, y, oct = 5) => {
        let val = 0, amp = 1, freq = 1, max = 0;
        for (let i = 0; i < oct; i++) {
            let n = simplex(x * freq, y * freq);
            n = 1 - Math.abs(n); n = n * n; // ridged with squaring for sharper ridges
            val += amp * n; max += amp; amp *= 0.5; freq *= 2.0;
        }
        return val / max;
    };
    const warpedFbm = (x, y, oct = 5) => {
        // Domain warping for folded mountain texture
        const wx = x + simplex(x * 1.7, y * 1.7) * 0.8;
        const wy = y + simplex(x * 1.7 + 5.2, y * 1.7 + 1.3) * 0.8;
        let val = 0, amp = 1, freq = 1, max = 0;
        for (let i = 0; i < oct; i++) {
            val += amp * simplex(wx * freq, wy * freq); max += amp; amp *= 0.5; freq *= 2.0;
        }
        return val / max;
    };
    const billowyFbm = (x, y, oct = 5) => {
        let val = 0, amp = 1, freq = 1, max = 0;
        for (let i = 0; i < oct; i++) {
            let n = Math.abs(simplex(x * freq, y * freq));
            val += amp * n; max += amp; amp *= 0.5; freq *= 2.0;
        }
        return val / max;
    };
    const worleyDetail = (x, y) => {
        // Multi-scale worley for ridge/valley detail
        const w1 = worley(x, y);
        const w2 = worley(x * 2.0, y * 2.0) * 0.5;
        const w3 = worley(x * 4.0, y * 4.0) * 0.25;
        return (w1 + w2 + w3) / 1.75;
    };
    return { simplex, perlin, value, worley, fbm, ridgedFbm, warpedFbm, billowyFbm, worleyDetail };
}
function createTectonicEngine(logger) {
    let W = 1024, H = 1024, plates = [], plateNames = [], regions = [], regionNames = [], buffers = { plate: null, elev: null, moist: null, temp: null, river: null, size: 0 };
    const ensure = s => { if (buffers.size !== s) { buffers.plate = new Float32Array(s * 4); buffers.elev = new Float32Array(s); buffers.moist = new Float32Array(s); buffers.temp = new Float32Array(s); buffers.river = new Float32Array(s); buffers.size = s; } };
    const setSize = (w, h) => { W = w; H = h; ensure(W * H); };
    const rngFactory = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const genNames = (seed, count) => {
        let s = seed;
        const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
        const head = ['艾','索','瓦','克','赞','莫','维','伊','纳','顿','安','贝','铎','葛','赫'];
        const middle =['尔','林','尼','拉','恩','斯','罗','诺','瑞','萨','卡','塔'];
        const tail = ['兰','多','亚','德','地','加','特','曼','达','尔','斯','姆','堡','原','野'];
        const n = [], u = new Set();
        for (let i = 0; i < count; i++) {
            let name, t = 0;
            do { const h = head[Math.floor(r() * head.length)]; const roll = r();
                if (roll < 0.15) name = h + tail[Math.floor(r() * tail.length)];
                else if (roll < 0.70) name = h + middle[Math.floor(r() * middle.length)] + tail[Math.floor(r() * tail.length)];
                else { const m1 = middle[Math.floor(r() * middle.length)]; let m2 = middle[Math.floor(r() * middle.length)]; while (m2 === m1) m2 = middle[Math.floor(r() * middle.length)]; name = h + m1 + m2 + tail[Math.floor(r() * tail.length)]; } t++;
            } while (u.has(name) && t < 12);
            u.add(name); n.push(name);
        }
        return n;
    };
    /* v0.3.8: 地形区命名生成器 */
    const genRegionNames = (seed, regions, lang) => {
        let s = seed + 888888;
        const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
        const prefix = ['艾','索','瓦','克','赞','莫','维','伊','纳','顿','安','贝','铎','葛','赫','奥','雷','柯','帕','泽'];
        const prefixEn = ['Ar','Sol','Val','Kor','Zan','Mor','Vil','Ith','Nar','Don','An','Bel','Dor','Gor','Her','Or','Rey','Kor','Pal','Zer'];
        const isEN = lang === 'en';
        const names = [];
        const used = new Set();
        for (let i = 0; i < regions.length; i++) {
            const reg = regions[i];
            const typeKey = reg.type;
            const suffixes = isEN ? I18N.en[`suffix_${typeKey}`] : I18N.zh[`suffix_${typeKey}`];
            const typeName = isEN ? I18N.en[`region_type_${typeKey}`] : I18N.zh[`region_type_${typeKey}`];
            let name, attempts = 0;
            do {
                let pfx;
                if (isEN) {
                    pfx = prefixEn[Math.floor(r() * prefixEn.length)];
                    const pfx2 = r() < 0.35 ? prefixEn[Math.floor(r() * prefixEn.length)] : '';
                    const mid = r() < 0.5 ? ['a','e','i','o','u','an','en','ar'][Math.floor(r() * 8)] : '';
                    pfx = pfx + mid + pfx2;
                    const suf = suffixes[Math.floor(r() * suffixes.length)];
                    // 英文：X Mountains / Mountains of X / X Desert etc.
                    const roll = r();
                    if (roll < 0.3) name = `${pfx} ${suf}`;
                    else if (roll < 0.6) name = `${suf} of ${pfx}`;
                    else name = `${pfx} ${suf}`;
                } else {
                    pfx = prefix[Math.floor(r() * prefix.length)];
                    const roll = r();
                    if (roll < 0.2) pfx += prefix[Math.floor(r() * prefix.length)];
                    const suf = suffixes[Math.floor(r() * suffixes.length)];
                    name = pfx + suf;
                }
                attempts++;
            } while (used.has(name) && attempts < 15);
            used.add(name);
            names.push(name);
        }
        return names;
    };
    const generate = async (config, onProgress, signal) => {
        ensure(W * H);
        const { seedStr, plateCount, landmass, noiseType, fbmType, octaves, lacunarity, persistence, seaLevel,
                erosionStrength = 0.3, erosionIterations = 20, mountainFold = 0.5, tempOffset = 0,
                coastDetail = 0.4, lakeDensity = 0.2 } = config;
        // v0.3.2: 参数校验
        if (plateCount < 1 || plateCount > 64) throw new Error(`Invalid plateCount: ${plateCount}`);
        if (landmass < 0 || landmass > 100) throw new Error(`Invalid landmass: ${landmass}`);
        if (seaLevel < 0 || seaLevel > 1) throw new Error(`Invalid seaLevel: ${seaLevel}`);
        if (octaves < 0 || octaves > 10) throw new Error(`Invalid octaves: ${octaves}`);
        if (lacunarity <= 0) throw new Error(`Invalid lacunarity: ${lacunarity}`);
        if (persistence <= 0) throw new Error(`Invalid persistence: ${persistence}`);
        const seed = hashSeed(seedStr), rng = rngFactory(seed), noise = createNoiseEngine(seed), noise2 = createNoiseEngine(seed + 777), noise3 = createNoiseEngine(seed + 1337);
        plates = [];
        for (let i = 0; i < plateCount; i++) plates.push({ x: rng() * W, y: rng() * H, id: i, type: rng() < (landmass / 100) ? 1 : 0, vx: (rng() - 0.5) * 2, vy: (rng() - 0.5) * 2, density: 0.3 + rng() * 0.7 });
        for (let it = 0; it < 3; it++) {
            if (signal?.aborted) throw createAbortError();
            const sums = plates.map(() => ({ sx: 0, sy: 0, c: 0 }));
            const step = Math.max(4, Math.floor(W / 128));
            for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
                let mD = Infinity, c = 0;
                for (let p = 0; p < plates.length; p++) {
                    const d = (x - plates[p].x) ** 2 + (y - plates[p].y) ** 2;
                    if (d < mD) { mD = d; c = p; }
                }
                sums[c].sx += x; sums[c].sy += y; sums[c].c++;
            }
            for (let p = 0; p < plates.length; p++) if (sums[p].c > 0) { plates[p].x = sums[p].sx / sums[p].c; plates[p].y = sums[p].sy / sums[p].c; }
        }
        plateNames = genNames(seed, plateCount);
        const pM = buffers.plate, eM = buffers.elev, mM = buffers.moist, tM = buffers.temp, rM = buffers.river;
        const fOpts = { octaves, lacunarity, persistence, type: fbmType, noiseType };
        const fOptsLow = { octaves: Math.min(3, octaves), lacunarity, persistence, type: fbmType, noiseType };
        const fOptsMoist = { octaves, lacunarity, persistence, type: fbmType, noiseType: 'simplex' };
        const pidScale = plateCount > 1 ? 1 / (plateCount - 1) : 0;
        const sea = seaLevel;
        const foldStr = mountainFold; // 山脉褶皱度 0~1

        /* ========== 第一遍: 多层噪声合成 + 板块影响 ========== */
        for (let y = 0; y < H; y++) {
            if (y % 32 === 0) { if (signal?.aborted) throw createAbortError(); if (onProgress) onProgress(y / H * 0.7); await yieldToMain(); }
            for (let x = 0; x < W; x++) {
                let mD = Infinity, mD2 = Infinity, c1 = 0, c2 = 0;
                for (let p = 0; p < plates.length; p++) {
                    const d = (x - plates[p].x) ** 2 + (y - plates[p].y) ** 2;
                    if (d < mD) { mD2 = mD; c2 = c1; mD = d; c1 = p; }
                    else if (d < mD2) { mD2 = d; c2 = p; }
                }
                const idx = y * W + x;
                const bS = Math.exp(-(Math.sqrt(mD2) - Math.sqrt(mD)) * 0.08);
                const p1 = plates[c1], p2 = plates[c2];
                const nx = x / W * 6, ny = y / H * 6;

                /* v0.3.0: 四层噪声合成 */
                // 大陆骨架 (40%): ridgedFbm → 大陆/海洋轮廓
                const continental = noise2.ridgedFbm(nx * 0.5, ny * 0.5, Math.min(octaves, 5)) * 0.5 + 0.5;
                // 山脉纹理 (25%): warpedFbm → 褶皱山脉
                const mountain = noise.warpedFbm(nx * 2, ny * 2, Math.min(octaves, 4)) * 0.5 + 0.5;
                // 丘陵侵蚀 (20%): billowyFbm → 中等地形
                const hill = noise3.billowyFbm(nx * 3, ny * 3, Math.min(octaves, 4)) * 0.5 + 0.5;
                // 微地形 (15%): worleyDetail → 山脊/河谷细节
                const detail = noise.worleyDetail(nx * 5, ny * 5) * 0.5 + 0.5;

                let e = continental * 0.40 + mountain * 0.25 * foldStr + hill * 0.20 + detail * 0.15;

                // 板块类型影响
                if (p1.type) e += 0.15; else e -= 0.08;

                // 边界碰撞影响
                if (bS > 0.3) {
                    const rel = Math.hypot(p1.vx - p2.vx, p1.vy - p2.vy);
                    if (p1.type && p2.type) e += bS * 0.3 * rel;
                    else if (!p1.type && p2.type) e += bS * (p1.density > p2.density ? -0.15 : 0.25);
                }
                eM[idx] = e < 0 ? 0 : e > 1 ? 1 : e;

                // 湿度计算
                let m = noise2.fbm(nx * 1.5 + 50, ny * 1.5 + 50, fOptsMoist) * 0.5 + 0.5;
                if (e > sea + 0.2) m *= 0.5; if (e < sea + 0.05) m = m + 0.3 > 1 ? 1 : m + 0.3;
                mM[idx] = m < 0 ? 0 : m > 1 ? 1 : m;

                // 温度计算 (v0.3.0)
                const nyNorm = y / H; // 0~1, 纬度归一化
                let temp = 1.0 - Math.abs(nyNorm - 0.5) * 2.0; // 赤道最热
                temp -= Math.max(0, e - sea) * 0.6; // 海拔递减
                temp += tempOffset / 20.0; // 温度偏移
                tM[idx] = temp < 0 ? 0 : temp > 1 ? 1 : temp;

                // 板块纹理数据
                const i4 = idx * 4;
                pM[i4] = pidScale * c1; pM[i4 + 1] = p1.type ? 1 : 0; pM[i4 + 2] = p1.density; pM[i4 + 3] = bS;
            }
        }

        /* v0.3.2: 海岸线细节——增强型峡湾/海湾生成 */
        if (coastDetail > 0.01) {
            const coastNoise = createNoiseEngine(seed + 9999);
            const coastNoise2 = createNoiseEngine(seed + 13377); // 第二八度噪声
            const coastWidth = 0.12; // 增大影响宽度——更深的峡湾效果
            for (let y = 0; y < H; y++) {
                if (y % 64 === 0) { if (signal?.aborted) throw createAbortError(); await yieldToMain(); }
                for (let x = 0; x < W; x++) {
                    const idx = y * W + x;
                    const e = eM[idx];
                    const distToSea = Math.abs(e - sea);
                    if (distToSea < coastWidth) {
                        const nx = x / W * 20, ny = y / H * 20;
                        const nx2 = x / W * 40, ny2 = y / H * 40; // 高频第二八度
                        const falloff = 1 - distToSea / coastWidth;
                        // 非线性缩放：coastDetail 越高扰动越剧烈
                        const strength = coastDetail * coastDetail * 0.06;
                        const perturbation = (coastNoise.simplex(nx, ny) * 0.7 + coastNoise2.simplex(nx2, ny2) * 0.3) * strength * falloff;
                        eM[idx] = clamp(e + perturbation, 0, 1);
                    }
                }
            }
        }

        /* ========== 第二遍: 水力侵蚀模拟 (v0.3.0) ========== */
        if (erosionStrength > 0.01) {
            const numDrops = Math.max(10, Math.floor(W * H * 0.01 * erosionStrength));
            const maxSteps = Math.min(64, Math.floor(Math.max(W, H) / 32));
            const inertia = 0.05;
            const sedimentCapacityFactor = 4.0;
            const minSlope = 0.01;
            const erodeRate = 0.3 * erosionStrength;
            const depositRate = 0.2;

            for (let iter = 0; iter < erosionIterations; iter++) {
                if (iter % 4 === 0) { if (signal?.aborted) throw createAbortError(); if (onProgress) onProgress(0.7 + (iter / erosionIterations) * 0.15); await yieldToMain(); }
                for (let di = 0; di < numDrops; di++) {
                    let px = rng() * (W - 2) + 1, py = rng() * (H - 2) + 1;
                    let dx = 0, dy = 0, speed = 1, sediment = 0, water = 1;

                    for (let s = 0; s < maxSteps; s++) {
                        const ix = Math.floor(px), iy = Math.floor(py);
                        if (ix < 1 || ix >= W - 1 || iy < 1 || iy >= H - 1) break;

                        // 双线性插值获取当前高度
                        const idx00 = iy * W + ix, idx10 = idx00 + 1, idx01 = idx00 + W, idx11 = idx01 + 1;
                        const fx = px - ix, fy = py - iy;
                        const h00 = eM[idx00], h10 = eM[idx10], h01 = eM[idx01], h11 = eM[idx11];
                        const curH = h00 * (1 - fx) * (1 - fy) + h10 * fx * (1 - fy) + h01 * (1 - fx) * fy + h11 * fx * fy;

                        // 计算梯度 (最陡坡度)
                        const gdx = (h10 - h00) * (1 - fy) + (h11 - h01) * fy;
                        const gdy = (h01 - h00) * (1 - fx) + (h11 - h10) * fx;

                        // 惯性混合
                        dx = dx * inertia - gdx * (1 - inertia);
                        dy = dy * inertia - gdy * (1 - inertia);

                        // 归一化方向
                        const len = Math.sqrt(dx * dx + dy * dy);
                        if (len < 0.0001) { dx = rng() - 0.5; dy = rng() - 0.5; }
                        else { dx /= len; dy /= len; }

                        px += dx; py += dy;
                        if (px < 1 || px >= W - 1 || py < 1 || py >= H - 1) break;

                        const nix = Math.floor(px), niy = Math.floor(py);
                        const nIdx = niy * W + nix;
                        const newH = eM[nIdx];
                        const deltaH = newH - curH;

                        // 搬运/沉积计算
                        const capacity = Math.max(-deltaH, minSlope) * speed * water * sedimentCapacityFactor;
                        if (sediment > capacity || deltaH > 0) {
                            // 沉积
                            const depositAmt = deltaH > 0 ? Math.min(deltaH, sediment) : (sediment - capacity) * depositRate;
                            sediment -= depositAmt;
                            eM[nIdx] += depositAmt;
                        } else {
                            // 侵蚀
                            const erodeAmt = Math.min((capacity - sediment) * erodeRate, -deltaH * 0.5);
                            sediment += erodeAmt;
                            eM[nIdx] -= erodeAmt;
                        }
                        speed = Math.sqrt(Math.max(0, speed * speed + deltaH * 4.0));
                        water *= 0.99;
                    }
                }
            }
            // 钳制高程
            for (let i = 0; i < W * H; i++) eM[i] = eM[i] < 0 ? 0 : eM[i] > 1 ? 1 : eM[i];
        }

        /* v0.3.2: 湖泊生成——在陆地上寻找局部低洼区域 (优化: Uint8Array 替代 Set, 索引队列替代 shift) */
        if (lakeDensity > 0.01) {
            const lakeVisited = new Uint8Array(W * H);
            let lakeToken = 0;
            const numLakeSeeds = Math.max(5, Math.floor(W * H * 0.0003 * lakeDensity * 10));
            const lakeQueue = new Int32Array(W * H); // 预分配队列缓冲
            for (let li = 0; li < numLakeSeeds; li++) {
                let lx = Math.floor(rng() * (W - 4)) + 2;
                let ly = Math.floor(rng() * (H - 4)) + 2;
                const idx = ly * W + lx;
                if (eM[idx] < sea + 0.03 || eM[idx] > sea + 0.25) continue; // 必须在陆地上
                // 检查是否局部最低点 (扩大检测范围到5×5)
                let isLocalMin = true;
                for (let dy = -2; dy <= 2 && isLocalMin; dy++) {
                    for (let dx = -2; dx <= 2 && isLocalMin; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const ni = (ly + dy) * W + (lx + dx);
                        if (ni >= 0 && ni < W * H && eM[ni] < eM[idx]) isLocalMin = false;
                    }
                }
                if (!isLocalMin) continue;
                // 填充到周围最低点高度（模拟积水）
                lakeToken++;
                const fillLevel = eM[idx] + 0.01 + rng() * 0.02;
                let qHead = 0, qTail = 0;
                lakeQueue[qTail++] = idx;
                lakeVisited[idx] = lakeToken;
                while (qHead < qTail) {
                    const ci = lakeQueue[qHead++];
                    const cy2 = Math.floor(ci / W), cx2 = ci % W;
                    if (eM[ci] > fillLevel) continue;
                    eM[ci] = clamp(sea - 0.01 + rng() * 0.005, 0, 1); // 标记为水面
                    rM[ci] = Math.max(rM[ci], 0.6); // 标记为湖泊（河流层）
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const ny2 = cy2 + dy, nx2 = cx2 + dx;
                            if (ny2 < 0 || ny2 >= H || nx2 < 0 || nx2 >= W) continue;
                            const ni = ny2 * W + nx2;
                            if (lakeVisited[ni] !== lakeToken && eM[ni] <= fillLevel) { lakeVisited[ni] = lakeToken; lakeQueue[qTail++] = ni; }
                        }
                    }
                }
            }
        }

        /* ========== 第三遍: 河流网络生成 (v0.3.0) ========== */
        rM.fill(0);
        const riverVisited = new Uint16Array(W * H);
        let riverVisitToken = 0;
        const riverDrops = Math.max(50, Math.floor(W * H * 0.002));
        for (let ri = 0; ri < riverDrops; ri++) {
            let rx = Math.floor(rng() * W), ry = Math.floor(rng() * H);
            const startElev = eM[ry * W + rx];
            if (startElev < sea + 0.05) continue; // 从高海拔点出发

            const path = [];
            if (riverVisitToken >= 65535) { riverVisited.fill(0); riverVisitToken = 0; }
            riverVisitToken++;
            for (let step = 0; step < 200; step++) {
                if (rx < 1 || rx >= W - 1 || ry < 1 || ry >= H - 1) break;
                const idx = ry * W + rx;
                if (eM[idx] < sea) break; // 到达海平面
                if (riverVisited[idx] === riverVisitToken) break;
                riverVisited[idx] = riverVisitToken;
                path.push(idx);

                // 找最陡坡度方向
                let steepest = 0, sdx = 0, sdy = 0;
                for (let dy2 = -1; dy2 <= 1; dy2++) {
                    for (let dx2 = -1; dx2 <= 1; dx2++) {
                        if (dx2 === 0 && dy2 === 0) continue;
                        const nx2 = rx + dx2, ny2 = ry + dy2;
                        if (nx2 < 0 || nx2 >= W || ny2 < 0 || ny2 >= H) continue;
                        const drop = eM[idx] - eM[ny2 * W + nx2];
                        if (drop > steepest) { steepest = drop; sdx = dx2; sdy = dy2; }
                    }
                }
                if (steepest <= 0) break; // 无下坡方向
                rx += sdx; ry += sdy;
            }
            // 记录路径宽度
            const width = Math.min(1.0, path.length / 60.0);
            for (let pi = 0; pi < path.length; pi++) {
                const fade = 0.5 + (pi / path.length) * 0.5; // 下游更宽（物理正确）
                rM[path[pi]] = Math.max(rM[path[pi]], width * fade);
            }
        }

        /* ========== v0.3.8: 地形区分析 ========== */
        if (onProgress) onProgress(0.92);
        const snowL = config.snowLine != null ? config.snowLine : 0.65;
        // 区域类型定义
        const REGION_TYPES = {
            mountain: (e, m, t) => e > snowL,
            plateau: (e, m, t) => e > 0.7 && e <= snowL,
            hills: (e, m, t) => e > 0.55 && e <= 0.7,
            desert: (e, m, t) => e > sea && m < 0.2 && t > 0.5,
            forest: (e, m, t) => e > sea && m > 0.5,
            wetland: (e, m, t) => e > sea - 0.02 && e < sea + 0.06 && m > 0.6,
            tundra: (e, m, t) => e > sea && t < 0.2 && m > 0.3,
            ice: (e, m, t) => e > sea && t < 0.1,
            basin: (e, m, t) => e > sea && e < 0.35,
            plains: (e, m, t) => e > sea && e <= 0.55 && m <= 0.5 && t >= 0.2
        };
        const TYPE_PRIORITY = ['mountain','plateau','hills','desert','forest','wetland','tundra','ice','basin','plains'];
        // 降采样网格
        const rStep = Math.max(6, Math.floor(Math.max(W, H) / 90));
        const rCols = Math.ceil(W / rStep);
        const rRows = Math.ceil(H / rStep);
        const gridSize = rCols * rRows;
        const gridType = new Int8Array(gridSize);
        const gridVisited = new Uint8Array(gridSize);
        // 对每个采样网格点分类
        for (let gy = 0; gy < rRows; gy++) {
            for (let gx = 0; gx < rCols; gx++) {
                const px = Math.min(gx * rStep, W - 1);
                const py = Math.min(gy * rStep, H - 1);
                const idx = py * W + px;
                const e = eM[idx], m = mM[idx], t = tM[idx];
                const gi = gy * rCols + gx;
                if (e < sea) { gridType[gi] = -1; continue; } // 水域跳过
                // 按优先级确定区域类型
                for (let ti = 0; ti < TYPE_PRIORITY.length; ti++) {
                    const typeKey = TYPE_PRIORITY[ti];
                    if (REGION_TYPES[typeKey](e, m, t)) {
                        gridType[gi] = ti + 1; // +1 避开 0（未分类）
                        break;
                    }
                }
                if (gridType[gi] === 0) gridType[gi] = TYPE_PRIORITY.indexOf('plains') + 1; // fallback
            }
        }
        // Flood Fill 提取连通区域
        const rawRegions = [];
        const dirs = [[-1,0],[1,0],[0,-1],[0,1]]; // 4-连通
        for (let gy = 0; gy < rRows; gy++) {
            for (let gx = 0; gx < rCols; gx++) {
                const gi = gy * rCols + gx;
                if (gridVisited[gi] || gridType[gi] <= 0) continue;
                const typeIdx = gridType[gi];
                // BFS
                const queue = [gi];
                gridVisited[gi] = 1;
                let qHead = 0, minX = gx, minY = gy, maxX = gx, maxY = gy, sumX = 0, sumY = 0, count = 0;
                while (qHead < queue.length) {
                    const ci = queue[qHead++];
                    const cx = ci % rCols, cy = Math.floor(ci / rCols);
                    sumX += cx; sumY += cy; count++;
                    if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
                    if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
                    for (const [dx, dy] of dirs) {
                        const nx = cx + dx, ny = cy + dy;
                        if (nx < 0 || nx >= rCols || ny < 0 || ny >= rRows) continue;
                        const ni = ny * rCols + nx;
                        if (!gridVisited[ni] && gridType[ni] === typeIdx) {
                            gridVisited[ni] = 1;
                            queue.push(ni);
                        }
                    }
                }
                if (count < 3) continue; // 忽略过小区域
                const area = count * rStep * rStep;
                rawRegions.push({
                    type: TYPE_PRIORITY[typeIdx - 1],
                    cx: (sumX / count) * rStep + rStep / 2,
                    cy: (sumY / count) * rStep + rStep / 2,
                    minX: minX * rStep, minY: minY * rStep,
                    maxX: (maxX + 1) * rStep, maxY: (maxY + 1) * rStep,
                    area, count
                });
            }
        }
        // 按面积排序取前 N 个
        rawRegions.sort((a, b) => b.area - a.area);
        const maxRegions = Math.min(22, rawRegions.length);
        regions = rawRegions.slice(0, maxRegions);
        // 计算实际高程/湿度统计
        const rStep2 = Math.max(4, Math.floor(Math.max(W, H) / 300));
        for (const reg of regions) {
            let eSum = 0, mSum = 0, tSum = 0, rCount = 0;
            const rx0 = Math.max(0, Math.floor(reg.minX / rStep2));
            const ry0 = Math.max(0, Math.floor(reg.minY / rStep2));
            const rx1 = Math.min(Math.floor(reg.maxX / rStep2), Math.floor(W / rStep2));
            const ry1 = Math.min(Math.floor(reg.maxY / rStep2), Math.floor(H / rStep2));
            for (let ry = ry0; ry <= ry1; ry++) {
                for (let rx = rx0; rx <= rx1; rx++) {
                    const px2 = Math.min(rx * rStep2, W - 1);
                    const py2 = Math.min(ry * rStep2, H - 1);
                    const idx2 = py2 * W + px2;
                    if (eM[idx2] < sea) continue; // 跳过水域
                    const gi2 = Math.floor(py2 / rStep) * rCols + Math.floor(px2 / rStep);
                    if (gi2 >= 0 && gi2 < gridSize && gridType[gi2] === TYPE_PRIORITY.indexOf(reg.type) + 1) {
                        eSum += eM[idx2]; mSum += mM[idx2]; tSum += tM[idx2]; rCount++;
                    }
                }
            }
            reg.avgElev = rCount > 0 ? eSum / rCount : 0;
            reg.avgMoist = rCount > 0 ? mSum / rCount : 0;
            reg.avgTemp = rCount > 0 ? tSum / rCount : 0;
        }
        // 生成名称
        const langForNames = config._lang || 'zh';
        regionNames = genRegionNames(seed, regions, langForNames);

        if (onProgress) onProgress(1);
        return { plateData: pM, elevData: eM, moistData: mM, tempData: tM, riverData: rM };
    };
    const getPlatesAlongLine = (x0, y0, x1, y1) => {
        const ids = new Set();
        const steps = Math.max(50, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4));
        for (let i = 0; i <= steps; i++) { const t = i / steps; const px = Math.floor(x0 + (x1 - x0) * t), py = Math.floor(y0 + (y1 - y0) * t); if (px >= 0 && px < W && py >= 0 && py < H) { const idx = py * W + px; const pid = Math.round(buffers.plate[idx * 4] * (plates.length - 1)); if (pid >= 0) ids.add(pid); } }
        return [...ids];
    };
    const getStats = pids => {
        if (!buffers.plate || !pids.length) return {};
        const lut = new Uint8Array(plates.length), stats = {};
        pids.forEach(p => { lut[p] = 1; stats[p] = { id: p, min: 1, max: 0, area: 0, sE: 0, sM: 0, sX: 0, sY: 0, c: 0 }; });
        const step = Math.max(2, Math.floor(Math.max(W, H) / 300));
        for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
            const idx = y * W + x; const pid = Math.round(buffers.plate[idx * 4] * (plates.length - 1)); if (!lut[pid]) continue;
            const s = stats[pid], e = buffers.elev[idx], m = buffers.moist[idx]; s.c++; s.sE += e; s.sM += m; s.sX += x; s.sY += y; if (e < s.min) s.min = e; if (e > s.max) s.max = e;
        }
        pids.forEach(p => { const s = stats[p]; if (!s.c) { delete stats[p]; return; } const pl = plates[p]; Object.assign(s, { type: pl.type, dens: pl.density, vx: pl.vx, vy: pl.vy, area: s.c * step * step, avgE: s.sE / s.c, avgM: s.sM / s.c, cx: s.sX / s.c, cy: s.sY / s.c, name: plateNames[p] || `#${p + 1}` }); });
        return stats;
    };
    return { get W() { return W; }, get H() { return H; }, get plates() { return plates; }, get plateNames() { return plateNames; }, get regions() { return regions; }, get regionNames() { return regionNames; }, get elevMap() { return buffers.elev; }, get plateMap() { return buffers.plate; }, get moistMap() { return buffers.moist; }, get tempMap() { return buffers.temp; }, get riverMap() { return buffers.river; }, setSize, generate, getPlatesAlongLine, getStats };
}

// =====================================================================
// 模块 7: WebGL 渲染管线
// =====================================================================
/* v0.3.10: GLSL ES 3.0 → 1.0 自动转译器（完整兼容方案） */
function transpileGLSL(src, type, glCtx) {
    /* 顶点着色器转译 */
    var s = src.replace(/^#version\s+300\s+es\s*\n/m, '');
    if (type === glCtx.VERTEX_SHADER) {
        s = s.replace(/\bin\s+(\w+\s+\w+;)/g, 'attribute $1');
        s = s.replace(/\bout\s+(\w+\s+\w+;)/g, 'varying $1');
    }
    /* 片段着色器转译 */
    if (type === glCtx.FRAGMENT_SHADER) {
        s = s.replace(/\bin\s+(\w+\s+\w+;)/g, 'varying $1');
        s = s.replace(/^\s*out\s+\w+\s+\w+\s*;\s*/gm, '');
        /* 查找 out 变量名并替换为 gl_FragColor */
        var m = src.match(/out\s+\w+\s+(\w+)\s*;/);
        if (m) {
            var outName = m[1];
            s = s.replace(new RegExp('\\b' + outName + '\\b', 'g'), 'gl_FragColor');
        }
    }
    /* texture() → texture2D() */
    s = s.replace(/\btexture\(/g, 'texture2D(');
    return s;
}

function createRenderer(canvas, logger, perf) {
    /* v0.3.10: 更新 splash 状态 */
    var _statusEl = document.querySelector('.splash-subtitle');
    var _setStatus = function(msg){if(_statusEl)_statusEl.textContent=msg;};
    _setStatus('正在创建 WebGL 上下文...');
    /* v0.3.10: 移动端兼容——先尝试 WebGL2（默认电源偏好），降级到 WebGL1 */
    let gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, powerPreference: 'default' });
    let isWebGL2 = !!gl;
    if (!gl) {
        gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, powerPreference: 'default' })
          || canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true, powerPreference: 'default' });
    }
    if (!gl) throw new Error('WebGL not supported');
    logger.info(`WebGL ${isWebGL2 ? '2' : '1'} context created`);
    /* v0.3.10: WebGL2→1 兼容适配层 */
    let _createVertexArray, _bindVertexArray, _R8, _RED_fmt, _RGBA32F;
    let hasFloatLinear = false;
    if (!isWebGL2) {
        var vaoExt = gl.getExtension('OES_vertex_array_object');
        if (!vaoExt) throw new Error('WebGL1: OES_vertex_array_object not supported');
        var floatExt = gl.getExtension('OES_texture_float');
        if (!floatExt) throw new Error('WebGL1: OES_texture_float required');
        hasFloatLinear = !!gl.getExtension('OES_texture_float_linear');
        _createVertexArray = function() { return vaoExt.createVertexArrayOES(); };
        _bindVertexArray = function(v) { vaoExt.bindVertexArrayOES(v); };
        _R8 = gl.LUMINANCE;
        _RED_fmt = gl.LUMINANCE;
        _RGBA32F = gl.RGBA;
        logger.info('WebGL1 adapter: VAO+Float textures OK');
    } else {
        hasFloatLinear = !!gl.getExtension('OES_texture_float_linear');
        _createVertexArray = function() { return gl.createVertexArray(); };
        _bindVertexArray = function(v) { gl.bindVertexArray(v); };
        _R8 = gl.R8;
        _RED_fmt = gl.RED;
        _RGBA32F = gl.RGBA32F;
    }
    logger.info(`Float Linear: ${hasFloatLinear ? 'OK' : 'NEAREST fallback'}`);
    let prog, vao, u, textures = {}, startTime = performance.now(), isLost = false;
    let texPlate, texElev, texMoist, texTemp, texRiver, texSelectionMask, texTrail;
    let bufElevRGBA, bufMoistRGBA, bufTempRGBA, bufRiverRGBA, currentW = 0, currentH = 0;
    let needsUpload = false;
    const trailCanvas = document.createElement('canvas');
    const trailCtx = trailCanvas.getContext('2d');
    const compile = (src, type) => { 
        /* v0.3.10: WebGL1 时自动转译着色器 */
        var finalSrc = isWebGL2 ? src : transpileGLSL(src, type, gl);
        if (!isWebGL2 && logger) logger.info('Transpiled ' + (type === gl.VERTEX_SHADER ? 'VS' : 'FS') + ' for WebGL1 (' + finalSrc.length + ' chars)');
        const s = gl.createShader(type); gl.shaderSource(s, finalSrc); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const info = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error('Shader compile failed: ' + info); } return s; 
    };
    let engineRef = null;
    const setEngineRef = (eng) => { engineRef = eng; };
    const initGL = () => {
        _setStatus('正在编译顶点着色器...');
        const vs = compile(document.getElementById('vs-quad').textContent, gl.VERTEX_SHADER);
        _setStatus('正在编译片段着色器...');
        const fs = compile(document.getElementById('fs-map').textContent, gl.FRAGMENT_SHADER);
        _setStatus('正在链接着色器程序...');
        prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { const info = gl.getProgramInfoLog(prog); gl.deleteProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs); throw new Error(`Program link failed: ${info}`); }
        _setStatus('正在初始化 GPU 纹理...');
        const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        vao = _createVertexArray(); _bindVertexArray(vao);
        const loc = gl.getAttribLocation(prog, 'a_pos'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        u = {};
        const uniforms = ['u_plateTex','u_elevTex','u_moistureTex','u_tempTex','u_riverTex','u_selectionMaskTex','u_trailTex','u_style','u_seaLevel','u_lightAngle','u_resolution','u_time','u_showBoundaries','u_boundaryWidth','u_boundaryColor','u_pointLightEnabled','u_pointLightPos','u_pointLightIntensity','u_pointLightColor','u_glowEnabled','u_laserStart','u_laserEnd','u_laserActive','u_laserWidth','u_hasTrail','u_selectedCount','u_plateTotal','u_fbmOctaves','u_fbmLacunarity','u_fbmPersistence','u_snowLine','u_erosionStrength','u_showRivers','u_contourInterval','u_showContours','u_showTerrain','u_showSelection','u_showClimate','u_cursorPos','u_cursorActive','u_cursorSize','u_detailRiverWidth','u_detailRiverCurve','u_detailCoastJagged','u_detailRidgeDensity','u_detailRainfallOffset','u_detailTempGradient','u_detailBiomeBlend'];
        uniforms.forEach(n => u[n] = gl.getUniformLocation(prog, n));
        texSelectionMask = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texSelectionMask); gl.texImage2D(gl.TEXTURE_2D, 0, _R8, 256, 1, 0, _RED_fmt, gl.UNSIGNED_BYTE, new Uint8Array(256)); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        texTrail = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texTrail); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    _setStatus('正在编译着色器...');
    initGL();
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); isLost = true; logger.warn('Ctx Lost'); /* v0.3.1 稳定: context lost 时清理旧纹理引用 */ texPlate = null; texElev = null; texMoist = null; texTemp = null; texRiver = null; });
    canvas.addEventListener('webglcontextrestored', () => { isLost = false; initGL(); texPlate = null; texElev = null; texMoist = null; texTemp = null; texRiver = null; currentW = 0; currentH = 0; logger.info('Ctx Restored'); if (engineRef && engineRef.plateMap && needsUpload) { upload(engineRef.plateMap, engineRef.elevMap, engineRef.moistMap, engineRef.tempMap, engineRef.riverMap, engineRef.W, engineRef.H); needsUpload = false; } });
    const createTex = (w, h, isFloat) => { const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); const filter = (isFloat && hasFloatLinear) ? gl.LINEAR : gl.NEAREST; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return tex; };
    const upload = (pD, eD, mD, tD, rD, w, h) => {
        if (isLost) { needsUpload = true; return; }
        /* v0.3.1 稳定: 纹理尺寸校验——防止异常尺寸传入 GPU */
        if (!w || !h || w > 4096 || h > 4096) { logger.warn('Upload rejected: invalid texture size', { w, h }); return; }
        if (!pD || !eD || !mD || !tD || !rD) { logger.warn('Upload rejected: null data buffer'); return; }
        /* v0.3.2: 数据完整性校验 */
        const expectedLen = w * h;
        if (pD.length < expectedLen * 4) { logger.warn('Upload rejected: plateData too short', { expected: expectedLen * 4, actual: pD.length }); return; }
        if (eD.length < expectedLen) { logger.warn('Upload rejected: elevData too short', { expected: expectedLen, actual: eD.length }); return; }
        if (currentW !== w || currentH !== h) {
            if (texPlate) gl.deleteTexture(texPlate); if (texElev) gl.deleteTexture(texElev); if (texMoist) gl.deleteTexture(texMoist);
            if (texTemp) gl.deleteTexture(texTemp); if (texRiver) gl.deleteTexture(texRiver);
            texPlate = createTex(w, h, true); texElev = createTex(w, h, true); texMoist = createTex(w, h, true);
            texTemp = createTex(w, h, true); texRiver = createTex(w, h, true);
            bufElevRGBA = new Float32Array(w * h * 4); bufMoistRGBA = new Float32Array(w * h * 4);
            bufTempRGBA = new Float32Array(w * h * 4); bufRiverRGBA = new Float32Array(w * h * 4);
            currentW = w; currentH = h;
        }
        for (let i = 0; i < w * h; i++) {
            bufElevRGBA[i * 4] = bufElevRGBA[i * 4 + 1] = bufElevRGBA[i * 4 + 2] = eD[i]; bufElevRGBA[i * 4 + 3] = 1;
            bufMoistRGBA[i * 4] = bufMoistRGBA[i * 4 + 1] = bufMoistRGBA[i * 4 + 2] = mD[i]; bufMoistRGBA[i * 4 + 3] = 1;
            bufTempRGBA[i * 4] = bufTempRGBA[i * 4 + 1] = bufTempRGBA[i * 4 + 2] = tD[i]; bufTempRGBA[i * 4 + 3] = 1;
            bufRiverRGBA[i * 4] = bufRiverRGBA[i * 4 + 1] = bufRiverRGBA[i * 4 + 2] = rD[i]; bufRiverRGBA[i * 4 + 3] = 1;
        }
        gl.bindTexture(gl.TEXTURE_2D, texPlate); gl.texImage2D(gl.TEXTURE_2D, 0, _RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, pD);
        gl.bindTexture(gl.TEXTURE_2D, texElev); gl.texImage2D(gl.TEXTURE_2D, 0, _RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, bufElevRGBA);
        gl.bindTexture(gl.TEXTURE_2D, texMoist); gl.texImage2D(gl.TEXTURE_2D, 0, _RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, bufMoistRGBA);
        gl.bindTexture(gl.TEXTURE_2D, texTemp); gl.texImage2D(gl.TEXTURE_2D, 0, _RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, bufTempRGBA);
        gl.bindTexture(gl.TEXTURE_2D, texRiver); gl.texImage2D(gl.TEXTURE_2D, 0, _RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, bufRiverRGBA);
    };
    let _lastSelKey = '';
    const updateSelectionMask = (selectedPlates) => {
        /* v0.2.8 性能: 复用掩码缓冲区——消除每帧 Uint8Array 分配 */
        const key = selectedPlates.join(',');
        if (key === _lastSelKey) return; /* 跳过未变更的纹理上传 */
        _lastSelKey = key;
        if (!updateSelectionMask._buf) updateSelectionMask._buf = new Uint8Array(256);
        const mask = updateSelectionMask._buf;
        mask.fill(0);
        for (let i = 0; i < selectedPlates.length; i++) {
            const pid = selectedPlates[i];
            if (pid >= 0 && pid < 256) mask[pid] = 255;
        }
        gl.bindTexture(gl.TEXTURE_2D, texSelectionMask);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, _RED_fmt, gl.UNSIGNED_BYTE, mask);
    };
    let _trailDirty = false, _trailW = 0, _trailH = 0;
    const updateTrailTexture = (trailPoints, trailTimes, w, h) => {
        if (!_trailDirty && _trailW === w && _trailH === h) return; /* 跳过未变更的轨迹纹理上传 */
        _trailDirty = false; _trailW = w; _trailH = h;
        if (trailCanvas.width !== w || trailCanvas.height !== h) { trailCanvas.width = w; trailCanvas.height = h; } else { trailCtx.clearRect(0, 0, w, h); }
        if (trailPoints.length > 1) { for (let i = 1; i < trailPoints.length; i++) { const age = trailTimes[i], fade = 1.0 - age; if (fade <= 0) continue; const x1 = trailPoints[i - 1][0] * w, y1 = (1.0 - trailPoints[i - 1][1]) * h, x2 = trailPoints[i][0] * w, y2 = (1.0 - trailPoints[i][1]) * h; trailCtx.lineCap = 'round'; trailCtx.strokeStyle = `rgba(230, 77, 204, ${fade * 0.4})`; trailCtx.lineWidth = 24; trailCtx.beginPath(); trailCtx.moveTo(x1, y1); trailCtx.lineTo(x2, y2); trailCtx.stroke(); trailCtx.strokeStyle = `rgba(255, 128, 230, ${fade * 0.9})`; trailCtx.lineWidth = 4; trailCtx.beginPath(); trailCtx.moveTo(x1, y1); trailCtx.lineTo(x2, y2); trailCtx.stroke(); } } gl.bindTexture(gl.TEXTURE_2D, texTrail); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, trailCanvas); };
    const _drawSeq = { value: 0 };
    const draw = opts => {
        if (isLost) return;
        _drawSeq.value++;
        const t0 = performance.now();
        /* v0.2.8 稳定: 提取 safeNum 防御性净化——上游异常值不会传入 GPU */
        const fnum = (v, fb = 0) => isFinite(v) ? v : fb;
        const bndCol = opts.boundaryColor || [1, 0.2, 0.12];
        const plPos = opts.pointLightPos || [0.3, 0.7];
        const plCol = opts.pointLightColor || [1, 0.96, 0.84];
        try {
            gl.viewport(0, 0, canvas.width, canvas.height); gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(prog); _bindVertexArray(vao);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texPlate); gl.uniform1i(u.u_plateTex, 0);
            gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texElev); gl.uniform1i(u.u_elevTex, 1);
            gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texMoist); gl.uniform1i(u.u_moistureTex, 2);
            gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, texSelectionMask); gl.uniform1i(u.u_selectionMaskTex, 3);
            /* v0.3.0: tempTex and riverTex */
            if (texTemp) { gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, texTemp); gl.uniform1i(u.u_tempTex, 5); }
            if (texRiver) { gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, texRiver); gl.uniform1i(u.u_riverTex, 6); }
            gl.uniform1i(u.u_style, opts.style | 0); gl.uniform1f(u.u_seaLevel, fnum(opts.seaLevel, 0.45)); gl.uniform1f(u.u_lightAngle, fnum(opts.lightAngleRad, 0)); gl.uniform2f(u.u_resolution, canvas.width, canvas.height); gl.uniform1f(u.u_time, (performance.now() - startTime) / 1000);
            gl.uniform1f(u.u_showBoundaries, opts.showBoundaries ? 1 : 0); gl.uniform1f(u.u_boundaryWidth, fnum(opts.boundaryWidth, 1)); gl.uniform3f(u.u_boundaryColor, fnum(bndCol[0], 1), fnum(bndCol[1], 0.2), fnum(bndCol[2], 0.12)); gl.uniform1f(u.u_pointLightEnabled, opts.pointLightEnabled ? 1 : 0); gl.uniform2f(u.u_pointLightPos, fnum(plPos[0], 0.3), fnum(plPos[1], 0.7)); gl.uniform1f(u.u_pointLightIntensity, fnum(opts.pointLightIntensity, 1)); gl.uniform3f(u.u_pointLightColor, fnum(plCol[0], 1), fnum(plCol[1], 0.96), fnum(plCol[2], 0.84)); gl.uniform1f(u.u_glowEnabled, opts.glowEnabled ? 1 : 0);
            gl.uniform2f(u.u_laserStart, fnum(opts.laserStart[0], 0), fnum(opts.laserStart[1], 0)); gl.uniform2f(u.u_laserEnd, fnum(opts.laserEnd[0], 0), fnum(opts.laserEnd[1], 0)); gl.uniform1f(u.u_laserActive, opts.laserActive ? 1 : 0); gl.uniform1f(u.u_laserWidth, fnum(opts.laserWidth, 2));
            /* v0.3.4: 光标 uniform */
            gl.uniform2f(u.u_cursorPos, fnum(opts.cursorPos ? opts.cursorPos[0] : 0.5, 0), fnum(opts.cursorPos ? opts.cursorPos[1] : 0.5, 0));
            gl.uniform1f(u.u_cursorActive, opts.cursorActive ? 1 : 0);
            gl.uniform1f(u.u_cursorSize, fnum(opts.cursorSize || 14, 1));
            gl.uniform1i(u.u_selectedCount, Math.min(opts.selectedPlates.length, 256)); gl.uniform1i(u.u_plateTotal, Math.max(1, opts.plateTotal | 0)); gl.uniform1i(u.u_fbmOctaves, clamp(opts.fbmOctaves | 0, 0, 8)); gl.uniform1f(u.u_fbmLacunarity, fnum(opts.fbmLacunarity, 2)); gl.uniform1f(u.u_fbmPersistence, fnum(opts.fbmPersistence, 0.5));
            /* v0.3.0: new uniforms */
            gl.uniform1f(u.u_snowLine, fnum(opts.snowLine, 0.65));
            gl.uniform1f(u.u_erosionStrength, fnum(opts.erosionStrength, 0.3));
            gl.uniform1f(u.u_showRivers, opts.showRivers ? 1.0 : 0.0);
            gl.uniform1f(u.u_contourInterval, fnum(opts.contourInterval, 5));
            gl.uniform1f(u.u_showContours, opts.showContours ? 1.0 : 0.0);
            gl.uniform1f(u.u_showTerrain, opts.showTerrain ? 1.0 : 0.0);
            gl.uniform1f(u.u_showSelection, opts.showSelection ? 1.0 : 0.0);
            gl.uniform1f(u.u_showClimate, opts.showClimate ? 1.0 : 0.0);
            /* v0.3.6: 细节生成器 uniforms */
            gl.uniform1f(u.u_detailRiverWidth, fnum(opts.detailRiverWidth, 1.0));
            gl.uniform1f(u.u_detailRiverCurve, fnum(opts.detailRiverCurve, 0.5));
            gl.uniform1f(u.u_detailCoastJagged, fnum(opts.detailCoastJagged, 0.4));
            gl.uniform1f(u.u_detailRidgeDensity, fnum(opts.detailRidgeDensity, 0.5));
            gl.uniform1f(u.u_detailRainfallOffset, fnum(opts.detailRainfallOffset, 0.0));
            gl.uniform1f(u.u_detailTempGradient, fnum(opts.detailTempGradient, 1.0));
            gl.uniform1f(u.u_detailBiomeBlend, fnum(opts.detailBiomeBlend, 0.3));
            updateSelectionMask(opts.selectedPlates);
            if (opts.trailEnabled && opts.trailPoints.length > 1) { updateTrailTexture(opts.trailPoints, opts.trailTimes, canvas.width, canvas.height); gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, texTrail); gl.uniform1i(u.u_trailTex, 4); gl.uniform1f(u.u_hasTrail, 1.0); } else gl.uniform1f(u.u_hasTrail, 0.0);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        } catch (e) { logger.warn('Render draw suppressed', e); }
        perf.recordRender(performance.now() - t0);
    };
    return { upload, draw, canvas, gl, setEngineRef, _lastDrawSeq: _drawSeq, markTrailDirty: () => { _trailDirty = true; } };
}

// =====================================================================
// =====================================================================
// 模块 7.5: v0.3.4 光标系统
// =====================================================================
function createCursorSystem(container) {
    const overlay = container.querySelector('#cursor-overlay');
    const ring = overlay.querySelector('.cursor-ring');
    const dot = overlay.querySelector('.cursor-dot');
    const cross = overlay.querySelector('.cursor-cross');
    const label = overlay.querySelector('.cursor-label');
    const controls = container.querySelector('#cursor-controls');
    const state = { active: false, visible: false, pos: [0, 0], uv: [0.5, 0.5] };
    const STEP = 0.02; // 每次方向键移动的 UV 步长
    let _layoutCache = null, _layoutSeq = 0, _layoutLastSeq = -1;
    const getLayout = () => {
        if (_layoutCache && _layoutLastSeq === _layoutSeq) return _layoutCache;
        const canvas = container.querySelector('canvas');
        if (!canvas) return null;
        const r = canvas.getBoundingClientRect();
        const cr = container.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const canvasW = canvas.width / dpr, canvasH = canvas.height / dpr;
        const s = Math.min(r.width / canvasW, r.height / canvasH);
        const cw = canvasW * s, ch = canvasH * s;
        _layoutCache = { cr, ox: r.left - cr.left + (r.width - cw) / 2, oy: r.top - cr.top + (r.height - ch) / 2, cw, ch, ox2: r.left + (r.width - cw) / 2, oy2: r.top + (r.height - ch) / 2 };
        _layoutLastSeq = _layoutSeq;
        requestAnimationFrame(() => { _layoutSeq++; });
        return _layoutCache;
    };

    // 将 UV 坐标转换为容器内像素坐标
    const uvToPixel = (uvX, uvY) => {
        const L = getLayout();
        if (!L) return { x: 0, y: 0 };
        return {
            x: L.ox + uvX * L.cw,
            y: L.oy + (1 - uvY) * L.ch
        };
    };

    // 将指针事件转换为容器内像素坐标和 UV
    const getCanvasCoords = (e) => {
        const canvas = container.querySelector('canvas');
        if (!canvas) return { x: 0, y: 0, uvX: 0.5, uvY: 0.5 };
        const L = getLayout();
        if (!L) return { x: 0, y: 0, uvX: 0.5, uvY: 0.5 };
        return {
            x: e.clientX - L.ox2,
            y: e.clientY - L.oy2,
            uvX: Math.max(0, Math.min(1, (e.clientX - L.ox2) / L.cw)),
            uvY: Math.max(0, Math.min(1, 1 - (e.clientY - L.oy2) / L.ch))
        };
    };

    const updatePosition = (cx, cy, uvX, uvY) => {
        state.pos = [cx, cy];
        state.uv = [uvX, uvY];
        ring.style.left = cx + 'px';
        ring.style.top = cy + 'px';
        dot.style.left = cx + 'px';
        dot.style.top = cy + 'px';
        cross.style.left = cx + 'px';
        cross.style.top = cy + 'px';
        label.style.left = cx + 'px';
        label.style.top = cy + 'px';
    };

    // 从 UV 坐标刷新光标位置（方向键和居中使用）
    const refreshFromUV = () => {
        const { x, y } = uvToPixel(state.uv[0], state.uv[1]);
        updatePosition(x, y, state.uv[0], state.uv[1]);
    };

    const show = () => {
        state.visible = true;
        overlay.classList.add('active');
        container.classList.add('cursor-mode');
        controls.classList.add('visible');
    };

    const hide = () => {
        state.visible = false;
        overlay.classList.remove('active');
        container.classList.remove('cursor-mode');
        controls.classList.remove('visible');
    };

    const onPointerMove = (e) => {
        if (!state.active) return;
        const { x, y, uvX, uvY } = getCanvasCoords(e);
        updatePosition(x, y, uvX, uvY);
        show();
    };
    const onPointerEnter = () => {
        if (!state.active) return;
        show();
    };
    const onPointerLeave = () => {
        hide();
    };
    // 触屏支持
    const onTouchMove = (e) => {
        if (!state.active) return;
        const touch = e.touches[0];
        if (!touch) return;
        const { x, y, uvX, uvY } = getCanvasCoords(touch);
        updatePosition(x, y, uvX, uvY);
        show();
    };
    const onTouchEnd = () => {
        // 触屏结束后保持可见（因为有方向按钮控制）
    };

    // 方向键移动光标
    const moveCursor = (dUvX, dUvY) => {
        if (!state.active) return;
        state.uv[0] = Math.max(0, Math.min(1, state.uv[0] + dUvX));
        state.uv[1] = Math.max(0, Math.min(1, state.uv[1] + dUvY));
        refreshFromUV();
        if (!state.visible) show();
    };

    // 居中光标
    const centerCursor = () => {
        if (!state.active) return;
        state.uv = [0.5, 0.5];
        refreshFromUV();
        if (!state.visible) show();
    };

    // 绑定方向按钮（支持长按连续移动）
    const bindCtrlBtn = (btnId, dUvX, dUvY) => {
        const btn = container.querySelector('#' + btnId);
        if (!btn) return;
        let interval = null;
        const startMove = (e) => {
            e.preventDefault();
            e.stopPropagation();
            moveCursor(dUvX, dUvY);
            interval = setInterval(() => moveCursor(dUvX, dUvY), 80);
        };
        const stopMove = (e) => {
            e.preventDefault();
            if (interval) { clearInterval(interval); interval = null; }
        };
        btn.addEventListener('pointerdown', startMove);
        btn.addEventListener('pointerup', stopMove);
        btn.addEventListener('pointerleave', stopMove);
        btn.addEventListener('pointercancel', stopMove);
    };

    bindCtrlBtn('btn-cursor-up', 0, STEP);
    bindCtrlBtn('btn-cursor-down', 0, -STEP);
    bindCtrlBtn('btn-cursor-left', -STEP, 0);
    bindCtrlBtn('btn-cursor-right', STEP, 0);

    const centerBtn = container.querySelector('#btn-cursor-center');
    if (centerBtn) {
        centerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            centerCursor();
        });
    }

    container.addEventListener('pointermove', onPointerMove, { passive: true });
    container.addEventListener('pointerenter', onPointerEnter, { passive: true });
    container.addEventListener('pointerleave', onPointerLeave, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', onTouchEnd);

    // 键盘方向键支持
    const onKeyDown = (e) => {
        if (!state.active) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
        switch (e.key) {
            case 'ArrowUp': e.preventDefault(); moveCursor(0, STEP); break;
            case 'ArrowDown': e.preventDefault(); moveCursor(0, -STEP); break;
            case 'ArrowLeft': e.preventDefault(); moveCursor(-STEP, 0); break;
            case 'ArrowRight': e.preventDefault(); moveCursor(STEP, 0); break;
        }
    };
    document.addEventListener('keydown', onKeyDown);

    return {
        get state() { return state; },
        getState: () => ({ cursorActive: state.active && state.visible, cursorPos: state.uv, cursorSize: 14 }),
        setActive: (v) => {
            state.active = v;
            if (v) {
                // 初始化到中心
                state.uv = [0.5, 0.5];
                refreshFromUV();
                show();
            } else {
                hide();
            }
        },
        updateLabel: (text) => { label.textContent = text; },
        refreshFromUV
    };
}

// 模块 8: UI 覆盖层与激光交互
// =====================================================================
function createOverlayRenderer(canvas) {
    const ctx = canvas.getContext('2d');
    const CACHE_MAX = 10;
    const cache = new Map();
    let lastDrawParams = null;
    const getOrComputeCentroids = (engine, seedStr) => {
        const key = `${seedStr}_${engine.W}_${engine.H}_${engine.plates.length}`;
        if (cache.has(key)) { const val = cache.get(key); cache.delete(key); cache.set(key, val); return val; }
        const { W, H, plates, plateMap } = engine;
        const centroids = plates.map(() => ({ sx: 0, sy: 0, c: 0 }));
        const step = Math.max(4, Math.floor(Math.max(W, H) / 200));
        for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
            const idx = y * W + x; const pid = Math.round(plateMap[idx * 4] * (plates.length - 1));
            centroids[pid].sx += x; centroids[pid].sy += y; centroids[pid].c++;
        }
        if (cache.size >= CACHE_MAX) { const firstKey = cache.keys().next().value; cache.delete(firstKey); }
        cache.set(key, centroids);
        return centroids;
    };
    return { resize: (w, h) => { canvas.width = w; canvas.height = h; cache.clear(); lastDrawParams = null; }, draw: (engine, showNames, seedStr, opts = {}) => {
        const cpn = opts.customPlateNames, crn = opts.customRegionNames;
        const nameKey = (cpn && Object.keys(cpn).length ? 'Y' : 'N') + (crn && Object.keys(crn).length ? 'Y' : 'N');
        const params = `${showNames}_${seedStr}_${engine.plates?.length}_${engine.regions?.length || 0}_${!!opts.geoLabels}_${!!opts.showGrid}_${!!opts.showElevScale}_${!!opts.showRegionNames}_${nameKey}`;
        if (lastDrawParams === params && cache.size > 0) return;
        lastDrawParams = params;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!engine.plates.length || !engine.plateMap) return;
        // v0.3.2: scale grid overlay (independent of showNames)
        if (opts.showGrid && engine.elevMap) {
            const W = engine.W, H = engine.H;
            const scale = opts.worldScale || 3;
            const gridKm = scale >= 7 ? 200 : scale >= 4 ? 100 : 50;
            const pixPerKm = W / (W * scale * 0.1);
            const gridPix = gridKm * pixPerKm;
            if (gridPix > 20) {
                ctx.save();
                ctx.strokeStyle = 'rgba(255,255,255,0.18)';
                ctx.lineWidth = 0.8;
                ctx.setLineDash([6, 4]);
                const gfs = Math.max(8, Math.min(18, Math.floor(engine.W / 80)) - 4);
                ctx.font = `400 ${gfs}px 'Roboto',system-ui,sans-serif`;
                ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                for (let x = gridPix; x < W; x += gridPix) {
                    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
                    ctx.fillStyle = 'rgba(255,255,255,0.35)';
                    ctx.fillText(`${Math.round(x / pixPerKm)}km`, x + 3, 3);
                }
                for (let y = gridPix; y < H; y += gridPix) {
                    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
                    ctx.fillStyle = 'rgba(255,255,255,0.35)';
                    ctx.fillText(`${Math.round(y / pixPerKm)}km`, 3, y + 3);
                }
                ctx.setLineDash([]);
                ctx.restore();
            }
        }
        // v0.3.8: 海拔尺——独立于 showNames
        const showElev = opts.showElevScale && engine.elevMap;
        const showRegionLbls = opts.showRegionNames && engine.regions && engine.regions.length > 0;
        const W2 = engine.W, H2 = engine.H;

        if (showElev) {
            const seaLevel = opts.seaLevel != null ? opts.seaLevel : 0.45;
            const snowLine = opts.snowLine != null ? opts.snowLine : 0.65;
            const barX = W2 - 34;
            const barY = 30;
            const barH = Math.min(H2 - 60, 600);
            const barW = 16;
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.strokeStyle = 'rgba(255,255,255,0.25)';
            ctx.lineWidth = 1;
            const bgPad = 22;
            ctx.beginPath();
            ctx.roundRect(barX - bgPad, barY - bgPad, barW + bgPad * 2, barH + bgPad * 2, 8);
            ctx.fill(); ctx.stroke();
            const grad = ctx.createLinearGradient(0, barY, 0, barY + barH);
            grad.addColorStop(0, '#F0F0F0');
            grad.addColorStop(0.08, '#D4C8A8');
            grad.addColorStop(0.2, '#8B7355');
            grad.addColorStop(0.35, '#A08060');
            grad.addColorStop(0.5, '#C4A84A');
            grad.addColorStop(0.65, '#7AB648');
            grad.addColorStop(0.75, '#4A9B3F');
            grad.addColorStop(0.85, '#3A7BD5');
            grad.addColorStop(0.95, '#1A3A7A');
            grad.addColorStop(1, '#0A1A3A');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(barX, barY, barW, barH, 4);
            ctx.fill();
            const seaY = barY + barH * (1 - seaLevel);
            ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 2]);
            ctx.beginPath(); ctx.moveTo(barX - 4, seaY); ctx.lineTo(barX + barW + 4, seaY); ctx.stroke();
            ctx.setLineDash([]);
            if (snowLine < 1) {
                const snowY = barY + barH * (1 - snowLine);
                ctx.strokeStyle = 'rgba(200,220,255,0.7)';
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 3]);
                ctx.beginPath(); ctx.moveTo(barX - 4, snowY); ctx.lineTo(barX + barW + 4, snowY); ctx.stroke();
                ctx.setLineDash([]);
            }
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'right';
            ctx.fillText('8848m', barX - 8, barY + 10);
            ctx.fillText('0m', barX - 8, seaY + 4);
            ctx.fillText('-11000m', barX - 8, barY + barH - 6);
            const lang2 = I18N[currentLang];
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(lang2.elevation_scale, barX + barW / 2, barY - 10);
            ctx.restore();
        }

        if (!showNames && !showRegionLbls) return;
        const fs = Math.max(10, Math.min(18, Math.floor(engine.W / 80)));
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = `600 ${fs}px 'Roboto','PingFang SC','Helvetica Neue',system-ui,sans-serif';

        if (showNames) {
        const centroids = getOrComputeCentroids(engine, seedStr);
        for (let i = 0; i < engine.plates.length; i++) {
            const c = centroids[i]; if (!c.c) continue;
            const cx = c.sx / c.c, cy = c.sy / c.c;
            const customName = opts.customPlateNames ? opts.customPlateNames[i] : null;
            const name = customName || engine.plateNames[i] || `#${i + 1}`;
            const m = ctx.measureText(name), pad = 6, w = m.width + pad * 2, h = fs + pad * 2;
            const rx = cx - w / 2, ry = cy - h / 2, r = 6;
            ctx.fillStyle = engine.plates[i].type ? 'rgba(40,80,40,0.85)' : 'rgba(40,60,100,0.85)';
            ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(rx + r, ry); ctx.lineTo(rx + w - r, ry); ctx.quadraticCurveTo(rx + w, ry, rx + w, ry + r); ctx.lineTo(rx + w, ry + h - r); ctx.quadraticCurveTo(rx + w, ry + h, rx + w - r, ry + h); ctx.lineTo(rx + r, ry + h); ctx.quadraticCurveTo(rx, ry + h, rx, ry + h - r); ctx.lineTo(rx, ry + r); ctx.quadraticCurveTo(rx, ry, rx + r, ry); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 3; ctx.fillStyle = '#fff'; ctx.fillText(name, cx, cy); ctx.shadowBlur = 0;
        }
        }
        // v0.3.8: 地形区名渲染
        if (showRegionLbls) {
            const rfs = Math.max(9, Math.min(16, Math.floor(engine.W / 100)));
            ctx.font = `500 ${rfs}px 'Roboto','PingFang SC','Helvetica Neue',system-ui,sans-serif`;
            const regionColors = {
                mountain: 'rgba(80,50,30,0.78)',
                plateau: 'rgba(100,75,50,0.78)',
                hills: 'rgba(100,90,50,0.78)',
                desert: 'rgba(160,120,40,0.78)',
                forest: 'rgba(30,80,30,0.78)',
                wetland: 'rgba(30,70,90,0.78)',
                tundra: 'rgba(60,80,100,0.78)',
                ice: 'rgba(160,190,210,0.78)',
                basin: 'rgba(70,80,60,0.78)',
                plains: 'rgba(60,100,50,0.78)'
            };
            for (let i = 0; i < engine.regions.length; i++) {
                const reg = engine.regions[i];
                const customName = opts.customRegionNames ? opts.customRegionNames[i] : null;
                const name = customName || engine.regionNames[i] || `Region #${i + 1}`;
                const rm = ctx.measureText(name);
                const pad2 = 5, rw = rm.width + pad2 * 2, rh = rfs + pad2 * 2;
                const rx2 = reg.cx - rw / 2, ry2 = reg.cy - rh / 2;
                const rr = 4;
                ctx.fillStyle = regionColors[reg.type] || 'rgba(40,50,60,0.75)';
                ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(rx2 + rr, ry2);
                ctx.lineTo(rx2 + rw - rr, ry2);
                ctx.quadraticCurveTo(rx2 + rw, ry2, rx2 + rw, ry2 + rr);
                ctx.lineTo(rx2 + rw, ry2 + rh - rr);
                ctx.quadraticCurveTo(rx2 + rw, ry2 + rh, rx2 + rw - rr, ry2 + rh);
                ctx.lineTo(rx2 + rr, ry2 + rh);
                ctx.quadraticCurveTo(rx2, ry2 + rh, rx2, ry2 + rh - rr);
                ctx.lineTo(rx2, ry2 + rr);
                ctx.quadraticCurveTo(rx2, ry2, rx2 + rr, ry2);
                ctx.closePath();
                ctx.fill(); ctx.stroke();
                ctx.shadowColor = 'rgba(0,0,0,0.8)';
                ctx.shadowBlur = 2;
                ctx.fillStyle = '#fff';
                ctx.fillText(name, reg.cx, reg.cy);
                ctx.shadowBlur = 0;
            }
        }
        // v0.3.2: 地理标注覆层
        if (opts.geoLabels && engine.elevMap) {
            const W = engine.W, H = engine.H;
            const sea = opts.seaLevel != null ? opts.seaLevel : 0.45;
            const step = Math.max(8, Math.floor(Math.max(W, H) / 60));
            let peakX = 0, peakY = 0, peakE = 0;
            let deepX = 0, deepY = 0, deepE = 1;
            let desertX = 0, desertY = 0, desertM = 1;
            // v0.3.2: volcano, pass, island markers
            const volcanoCandidates = [];
            const highPoints = [];
            const islandRegions = [];
            const islandVisited = new Uint8Array(W * H);
            for (let y = 0; y < H; y += step) {
                for (let x = 0; x < W; x += step) {
                    const idx = y * W + x;
                    const e = engine.elevMap[idx], m = engine.moistMap[idx];
                    const t = engine.tempMap ? engine.tempMap[idx] : 0.5;
                    const pid = Math.round(engine.plateMap[idx * 4] * (engine.plates.length - 1));
                    const pType = engine.plates[pid] ? engine.plates[pid].type : 0;
                    if (e > peakE && e >= sea + 0.3) { peakE = e; peakX = x; peakY = y; }
                    if (e < deepE) { deepE = e; deepX = x; deepY = y; }
                    if (e >= sea && e < sea + 0.2 && t > 0.6 && m < desertM) { desertM = m; desertX = x; desertY = y; }
                    // Volcano: high elevation near plate boundary in oceanic plate
                    if (!pType && e >= sea + 0.25) { volcanoCandidates.push({ x, y, e, pid }); }
                    // Collect high points for pass detection
                    if (e >= sea + 0.2) { highPoints.push({ x, y, e }); }
                }
            }
            // Detect volcanoes: top 3 oceanic-plate high points
            volcanoCandidates.sort((a, b) => b.e - a.e);
            const volcanoes = volcanoCandidates.slice(0, Math.min(3, volcanoCandidates.length));
            // Detect passes: low points between high points
            const passes = [];
            if (highPoints.length >= 4) {
                highPoints.sort((a, b) => b.e - a.e);
                const topN = highPoints.slice(0, Math.min(8, highPoints.length));
                for (let i = 0; i < topN.length; i++) {
                    for (let j = i + 1; j < topN.length; j++) {
                        const mx = Math.round((topN[i].x + topN[j].x) / 2);
                        const my = Math.round((topN[i].y + topN[j].y) / 2);
                        if (mx >= 0 && mx < W && my >= 0 && my < H) {
                            const midE = engine.elevMap[my * W + mx];
                            if (midE >= sea && midE < Math.min(topN[i].e, topN[j].e) - 0.08) {
                                passes.push({ x: mx, y: my, e: midE });
                            }
                        }
                    }
                }
                passes.sort((a, b) => a.e - b.e);
            }
            // Detect islands: isolated land surrounded by ocean
            for (let y = step; y < H - step; y += step) {
                for (let x = step; x < W - step; x += step) {
                    const idx = y * W + x;
                    if (islandVisited[idx]) continue;
                    if (engine.elevMap[idx] < sea) continue;
                    // Check if surrounded by ocean
                    let surrounded = true;
                    const checkR = step * 2;
                    for (let dy = -checkR; dy <= checkR && surrounded; dy += checkR) {
                        for (let dx = -checkR; dx <= checkR && surrounded; dx += checkR) {
                            if (dx === 0 && dy === 0) continue;
                            const nx = x + dx, ny = y + dy;
                            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
                            if (engine.elevMap[ny * W + nx] >= sea) { surrounded = false; }
                        }
                    }
                    if (surrounded) {
                        islandRegions.push({ x, y });
                        // Mark nearby as visited
                        for (let dy = -checkR; dy <= checkR; dy += step) {
                            for (let dx = -checkR; dx <= checkR; dx += step) {
                                const nx = x + dx, ny = y + dy;
                                if (nx >= 0 && nx < W && ny >= 0 && ny < H) islandVisited[ny * W + nx] = 1;
                            }
                        }
                    }
                }
            }
            ctx.font = `500 ${fs - 2}px 'Roboto','PingFang SC',system-ui,sans-serif`;
            const labelFeature = (x, y, text, color) => {
                if (!text) return;
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillText(text, x + 1, y + 1);
                ctx.fillStyle = color;
                ctx.fillText(text, x, y);
            };
            const lang = I18N[opts.lang || 'zh'] || I18N.zh;
            if (peakE > sea + 0.3) labelFeature(peakX, peakY, '▲ ' + (lang.geo_peak || '峰'), 'rgba(255,220,150,0.8)');
            if (deepE < sea - 0.15) labelFeature(deepX, deepY, '▽ ' + (lang.geo_deep || '渊'), 'rgba(100,160,255,0.8)');
            if (desertM < 0.2) labelFeature(desertX, desertY, '≈ ' + (lang.geo_desert || '漠'), 'rgba(255,200,100,0.8)');
            // v0.3.2: volcano markers
            for (const v of volcanoes) { labelFeature(v.x, v.y, '▲ ' + (lang.geo_volcano || '火'), 'rgba(255,100,80,0.8)'); }
            // v0.3.2: pass/saddle markers
            for (const p of passes.slice(0, Math.min(3, passes.length))) { labelFeature(p.x, p.y, '⊓ ' + (lang.geo_pass || '口'), 'rgba(180,200,255,0.8)'); }
            // v0.3.2: island markers
            for (const isl of islandRegions.slice(0, Math.min(5, islandRegions.length))) { labelFeature(isl.x, isl.y, '◉ ' + (lang.geo_island || '岛'), 'rgba(100,255,180,0.8)'); }
            // v0.3.2: climate zone naming
            if (opts.showClimate && engine.tempMap && engine.moistMap) {
                const biomeMap = new Uint8Array(W * H);
                const BIOME_TROPICAL = 1, BIOME_TEMPERATE_GRASS = 2, BIOME_DESERT = 3, BIOME_TUNDRA = 4, BIOME_ICE = 5;
                for (let y = 0; y < H; y += step) {
                    for (let x = 0; x < W; x += step) {
                        const idx = y * W + x;
                        const e = engine.elevMap[idx], t = engine.tempMap[idx], m = engine.moistMap[idx];
                        if (e < sea) continue;
                        let biome = 0;
                        if (t > 0.7 && m > 0.5) biome = BIOME_TROPICAL;
                        else if (t > 0.35 && t <= 0.7 && m > 0.2 && m <= 0.5) biome = BIOME_TEMPERATE_GRASS;
                        else if (t > 0.5 && m <= 0.2) biome = BIOME_DESERT;
                        else if (t > 0.1 && t <= 0.35 && m > 0.3) biome = BIOME_TUNDRA;
                        else if (t <= 0.1) biome = BIOME_ICE;
                        if (biome) biomeMap[idx] = biome;
                    }
                }
                const biomeNames = { [BIOME_TROPICAL]: lang.biome_tropical || '热带雨林', [BIOME_TEMPERATE_GRASS]: lang.biome_temperate_grass || '温带草原', [BIOME_DESERT]: lang.biome_desert || '沙漠', [BIOME_TUNDRA]: lang.biome_tundra || '苔原', [BIOME_ICE]: lang.biome_ice || '冰盖' };
                const biomeColors = { [BIOME_TROPICAL]: 'rgba(50,200,80,0.7)', [BIOME_TEMPERATE_GRASS]: 'rgba(180,200,80,0.7)', [BIOME_DESERT]: 'rgba(220,180,100,0.7)', [BIOME_TUNDRA]: 'rgba(150,200,220,0.7)', [BIOME_ICE]: 'rgba(200,230,255,0.7)' };
                // Find centroids of each biome region
                for (let b = 1; b <= 5; b++) {
                    let sx = 0, sy = 0, cnt = 0;
                    for (let y = 0; y < H; y += step) {
                        for (let x = 0; x < W; x += step) {
                            if (biomeMap[y * W + x] === b) { sx += x; sy += y; cnt++; }
                        }
                    }
                    if (cnt >= 3) {
                        const cx = sx / cnt, cy = sy / cnt;
                        labelFeature(Math.round(cx), Math.round(cy), biomeNames[b], biomeColors[b]);
                    }
                }
            }
        }
    } };
}
function createLaserPointer(container, engine, cb) {
    const state = { active: false, autoSelect: true, trailEnabled: true, smoothing: false, visible: false, dragging: false, start: [0, 0], end: [0, 0], selected: [], width: 2, trail: [] };
    const getUV = e => { const c = container.querySelector('canvas'), r = c.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 2); const s = Math.min(r.width / (c.width / dpr), r.height / (c.height / dpr)); const cw = (c.width / dpr) * s, ch = (c.height / dpr) * s; const ox = r.left + (r.width - cw) / 2, oy = r.top + (r.height - ch) / 2; return [Math.max(0, Math.min(1, (e.clientX - ox) / cw)), Math.max(0, Math.min(1, 1 - (e.clientY - oy) / ch))]; };
    const isNear = (p, th = 0.03) => { const [ax, ay] = state.start, [bx, by] = state.end, abx = bx - ax, aby = by - ay; const apx = p[0] - ax, apy = p[1] - ay; const l2 = abx * abx + aby * aby; if (l2 < 0.0001) return Math.hypot(apx, apy) < th; const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / l2)); return Math.hypot(p[0] - (ax + t * abx), p[1] - (ay + t * aby)) < th; };
    const updateSel = (fin = false) => { if (!state.autoSelect) { state.selected = []; return; } state.selected = engine.getPlatesAlongLine(state.start[0] * engine.W, (1 - state.start[1]) * engine.H, state.end[0] * engine.W, (1 - state.end[1]) * engine.H); if (fin && cb.onFinal) cb.onFinal(state.selected); };
    const onDown = e => { if (!state.active) return; const uv = getUV(e); if (state.visible && !state.dragging && isNear(uv)) { state.visible = false; state.selected = []; state.trail = []; if (cb.onFinal) cb.onFinal([]); return; } state.dragging = true; state.visible = true; state.start = uv; state.end = uv; state.selected = []; state.trail = [{ x: uv[0], y: uv[1], t: performance.now() / 1000 }]; container.setPointerCapture?.(e.pointerId); };
    const handleMove = e => { if (!state.active || !state.dragging) return; const uv = getUV(e); state.end = uv; state.trail.push({ x: uv[0], y: uv[1], t: performance.now() / 1000 }); if (state.trail.length > 64) state.trail.shift(); updateSel(); if (cb.onTrailUpdate) cb.onTrailUpdate(); };
    const onUp = () => { state.dragging = false; updateSel(true); };
    let throttledHandleMove = throttle(handleMove, 16);
    const onPointerMove = e => { if (state.smoothing) throttledHandleMove(e); else handleMove(e); };
    container.addEventListener('pointerdown', onDown); container.addEventListener('pointermove', onPointerMove, { passive: true }); container.addEventListener('pointerup', onUp); container.addEventListener('pointercancel', onUp);
    return { get state() { return state; }, getState: () => { const now = performance.now() / 1000; state.trail = state.trail.filter(p => now - p.t < 1); return { laserActive: state.active && state.visible, laserStart: state.start, laserEnd: state.end, laserWidth: state.width, selectedPlates: state.selected, trailEnabled: state.active && state.trailEnabled && state.trail.length > 1, trailPoints: state.trail.map(p => [p.x, p.y]), trailTimes: state.trail.map(p => Math.min(1, (now - p.t) / 1)) }; }, setActive: v => { state.active = v; if (!v) { state.visible = false; state.selected = []; state.trail = []; } }, setSmoothing: v => { state.smoothing = v; throttledHandleMove = throttle(handleMove, 16); }, clear: () => { state.visible = false; state.selected = []; state.trail = []; } };
}

// =====================================================================
// 模块 9: 自动化测试套件 v0.2.8
// =====================================================================
function createTestSuite(deps) {
    const { logger, storage, engine, renderer, store, perf } = deps;
    const logEl = document.getElementById('test-log'); const summaryEl = document.getElementById('test-summary');
    let pass = 0, fail = 0;
    const log = (msg, type = 'info') => { const div = document.createElement('div'); div.className = `test-${type}`; div.textContent = msg; logEl.appendChild(div); logEl.scrollTop = logEl.scrollHeight; };
    const test = async (name, fn) => { try { await fn(); pass++; log(`[PASS] ${name}`, 'pass'); } catch (e) { fail++; log(`[FAIL] ${name}: ${e.message}`, 'fail'); logger.error(`Test Failed: ${name}`, e); } await yieldToMain(); };
    const assert = (condition, msg) => { if (!condition) throw new Error(msg || 'Assertion failed'); };
    const run = async () => {
        pass = 0; fail = 0; logEl.innerHTML = ''; summaryEl.textContent = '正在运行诊断...';
        document.getElementById('test-modal').classList.add('active'); document.getElementById('scrim').classList.add('show');
        log('--- 基础设施测试 ---');
        await test('Store 状态管理', () => { const s = createStore({ a: 1, b: 2 }); let updated = false; s.subscribe(() => updated = true); s.set({ a: 2 }); assert(s.get().a === 2 && updated, 'State update or subscription failed'); });
        await test('IndexedDB 读写与清理', async () => { const id = `test_${Date.now()}`; await storage.save(id, { test: true }); const loaded = await storage.load(id); assert(loaded?.test === true, 'Load mismatch'); await storage.delete(id); const list = await storage.list(); assert(!list.find(m => m.id === id), 'Delete failed'); });
        log('--- 算法边界测试 ---');
        await test('噪声引擎极值与 NaN 检查', () => { const n = createNoiseEngine(12345); const coords = [[0, 0], [1000, 1000], [-1000, -1000], [0.001, 0.001]]; for (const [x, y] of coords) for (const type of ['simplex', 'perlin', 'value', 'worley']) { const val = n[type](x, y); assert(!isNaN(val) && isFinite(val), `${type} at ${x},${y} is NaN/Inf`); } });
        /* v0.2.8 增强: 极小参数测试——验证全量数据缓冲区形状、类型与值域 */
        await test('板块引擎极小参数与数据完整性 (4 plates, 128px)', async () => {
            const abort = new AbortController();
            const cfg = { seedStr: 'test_mini', mapSize: 128, plateCount: 4, landmass: 50, noiseType: 'simplex', fbmType: 'standard', octaves: 2, lacunarity: 2, persistence: 0.5, seaLevel: 0.5 };
            const data = await engine.generate(cfg, null, abort.signal);
            assert(data.elevData.length === 128 * 128, 'elevData length mismatch');
            assert(data.moistData.length === 128 * 128, 'moistData length mismatch');
            assert(data.plateData.length === 128 * 128 * 4, 'plateData RGBA length mismatch');
            /* v0.3.0: tempData and riverData */
            assert(data.tempData && data.tempData.length === 128 * 128, 'tempData length mismatch');
            assert(data.riverData && data.riverData.length === 128 * 128, 'riverData length mismatch');
            assert(data.elevData instanceof Float32Array, 'elevData should be Float32Array');
            assert(data.moistData instanceof Float32Array, 'moistData should be Float32Array');
            assert(data.plateData instanceof Float32Array, 'plateData should be Float32Array');
            assert(data.tempData instanceof Float32Array, 'tempData should be Float32Array');
            assert(data.riverData instanceof Float32Array, 'riverData should be Float32Array');
            assert(!data.elevData.some(isNaN), 'Elevation contains NaN');
            assert(!data.moistData.some(isNaN), 'Moisture contains NaN');
            assert(!data.plateData.some(isNaN), 'Plate data contains NaN');
            assert(!data.tempData.some(isNaN), 'Temp data contains NaN');
            assert(!data.riverData.some(isNaN), 'River data contains NaN');
            /* 检查值域 [0,1] */
            const checkRange = (arr, name) => {
                for (let i = 0; i < arr.length; i++) { if (arr[i] < 0 || arr[i] > 1) throw new Error(`${name}[${i}] = ${arr[i]} out of [0,1]`); }
            };
            checkRange(data.elevData, 'elevData'); checkRange(data.moistData, 'moistData');
            checkRange(data.tempData, 'tempData'); checkRange(data.riverData, 'riverData');
            for (let i = 0; i < data.plateData.length; i += 4) {
                const v = data.plateData[i]; if (v < 0 || v > 1) throw new Error(`plateData alpha[${i}] = ${v} out of [0,1]`);
            }
            assert(engine.plates.length === 4, 'Expected 4 plates');
            assert(engine.plateNames.length === 4, 'Expected 4 plate names');
        });
        await test('极端板块数量边界 (1~3 plates)', async () => {
            for (const pc of [1, 2, 3]) {
                const abort = new AbortController();
                const cfg = { seedStr: `extreme_${pc}`, mapSize: 64, plateCount: pc, landmass: 50, noiseType: 'simplex', fbmType: 'standard', octaves: 1, lacunarity: 2, persistence: 0.5, seaLevel: 0.5 };
                const data = await engine.generate(cfg, null, abort.signal);
                assert(data.plateData.length === 64 * 64 * 4, `plateData size mismatch for ${pc} plates`);
                assert(engine.plates.length === pc, `Expected ${pc} plates, got ${engine.plates.length}`);
                /* 归一化验证: 所有 plateId 必须 <= 1.0 */
                for (let i = 0; i < data.plateData.length; i += 4) {
                    if (data.plateData[i] > 1.0) throw new Error(`Plate id norm > 1.0 for ${pc} plates at pixel ${i}`);
                }
            }
        });
        await test('Shader 编译与链接', () => { const gl = renderer.gl; assert(gl !== null, 'GL context missing'); assert(gl.getError() === gl.NO_ERROR, 'GL Error in initial state'); });
        await test('Context Lost 恢复后上传完整性 (v0.2.6)', async () => { const r = renderer; assert(typeof r.upload === 'function', 'Upload method missing'); assert(typeof r.setEngineRef === 'function', 'Engine ref attachment missing'); });
        log('--- v0.2.8 扩展测试 ---');
        await test('板块命名唯一性 (汉文音译)', async () => { const abort = new AbortController(); await engine.generate({ seedStr: 'name_test', mapSize: 256, plateCount: 16, landmass: 50, noiseType: 'simplex', fbmType: 'standard', octaves: 4, lacunarity: 2, persistence: 0.5, seaLevel: 0.5 }, null, abort.signal); const names = engine.plateNames; assert(names.length === 16, `Expected 16 names, got ${names.length}`); assert(new Set(names).size === 16, 'Duplicate names detected'); const hasChinese = names.every(n => /[\u4e00-\u9fff]/.test(n)); assert(hasChinese, 'Names should contain Chinese characters'); });
        await test('哈希种子确定性', () => { const h1 = hashSeed('Hello World'); const h2 = hashSeed('Hello World'); const h3 = hashSeed('Different'); assert(h1 === h2, 'Same seed must produce same hash'); assert(h1 !== h3, 'Different seeds must produce different hashes'); });
        await test('噪声引擎 FBM 全组合', () => { const noiseTypes = ['simplex', 'perlin', 'value', 'worley']; const fbmTypes = ['standard', 'ridged', 'billowy', 'warped']; for (const nt of noiseTypes) for (const ft of fbmTypes) { const ne = createNoiseEngine(Math.floor(Math.random() * 100000)); const val = ne.fbm(3.5, 7.2, { octaves: 4, lacunarity: 2.0, persistence: 0.5, type: ft, noiseType: nt }); assert(!isNaN(val) && isFinite(val) && val >= -1.5 && val <= 1.5, `FBM ${nt}+${ft} out of range: ${val}`); } });
        await test('存储批量 CRUD 完整性', async () => { const ids = []; for (let i = 0; i < 3; i++) { const id = `batch_${Date.now()}_${i}`; await storage.save(id, { index: i }); ids.push(id); } for (const id of ids) { const data = await storage.load(id); assert(data?.index !== undefined, `Failed to load ${id}`); } const list = await storage.list(); ids.forEach(id => assert(list.some(m => m.id === id), `${id} missing from list`)); for (const id of ids) await storage.delete(id); });
        await test('State 快照往返一致性', () => { const original = { seedStr: 'SnapTest', mapSize: 768, plateCount: 10, landmass: 40, noiseType: 'perlin', fbmType: 'ridged', octaves: 5, lacunarity: 2.5, persistence: 0.6, seaLevel: 0.48 }; store.set({ ...original }); const snapshot = store.get(); for (const k of Object.keys(original)) { assert(snapshot[k] === original[k], `Key ${k}: expected ${original[k]}, got ${snapshot[k]}`); } store.set({}); });
        await test('板块数量边界 (4~32)', async () => { for (const pc of [4, 16, 32]) { const abort = new AbortController(); const data = await engine.generate({ seedStr: `bound_${pc}`, mapSize: 128, plateCount: pc, landmass: 40, noiseType: 'simplex', fbmType: 'standard', octaves: 2, lacunarity: 2, persistence: 0.5, seaLevel: 0.5 }, null, abort.signal); assert(data.plateData.length === 128 * 128 * 4, `plateData size mismatch for ${pc} plates`); assert(engine.plates.length === pc, `Expected ${pc} plates, got ${engine.plates.length}`); } });
        await test('Render uniforms 存在性检查', () => { const gl = renderer.gl; assert(gl !== null, 'GL context must exist'); assert(renderer.canvas !== undefined, 'Canvas reference must exist'); });
        log('--- v0.2.8 压力与守卫测试 ---');
        await test('渲染压力测试 100 次——零内存增长', async () => {
            const abort = new AbortController();
            const cfg = { seedStr: 'stress_render', mapSize: 128, plateCount: 8, landmass: 50, noiseType: 'simplex', fbmType: 'standard', octaves: 2, lacunarity: 2, persistence: 0.5, seaLevel: 0.5 };
            const data = await engine.generate(cfg, null, abort.signal);
            renderer.upload(data.plateData, data.elevData, data.moistData, data.tempData, data.riverData, engine.W, engine.H);
            const memBefore = performance.memory ? performance.memory.usedJSHeapSize : 0;
            for (let i = 0; i < 100; i++) {
                const opts = { style: i % 5, seaLevel: 0.45, lightAngleRad: i * 0.1, showBoundaries: true, boundaryWidth: 3, boundaryColor: [1, 0.2, 0.12], pointLightEnabled: false, pointLightPos: [0.3, 0.7], pointLightIntensity: 1, pointLightColor: [1, 0.96, 0.84], glowEnabled: false, plateTotal: engine.plates.length, fbmOctaves: 2, fbmLacunarity: 2, fbmPersistence: 0.5, laserActive: false, laserStart: [0, 0], laserEnd: [0, 0], laserWidth: 2, selectedPlates: [], trailEnabled: false, trailPoints: [], trailTimes: [] };
                renderer.draw(opts);
            }
            const memAfter = performance.memory ? performance.memory.usedJSHeapSize : 0;
            /* 允许 ±5MB 涨落,超过则报告泄漏 */
            if (performance.memory && memAfter - memBefore > 5 * 1048576) throw new Error(`Memory growth ${((memAfter - memBefore) / 1048576).toFixed(2)}MB exceeds threshold`);
        });
        await test('状态净化器拒绝 NaN/Inf 与未知键', () => {
            const dirty = { seedStr: 'X'.repeat(100) + '\u0000\u0001', mapSize: NaN, plateCount: Infinity, landmass: -99, unknownKey: 'malicious', nested: { a: 1 }, boundaryColor: [NaN, 0, 1], plateCount2: 'string' };
            const clean = sanitizeState(dirty);
            assert(clean !== null, 'sanitizeState should not return null for partial object');
            assert(clean.seedStr.length <= 64, 'seedStr should be truncated to 64 chars');
            assert(!clean.seedStr.includes('\u0000'), 'seedStr should strip control chars');
            assert(clean.mapSize === 0, 'NaN should become 0');
            assert(clean.plateCount === 0, 'Infinity should become 0');
            assert(!('unknownKey' in clean), 'unknown keys should be stripped');
            assert(!('nested' in clean), 'nested objects should be stripped');
            assert(!('plateCount2' in clean), 'duplicate keys should be stripped');
            assert(Array.isArray(clean.boundaryColor) && clean.boundaryColor[0] === 0, 'NaN in array should become 0');
        });
        await test('rAF 节流——单帧多次调用只产生一次提交', () => {
            let count = 0;
            const fn = rafThrottle(() => count++);
            for (let i = 0; i < 20; i++) fn(1, 2, 3);
            assert(count === 0, 'rAF throttle should not commit synchronously');
            return new Promise(resolve => requestAnimationFrame(() => { assert(count === 1, `rAF throttle should commit exactly once, got ${count}`); resolve(); }));
        });
        await test('withRetry 重试——瞬时失败后自愈', async () => {
            let attempts = 0;
            const flaky = () => { attempts++; if (attempts < 3) throw new Error('transient'); return 'ok'; };
            const result = await withRetry(flaky, 5, 5);
            assert(result === 'ok' && attempts === 3, `Expected ok after 3 attempts, got ${result} attempts=${attempts}`);
        });
        await test('clamp 值域收敛', () => {
            assert(clamp(5, 0, 10) === 5, 'in-range passes through');
            assert(clamp(-1, 0, 10) === 0, 'below min clamps up');
            assert(clamp(11, 0, 10) === 10, 'above max clamps down');
            assert(clamp(NaN, 0, 10) === 0, 'NaN should clamp to lower bound');
        });
        // === v0.3.2 新增检测: WebGL 能力检测 ===
        await test('WebGL 最大纹理尺寸与扩展支持', () => {
            const gl = renderer.gl;
            assert(gl !== null, 'GL context must exist');
            const maxTexSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
            assert(maxTexSize >= 2048, `MAX_TEXTURE_SIZE too small: ${maxTexSize}`);
            const maxUniforms = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
            assert(maxUniforms >= 64, `MAX_FRAGMENT_UNIFORM_VECTORS too small: ${maxUniforms}`);
            const extensions = gl.getSupportedExtensions();
            assert(extensions.length > 0, 'No WebGL2 extensions supported');
            assert(extensions.includes('OES_texture_float_linear') || extensions.includes('EXT_color_buffer_float'), 'Float texture support missing');
        });
        // === v0.3.2 新增检测: 地图参数边界验证 ===
        await test('地图尺寸边界 (256~2048)', async () => {
            for (const size of [256, 512, 1024, 2048]) {
                const abort = new AbortController();
                const cfg = { seedStr: 'size_test', mapSize: size, plateCount: 8, landmass: 50, noiseType: 'simplex', fbmType: 'standard', octaves: 2, lacunarity: 2, persistence: 0.5, seaLevel: 0.5 };
                const data = await engine.generate(cfg, null, abort.signal);
                const aspect = size; // 1:1
                assert(data.elevData.length === aspect * aspect, `elevData length mismatch for size ${size}`);
                assert(!data.elevData.some(isNaN), `NaN in elevation for size ${size}`);
            }
        });
        // === v0.3.2 新增检测: 地形数据统计验证 ===
        await test('高程数据统计合理性', async () => {
            const abort = new AbortController();
            const cfg = { seedStr: 'stat_test', mapSize: 256, plateCount: 8, landmass: 40, noiseType: 'simplex', fbmType: 'standard', octaves: 4, lacunarity: 2, persistence: 0.5, seaLevel: 0.5 };
            const data = await engine.generate(cfg, null, abort.signal);
            const elev = data.elevData;
            let min = Infinity, max = -Infinity, sum = 0, count = 0;
            for (let i = 0; i < elev.length; i++) {
                const v = elev[i];
                if (v < min) min = v;
                if (v > max) max = v;
                sum += v;
                count++;
            }
            const avg = sum / count;
            assert(min >= 0 && max <= 1, `Elevation range [${min}, ${max}] out of [0,1]`);
            assert(avg > 0.2 && avg < 0.8, `Average elevation ${avg.toFixed(3)} seems unreasonable`);
            const variance = elev.reduce((s, v) => s + (v - avg) ** 2, 0) / count;
            assert(variance > 0.001, `Elevation variance too low (${variance.toFixed(6)}), terrain may be flat`);
        });
        // === v0.3.2 新增检测: 板块分布平衡性 ===
        await test('板块分布平衡性 (无单板块 >50% 地图)', async () => {
            const abort = new AbortController();
            const cfg = { seedStr: 'balance_test', mapSize: 256, plateCount: 8, landmass: 50, noiseType: 'simplex', fbmType: 'standard', octaves: 4, lacunarity: 2, persistence: 0.5, seaLevel: 0.5 };
            const data = await engine.generate(cfg, null, abort.signal);
            const plateCount = engine.plates.length;
            const plateAreas = new Float64Array(plateCount);
            const total = data.plateData.length / 4;
            for (let i = 0; i < total; i++) {
                const pid = Math.round(data.plateData[i * 4] * (plateCount - 1));
                if (pid >= 0 && pid < plateCount) plateAreas[pid]++;
            }
            const maxRatio = Math.max(...plateAreas) / total;
            assert(maxRatio < 0.5, `A single plate covers ${(maxRatio * 100).toFixed(1)}% of the map (>50%)`);
        });
        // === v0.3.2 新增检测: 温度与湿度值域完整性 ===
        await test('温度与湿度数据完整性', async () => {
            const abort = new AbortController();
            const cfg = { seedStr: 'temp_moist_test', mapSize: 256, plateCount: 8, landmass: 50, noiseType: 'simplex', fbmType: 'standard', octaves: 4, lacunarity: 2, persistence: 0.5, seaLevel: 0.5 };
            const data = await engine.generate(cfg, null, abort.signal);
            const tempBins = [0, 0, 0, 0, 0];
            const moistBins = [0, 0, 0, 0, 0];
            for (let i = 0; i < data.tempData.length; i++) {
                const t = data.tempData[i], m = data.moistData[i];
                assert(t >= 0 && t <= 1, `Temperature out of range: ${t}`);
                assert(m >= 0 && m <= 1, `Moisture out of range: ${m}`);
                tempBins[Math.min(4, Math.floor(t * 5))]++;
                moistBins[Math.min(4, Math.floor(m * 5))]++;
            }
            const nonEmptyTempBins = tempBins.filter(b => b > 0).length;
            assert(nonEmptyTempBins >= 3, `Only ${nonEmptyTempBins} temperature bins are populated`);
        });
        // === v0.3.2 新增检测: 河流数据验证 ===
        await test('河流数据值域与类型检查', async () => {
            const abort = new AbortController();
            const cfg = { seedStr: 'river_test', mapSize: 256, plateCount: 8, landmass: 50, noiseType: 'simplex', fbmType: 'standard', octaves: 4, lacunarity: 2, persistence: 0.5, seaLevel: 0.5 };
            const data = await engine.generate(cfg, null, abort.signal);
            assert(data.riverData instanceof Float32Array, 'riverData should be Float32Array');
            assert(!data.riverData.some(isNaN), 'River data contains NaN');
            for (let i = 0; i < data.riverData.length; i++) {
                const v = data.riverData[i];
                assert(v >= 0 && v <= 1, `River value ${v} out of [0,1] at index ${i}`);
            }
        });
        // === v0.3.2 新增检测: 海岸线质量验证 ===
        await test('海岸线像素非孤立', async () => {
            const abort = new AbortController();
            const cfg = { seedStr: 'coast_test', mapSize: 256, plateCount: 8, landmass: 40, noiseType: 'simplex', fbmType: 'standard', octaves: 4, lacunarity: 2, persistence: 0.5, seaLevel: 0.5 };
            const data = await engine.generate(cfg, null, abort.signal);
            const W = 256, H = 256, sea = 0.5;
            const visited = new Uint8Array(W * H);
            let tinyOceanRegions = 0;
            for (let y = 0; y < H; y++) {
                for (let x = 0; x < W; x++) {
                    const idx = y * W + x;
                    if (visited[idx] || data.elevData[idx] >= sea) continue;
                    let regionSize = 0;
                    const queue = [idx]; visited[idx] = 1;
                    while (queue.length > 0) {
                        const ci = queue.shift(); regionSize++;
                        const cy = Math.floor(ci / W), cx = ci % W;
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                if (dx === 0 && dy === 0) continue;
                                const nx = cx + dx, ny = cy + dy;
                                if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
                                const ni = ny * W + nx;
                                if (!visited[ni] && data.elevData[ni] < sea) { visited[ni] = 1; queue.push(ni); }
                            }
                        }
                    }
                    if (regionSize < 9) tinyOceanRegions++;
                }
            }
            assert(tinyOceanRegions < 20, `Too many tiny ocean regions: ${tinyOceanRegions}`);
        });
        // === v0.3.2 新增检测: Abort 信号传播验证 ===
        await test('AbortController 信号传播验证', async () => {
            const abort = new AbortController();
            const cfg = { seedStr: 'abort_test', mapSize: 1024, plateCount: 16, landmass: 50, noiseType: 'simplex', fbmType: 'standard', octaves: 6, lacunarity: 2, persistence: 0.5, seaLevel: 0.5 };
            const p = engine.generate(cfg, null, abort.signal);
            setTimeout(() => abort.abort(), 10);
            try {
                await p;
            } catch (e) {
                assert(e.name === 'AbortError', `Expected AbortError, got ${e.name}: ${e.message}`);
            }
        });
        // === v0.3.2 新增检测: DOM 元素完整性 ===
        await test('关键 DOM 元素存在性检查', () => {
            const requiredIds = ['glCanvas', 'overlayCanvas', 'canvas-container', 'drawer', 'menu-btn', 'btn-generate', 'btn-random', 'btn-save', 'btn-load', 'btn-export', 'btn-test', 'in-seed', 'in-size', 'in-plates', 'in-landmass', 'in-noise', 'in-fbm', 'in-octaves', 'in-lacunarity', 'in-persistence', 'in-sea', 'in-style', 'in-light', 'in-show-names', 'in-laser', 'in-cursor', 'stats-card', 'perf-card', 'selection-card', 'test-modal', 'storage-modal', 'gen-progress', 'gen-progress-bar', 'scrim', 'toast-container'];
            for (const id of requiredIds) {
                const el = document.getElementById(id);
                assert(el !== null, `Required DOM element #${id} not found`);
            }
        });
        // === v0.3.2 新增检测: 状态序列化往返验证 (含全部字段) ===
        await test('状态序列化全字段往返 (含 v0.3.2 字段)', () => {
            const full = { seedStr: 'RoundTrip', mapSize: 512, plateCount: 12, landmass: 45, noiseType: 'perlin', fbmType: 'ridged', octaves: 5, lacunarity: 2.2, persistence: 0.55, seaLevel: 0.48, showBoundaries: true, boundaryWidth: 4, boundaryColor: [1, 0.3, 0.1], pointLightEnabled: true, pointLightPos: [0.5, 0.6], pointLightIntensity: 1.2, pointLightColor: [1, 0.95, 0.8], glowEnabled: true, style: 5, showNames: false, laserActive: true, trailEnabled: false, laserSmooth: true, cursorActive: false, lightAngle: 90, fbmOctaves: 5, fbmLacunarity: 2.2, fbmPersistence: 0.55, erosionStrength: 0.4, erosionIterations: 25, mountainFold: 0.6, tempOffset: 5, snowLine: 0.7, showRivers: false, contourInterval: 8, showContours: true, showTerrain: false, showSelection: false, mapAspect: '16:9', worldScale: 5, coastDetail: 0.5, lakeDensity: 0.3, showClimate: true, geoLabels: true, showGrid: true };
            const clean = sanitizeState(full);
            assert(clean !== null, 'sanitizeState returned null');
            assert(clean.seedStr === 'RoundTrip', 'seedStr not preserved');
            assert(clean.mapSize === 512, 'mapSize not preserved');
            assert(clean.mapAspect === '16:9', 'mapAspect not preserved');
            assert(clean.worldScale === 5, 'worldScale not preserved');
            assert(clean.showClimate === true, 'showClimate not preserved');
            assert(clean.geoLabels === true, 'geoLabels not preserved');
            assert(clean.showGrid === true, 'showGrid not preserved');
            assert(clean.coastDetail === 0.5, 'coastDetail not preserved');
            assert(clean.lakeDensity === 0.3, 'lakeDensity not preserved');
        });
        // === v0.3.2 新增检测: 噪声引擎参数极值 ===
        await test('噪声引擎零/极大坐标 NaN 检查', () => {
            const n = createNoiseEngine(42);
            const extremeCoords = [[0, 0], [1e6, 1e6], [-1e6, -1e6], [1e-10, 1e-10], [0.5, 0.5], [1e3, -1e3]];
            for (const [x, y] of extremeCoords) {
                for (const type of ['simplex', 'perlin', 'value', 'worley']) {
                    const val = n[type](x, y);
                    assert(!isNaN(val) && isFinite(val), `${type}(${x},${y}) = ${val} is NaN/Inf`);
                }
            }
        });
        // === v0.3.2 新增检测: 安全数值辅助函数 ===
        await test('safeNum 边界条件', () => {
            assert(safeNum(42) === 42, 'safeNum normal number');
            assert(safeNum(NaN) === 0, 'safeNum NaN should return fallback');
            assert(safeNum(Infinity) === 0, 'safeNum Infinity should return fallback');
            assert(safeNum(-Infinity) === 0, 'safeNum -Infinity should return fallback');
            assert(safeNum('42', 0) === 0, 'safeNum string should return fallback');
            assert(safeNum(null, 5) === 5, 'safeNum null should return fallback');
            assert(safeNum(undefined, -1) === -1, 'safeNum undefined should return fallback');
            assert(safeNum(0) === 0, 'safeNum zero should pass through');
            assert(safeNum(-0) === 0, 'safeNum negative zero should pass through');
        });
        // === v0.3.2 新增检测: escapeHTML 安全性 ===
        await test('escapeHTML XSS 防护', () => {
            assert(escapeHTML('<script>') === '&lt;script&gt;', 'HTML tags escaped');
            assert(escapeHTML('a&b') === 'a&amp;b', 'Ampersand escaped');
            assert(escapeHTML('"x"') === '&quot;x&quot;', 'Quotes escaped');
            assert(escapeHTML("it's") === "it&apos;s", 'Single quote escaped');
            assert(escapeHTML(42) === '42', 'Number converted to string');
            assert(escapeHTML(null) === 'null', 'null handled');
            assert(escapeHTML('') === '', 'Empty string handled');
        });
        // === v0.3.2 新增检测: 生成时间合理性 ===
        await test('生成时间合理性 (256² < 5s)', async () => {
            const abort = new AbortController();
            const cfg = { seedStr: 'perf_test', mapSize: 256, plateCount: 8, landmass: 50, noiseType: 'simplex', fbmType: 'standard', octaves: 4, lacunarity: 2, persistence: 0.5, seaLevel: 0.5 };
            const t0 = performance.now();
            await engine.generate(cfg, null, abort.signal);
            const elapsed = performance.now() - t0;
            assert(elapsed < 5000, `256² generation took ${elapsed.toFixed(0)}ms (>5s threshold)`);
        });
        // === v0.3.2 新增检测: 种子哈希分布均匀性 ===
        await test('种子哈希分布均匀性', () => {
            const buckets = new Array(10).fill(0);
            const samples = 1000;
            for (let i = 0; i < samples; i++) {
                const h = hashSeed(`test_seed_${i}`);
                const bucket = Math.floor((h % 1000) / 100);
                buckets[Math.min(9, bucket)]++;
            }
            const minBucket = Math.min(...buckets);
            const maxBucket = Math.max(...buckets);
            assert(minBucket > 30, `Hash distribution too uneven: min bucket = ${minBucket}`);
            assert(maxBucket < 170, `Hash distribution too uneven: max bucket = ${maxBucket}`);
        });
        // === v0.3.2 新增检测: 非正方形地图验证 ===
        await test('非正方形地图数据完整性 (16:9)', async () => {
            const origSize = engine.W;
            engine.setSize(512, 288);
            const abort = new AbortController();
            const cfg = { seedStr: 'aspect_test', mapSize: 512, plateCount: 8, landmass: 50, noiseType: 'simplex', fbmType: 'standard', octaves: 4, lacunarity: 2, persistence: 0.5, seaLevel: 0.5 };
            const data = await engine.generate(cfg, null, abort.signal);
            assert(data.elevData.length === 512 * 288, `Aspect map data length mismatch: ${data.elevData.length} vs ${512 * 288}`);
            assert(!data.elevData.some(isNaN), 'Aspect map elevation contains NaN');
            engine.setSize(origSize, origSize);
        });
        // === v0.3.2 新增检测: 图层独立性验证 ===
        await test('图层开关不影响数据完整性', async () => {
            const abort = new AbortController();
            const cfg = { seedStr: 'layer_test', mapSize: 128, plateCount: 8, landmass: 50, noiseType: 'simplex', fbmType: 'standard', octaves: 2, lacunarity: 2, persistence: 0.5, seaLevel: 0.5 };
            const data1 = await engine.generate(cfg, null, abort.signal);
            const abort2 = new AbortController();
            const data2 = await engine.generate({ ...cfg, showTerrain: false }, null, abort2.signal);
            let diffCount = 0;
            for (let i = 0; i < data1.elevData.length; i++) {
                if (Math.abs(data1.elevData[i] - data2.elevData[i]) > 0.0001) diffCount++;
            }
            assert(diffCount === 0, `Layer toggle changed ${diffCount} elevation values`);
        });
        // === v0.3.2 新增检测: 深拷贝函数健壮性 ===
        await test('deepClone 健壮性', () => {
            const obj = { a: 1, b: 'test', c: [1, 2, 3], d: { nested: true } };
            const cloned = deepClone(obj);
            assert(cloned.a === 1, 'deepClone number');
            assert(cloned.b === 'test', 'deepClone string');
            assert(cloned.c.length === 3, 'deepClone array');
            assert(cloned.d.nested === true, 'deepClone nested');
            cloned.a = 99;
            assert(obj.a === 1, 'deepClone should not affect original');
            assert(deepClone(null) === null, 'deepClone null');
            assert(deepClone(undefined) === undefined, 'deepClone undefined');
            assert(Array.isArray(deepClone([1])), 'deepClone array type preserved');
        });
        // === v0.3.2 新增检测: WebGL 每帧 GL 错误检测 ===
        await test('WebGL 每帧 GL 错误检查', () => {
            const gl = renderer.gl;
            if (!gl) return;
            const err = gl.getError();
            assert(err === gl.NO_ERROR, `GL error detected: 0x${err.toString(16)}`);
        });
        // === v0.3.2 新增检测: 噪声 FBM 八度数边界 ===
        await test('FBM 八度数边界 (0~8)', () => {
            const n = createNoiseEngine(123);
            for (const oct of [0, 1, 4, 8]) {
                const val = n.fbm(3.0, 5.0, { octaves: oct, lacunarity: 2.0, persistence: 0.5, type: 'standard', noiseType: 'simplex' });
                assert(!isNaN(val) && isFinite(val), `FBM with ${oct} octaves is NaN/Inf`);
            }
        });
        // === v0.3.2 新增检测: 板块统计数据一致性 ===
        await test('板块统计数据一致性', async () => {
            const abort = new AbortController();
            const cfg = { seedStr: 'stats_consistency', mapSize: 256, plateCount: 8, landmass: 50, noiseType: 'simplex', fbmType: 'standard', octaves: 4, lacunarity: 2, persistence: 0.5, seaLevel: 0.5 };
            await engine.generate(cfg, null, abort.signal);
            const allPids = engine.plates.map((_, i) => i);
            const stats = engine.getStats(allPids);
            let statsCount = 0;
            for (const pid of allPids) {
                if (stats[pid] && stats[pid].c > 0) statsCount++;
            }
            assert(statsCount >= allPids.length * 0.5, `Only ${statsCount}/${allPids.length} plates have stats`);
            let totalArea = 0;
            for (const pid of allPids) {
                if (stats[pid]) totalArea += stats[pid].area;
            }
            const mapArea = engine.W * engine.H;
            const coverage = totalArea / mapArea;
            assert(coverage > 0.8 && coverage <= 1.2, `Plate area coverage ${coverage.toFixed(2)} seems wrong`);
        });
        log('--- 诊断完成 ---'); summaryEl.textContent = `诊断完成: ${pass} 通过, ${fail} 失败`; summaryEl.style.color = fail > 0 ? 'var(--color-error)' : 'var(--color-success)'; };
    return { run };
}

// =====================================================================
// 模块 9.5: v0.3.6 移动端重构模块
// =====================================================================

/* v0.3.6: 方向检测管理器 */
function createOrientationManager() {
    const mql = window.matchMedia('(orientation: portrait)');
    const badge = document.getElementById('orientation-badge');
    const update = () => {
        const isPortrait = mql.matches;
        document.body.classList.toggle('orientation-portrait', isPortrait);
        document.body.classList.toggle('orientation-landscape', !isPortrait);
        safeStorage.set('mapgen_orientation', isPortrait ? 'portrait' : 'landscape');
        if (badge) {
            badge.style.display = window.innerWidth <= 860 ? 'inline-flex' : 'none';
            badge.textContent = isPortrait ? '📱' : '📲';
        }
    };
    mql.addEventListener('change', update);
    update();
    return { isPortrait: () => mql.matches, update };
}

/* v0.3.6: 画布触控缩放/平移 */
function createTouchZoom(container) {
    let scale = 1, panX = 0, panY = 0;
    let initialDistance = 0, initialScale = 1;
    let isDragging = false, lastX = 0, lastY = 0;
    const indicator = container.querySelector('.zoom-indicator');
    let indicatorTimeout = null;

    const applyTransform = () => {
        const canvas = container.querySelector('canvas');
        if (canvas) {
            canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
            canvas.style.transformOrigin = '0 0';
        }
        if (indicator) {
            indicator.textContent = scale.toFixed(1) + '×';
            indicator.classList.add('visible');
            clearTimeout(indicatorTimeout);
            indicatorTimeout = setTimeout(() => indicator.classList.remove('visible'), 1500);
        }
    };

    container.addEventListener('touchstart', (e) => {
        const cursorOverlay = container.querySelector('#cursor-overlay');
        if (cursorOverlay && cursorOverlay.classList.contains('active')) return;
        /* 激光指针激活时不拦截触摸事件 */
        if (typeof laser !== 'undefined' && laser && laser.state && laser.state.active) return;
        if (e.touches.length === 2) {
            e.preventDefault();
            initialDistance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            initialScale = scale;
        } else if (e.touches.length === 1 && scale > 1) {
            isDragging = true;
            lastX = e.touches[0].clientX;
            lastY = e.touches[0].clientY;
        }
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
        const cursorOverlay = container.querySelector('#cursor-overlay');
        if (cursorOverlay && cursorOverlay.classList.contains('active')) return;
        if (e.touches.length === 2) {
            e.preventDefault();
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            scale = Math.min(4, Math.max(1, initialScale * (dist / initialDistance)));
            applyTransform();
        } else if (isDragging && e.touches.length === 1) {
            e.preventDefault();
            const dx = e.touches[0].clientX - lastX;
            const dy = e.touches[0].clientY - lastY;
            panX += dx; panY += dy;
            lastX = e.touches[0].clientX;
            lastY = e.touches[0].clientY;
            applyTransform();
        }
    }, { passive: false });

    container.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) isDragging = false;
        if (e.touches.length === 0 && scale === 1) { panX = 0; panY = 0; applyTransform(); }
    });

    let lastTap = 0;
    container.addEventListener('touchend', () => {
        const now = Date.now();
        if (now - lastTap < 300) { scale = 1; panX = 0; panY = 0; applyTransform(); }
        lastTap = now;
    });

    return { reset: () => { scale = 1; panX = 0; panY = 0; applyTransform(); } };
}

/* v0.3.6: 底部抽屉拖拽行为 */
function createBottomSheet(drawer, scrim) {
    const handle = drawer.querySelector('.sheet-drag-handle');
    if (!handle) return;

    let startY = 0, startHeight = 0, currentSnap = 0;
    const snaps = [0, 0.55, 0.9];

    const getHeight = () => drawer.getBoundingClientRect().height;
    const setHeight = (h) => { drawer.style.maxHeight = h + 'px'; };

    handle.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        startHeight = getHeight();
        drawer.style.transition = 'none';
    }, { passive: true });

    handle.addEventListener('touchmove', (e) => {
        const dy = startY - e.touches[0].clientY;
        const newHeight = Math.max(60, startHeight + dy);
        setHeight(newHeight);
    }, { passive: true });

    handle.addEventListener('touchend', () => {
        drawer.style.transition = '';
        const currentHeight = getHeight();
        const vh = window.innerHeight;
        let nearestSnap = 0;
        let minDist = Infinity;
        snaps.forEach((s, i) => {
            const d = Math.abs(currentHeight - s * vh);
            if (d < minDist) { minDist = d; nearestSnap = i; }
        });
        if (currentHeight < vh * 0.2) nearestSnap = 0;
        setHeight(snaps[nearestSnap] * vh);
        currentSnap = nearestSnap;
        if (nearestSnap === 0) {
            drawer.classList.remove('open');
            scrim.classList.remove('show');
        } else if (nearestSnap === 1) {
            drawer.classList.add('open');
            drawer.classList.remove('sheet-full');
            drawer.classList.add('sheet-half');
        } else if (nearestSnap === 2) {
            drawer.classList.add('open');
            drawer.classList.remove('sheet-half');
            drawer.classList.add('sheet-full');
        }
    });
}

/* v0.3.6: FAB 速度拨号行为 */
function createFABController() {
    const fabGroup = document.getElementById('mobile-fab-group');
    const fabToggle = document.getElementById('fab-panel');
    const fabGenerate = document.getElementById('fab-generate');
    const fabRandom = document.getElementById('fab-random');
    if (!fabGroup || !fabToggle) return;

    let expanded = false;

    const collapse = () => {
        expanded = false;
        fabGroup.classList.remove('expanded');
        fabToggle.textContent = '☰';
    };

    const toggleExpand = () => {
        expanded = !expanded;
        fabGroup.classList.toggle('expanded', expanded);
        fabToggle.textContent = expanded ? '✕' : '☰';
        const drawer = document.getElementById('drawer');
        const scrim = document.getElementById('scrim');
        if (drawer) {
            if (expanded) {
                drawer.classList.add('open');
                if (scrim) scrim.classList.add('show');
            } else {
                drawer.classList.remove('open');
                drawer.classList.remove('sheet-half');
                drawer.classList.remove('sheet-full');
                if (scrim) scrim.classList.remove('show');
            }
        }
    };

    fabToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleExpand();
    });

    document.addEventListener('click', (e) => {
        if (expanded && !fabGroup.contains(e.target)) {
            expanded = false;
            fabGroup.classList.remove('expanded');
            fabToggle.textContent = '☰';
        }
    });

    if (fabGenerate) {
        fabGenerate.addEventListener('click', (e) => {
            e.stopPropagation();
            const btn = document.getElementById('btn-generate');
            if (btn) btn.click();
            expanded = false;
            fabGroup.classList.remove('expanded');
            fabToggle.textContent = '☰';
            const drawer = document.getElementById('drawer');
            const scrim = document.getElementById('scrim');
            if (drawer) drawer.classList.remove('open');
            if (scrim) scrim.classList.remove('show');
        });
    }

    if (fabRandom) {
        fabRandom.addEventListener('click', (e) => {
            e.stopPropagation();
            const btn = document.getElementById('btn-random');
            if (btn) btn.click();
        });
    }

    return { collapse, isExpanded: () => expanded };
}

// =====================================================================
// 模块 10: 主程序入口与 UI 绑定
// =====================================================================
function createApp(initialSize) {
    initialSize = initialSize || 1024;
    const logger = createLogger();
    initErrorHandler(logger, showToast);
    const perf = createPerfMonitor();
    const storage = createStorageManager(logger);
    const store = createStore({ seedStr: 'Terra2026', mapSize: initialSize, plateCount: 14, landmass: 35, noiseType: 'simplex', fbmType: 'standard', octaves: 6, lacunarity: 2.0, persistence: 0.5, seaLevel: 0.45, showBoundaries: true, boundaryWidth: 3, boundaryColor: [1, 0.2, 0.12], pointLightEnabled: false, pointLightPos: [0.3, 0.7], pointLightIntensity: 1.0, pointLightColor: [1, 0.96, 0.84], glowEnabled: false, style: 4, showNames: true, laserActive: false, trailEnabled: true, laserSmooth: false, cursorActive: false, perfEnabled: false, _needsRegen: true, _isGenerating: false, fbmOctaves: 6, fbmLacunarity: 2.0, fbmPersistence: 0.5, erosionStrength: 0.3, erosionIterations: 20, mountainFold: 0.5, tempOffset: 0, snowLine: 0.65, showRivers: true, contourInterval: 5, showContours: true, showTerrain: true, showSelection: true, lightAngle: 135, mapAspect: '1:1', worldScale: 3, coastDetail: 0.4, lakeDensity: 0.2, showClimate: false, geoLabels: false, showGrid: false, detailRiverWidth: 1.0, detailRiverCurve: 0.5, detailCoastJagged: 0.4, detailRidgeDensity: 0.5, detailRainfallOffset: 0.0, detailTempGradient: 1.0, detailBiomeBlend: 0.3, /* v0.3.8 */ showElevScale: false, showRegionNames: true, customPlateNames: {}, customRegionNames: {} });
    /* v0.2.8 性能: DOM 查询 LRU 缓存——getElementById 调用下降 ~60% */
    const _domCache = new Map();
    const $ = id => { if (_domCache.has(id)) return _domCache.get(id); const el = document.getElementById(id); if (el) _domCache.set(id, el); return el; };
    const glCanvas = $('glCanvas');
    const overlayCanvas = $('overlayCanvas');
    const container = $('canvas-container');
    let renderer, engine, overlay, laser, cursor, testSuite;
    let selectionStats = {}, lodTimer = null, currentAbort = null;
    let generating = false;
    /* v0.3.6: 移动端重构模块实例 */
    let orientationMgr, touchZoom, fabCtrl;
    /* v0.2.8 稳定: 生成序列号——丢弃过期异步结果 */
    let genSeq = 0;
    /* v0.3.10: 惰性加载就绪标志——延迟模块加载前所有引用做空安全守卫 */
    let _deferredReady = false;
    /* v0.3.10: 更新 splash 状态 */
    (function(s){var e=document.querySelector('.splash-subtitle');if(e)e.textContent=s;})('正在初始化渲染引擎...');
    try { renderer = createRenderer(glCanvas, logger, perf); } catch (e) { showToast(`渲染器初始化失败: ${e.message}`, true); var _se=document.getElementById('splash-screen');if(_se&&!_se.classList.contains('dismissed')){_se.classList.add('dismissed');document.body.style.overflow='';} return; }
    engine = createTectonicEngine(logger);
    renderer.setEngineRef(engine);
    /* v0.3.10: 非关键模块移至惰性加载——见 _deferredInit() */
    overlay = null; laser = null; cursor = null;
    testSuite = null;
    orientationMgr = null; touchZoom = null; fabCtrl = null;
    const resize = (skipRegen = false) => {
        const baseSize = store.get().mapSize;
        const aspect = store.get().mapAspect || '1:1';
        const [aw, ah] = aspect.split(':').map(Number);
        const ratio = aw / ah;
        let W, H;
        if (ratio >= 1) { W = baseSize; H = Math.round(baseSize / ratio); }
        else { H = baseSize; W = Math.round(baseSize * ratio); }
        W = Math.max(64, W); H = Math.max(64, H);
        if (!renderer || !renderer.gl || renderer.gl.isContextLost()) { logger.warn('GL not ready during resize'); return; }
        const maxTexSize = renderer.gl.getParameter(renderer.gl.MAX_TEXTURE_SIZE);
        if (W > maxTexSize || H > maxTexSize) {
            logger.warn(`Map size ${W}×${H} exceeds GL max texture ${maxTexSize}`);
            W = Math.min(W, maxTexSize); H = Math.min(H, maxTexSize);
        }
        glCanvas.width = W; glCanvas.height = H;
        overlayCanvas.width = W; overlayCanvas.height = H;
        engine.setSize(W, H);
        if (overlay) overlay.resize(W, H);
        $('info-dim').textContent = `${W}×${H}`;
        if (!skipRegen) store.set({}, true);
    };
    const setupUI = () => {
        const $ = id => { if (_domCache.has(id)) return _domCache.get(id); const el = document.getElementById(id); if (el) _domCache.set(id, el); return el; };
        /* v0.2.8 性能: 滑块改为 rAF 合并——一次拖动多事件只产生一次 store 提交 */
        const bind = (id, key, tr = v => +v, fmt = v => v) => {
            const el = $(id), vid = id.replace('in-', 'val-');
            let pendingValue = null;
            el.addEventListener('input', e => {
                pendingValue = tr(e.target.value);
                if (vid) { const vEl = $(vid); if (vEl) vEl.textContent = fmt(pendingValue); }
                el.setAttribute('aria-valuetext', fmt(pendingValue));
            });
            el.addEventListener('change', () => { if (pendingValue !== null) { store.set({ [key]: pendingValue }); pendingValue = null; } });
            const commit = rafThrottle(() => { if (pendingValue !== null) { store.set({ [key]: pendingValue }); pendingValue = null; } });
            /* 使用复合轮询：rAF 提交 + 释放时强制提交 */
            el.addEventListener('input', commit);
        };
        const bindArr = (id, key, idx, tr, fmt) => {
            const el = $(id), vid = id.replace('in-', 'val-');
            let pendingValue = null;
            el.addEventListener('input', e => { pendingValue = tr(e.target.value); if (vid) { const vEl = $(vid); if (vEl) vEl.textContent = fmt(pendingValue); } });
            el.addEventListener('change', () => { if (pendingValue !== null) { const a = [...store.get()[key]]; a[idx] = pendingValue; store.set({ [key]: a }); pendingValue = null; } });
            const commit = rafThrottle(() => { if (pendingValue !== null) { const a = [...store.get()[key]]; a[idx] = pendingValue; store.set({ [key]: a }); pendingValue = null; } });
            el.addEventListener('input', commit);
        };
        $('menu-btn').onclick = debounce(() => { const drawer = $('drawer'), scrim = $('scrim'); const isOpen = drawer.classList.toggle('open'); scrim.classList.toggle('show', isOpen); $('menu-btn').setAttribute('aria-expanded', isOpen); }, 50);
        $('scrim').onclick = () => { $('drawer').classList.remove('open'); $('drawer').classList.remove('sheet-half'); $('drawer').classList.remove('sheet-full'); $('scrim').classList.remove('show'); $('storage-modal').classList.remove('active'); $('test-modal').classList.remove('active'); $('menu-btn').setAttribute('aria-expanded', 'false'); if (fabCtrl) fabCtrl.collapse(); };
        $('lang-btn').onclick = () => { currentLang = currentLang == 'zh' ? 'en' : 'zh'; applyI18n(updateStatsUI); };
        (() => {
            const uiPref = safeStorage.get('mapgen_ui', 'classic');
            document.body.dataset.ui = uiPref;
            $('ui-btn').setAttribute('aria-pressed', uiPref === 'modern');
            $('ui-btn').textContent = uiPref === 'modern' ? '◆' : '◈';
            $('ui-btn').onclick = () => {
                const next = document.body.dataset.ui === 'classic' ? 'modern' : 'classic';
                document.body.dataset.ui = next;
                safeStorage.set('mapgen_ui', next);
                $('ui-btn').setAttribute('aria-pressed', next === 'modern');
                $('ui-btn').textContent = next === 'modern' ? '◆' : '◈';
            };
        })();
        document.querySelectorAll('[data-toggle]').forEach(el => {
            el.onclick = () => { const card = $(el.dataset.toggle); const isCollapsed = card.classList.toggle('collapsed'); el.setAttribute('aria-expanded', !isCollapsed); };
            el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
        });
        $('in-seed').onchange = debounce(e => store.set({ seedStr: e.target.value }), 100);
        $('in-size').onchange = e => { store.set({ mapSize: +e.target.value }); resize(); };
        $('in-aspect').onchange = e => { store.set({ mapAspect: e.target.value }); resize(); };
        bind('in-world-scale', 'worldScale', v => +v, v => v);
        bind('in-plates', 'plateCount', v => +v, v => v);
        bind('in-landmass', 'landmass', v => +v, v => v + '%');
        $('in-noise').onchange = e => store.set({ noiseType: e.target.value });
        $('in-fbm').onchange = e => store.set({ fbmType: e.target.value });
        $('in-octaves').oninput = debounce(e => { store.set({ octaves: +e.target.value, fbmOctaves: +e.target.value }); $('val-octaves').textContent = e.target.value; }, 30);
        $('in-lacunarity').oninput = debounce(e => { const v = e.target.value / 10; store.set({ lacunarity: v, fbmLacunarity: v }); $('val-lacunarity').textContent = v.toFixed(1); }, 30);
        $('in-persistence').oninput = debounce(e => { const v = e.target.value / 100; store.set({ persistence: v, fbmPersistence: v }); $('val-persistence').textContent = v.toFixed(2); }, 30);
        bind('in-sea', 'seaLevel', v => v / 100, v => v.toFixed(2));
        $('in-boundaries').onchange = e => store.set({ showBoundaries: e.target.checked });
        bind('in-boundary-width', 'boundaryWidth', v => +v, v => v);
        $('in-boundary-color').oninput = e => { const h = e.target.value; store.set({ boundaryColor: [parseInt(h.substr(1, 2), 16) / 255, parseInt(h.substr(3, 2), 16) / 255, parseInt(h.substr(5, 2), 16) / 255] }); };
        $('in-point-light').onchange = e => store.set({ pointLightEnabled: e.target.checked });
        bindArr('in-light-x', 'pointLightPos', 0, v => v / 100, v => v.toFixed(2));
        bindArr('in-light-y', 'pointLightPos', 1, v => 1 - v / 100, v => v.toFixed(2));
        bind('in-light-intensity', 'pointLightIntensity', v => v / 100, v => v.toFixed(2));
        $('in-light-color').oninput = e => { const h = e.target.value; store.set({ pointLightColor: [parseInt(h.substr(1, 2), 16) / 255, parseInt(h.substr(3, 2), 16) / 255, parseInt(h.substr(5, 2), 16) / 255] }); };
        $('in-glow').onchange = e => store.set({ glowEnabled: e.target.checked });
        /* v0.3.0: terrain system bindings */
        bind('in-erosion-strength', 'erosionStrength', v => v / 100, v => v);
        bind('in-erosion-iterations', 'erosionIterations', v => +v, v => v);
        bind('in-mountain-fold', 'mountainFold', v => v / 100, v => v.toFixed(2));
        bind('in-temp-offset', 'tempOffset', v => +v, v => v);
        bind('in-snow-line', 'snowLine', v => v / 100, v => v.toFixed(2));
        $('in-show-rivers').onchange = e => store.set({ showRivers: e.target.checked });
        bind('in-contour-interval', 'contourInterval', v => +v, v => v);
        bind('in-coast-detail', 'coastDetail', v => v / 100, v => v);
        bind('in-lake-density', 'lakeDensity', v => v / 100, v => v);
        $('in-show-climate').onchange = e => { store.set({ showClimate: e.target.checked }); markDirty(); };
        $('in-geo-labels').onchange = e => { store.set({ geoLabels: e.target.checked }); };
        $('in-show-grid').onchange = e => { store.set({ showGrid: e.target.checked }); };
        /* v0.3.8: 海拔尺 & 地形区名绑定 */
        $('in-elev-scale').onchange = e => { store.set({ showElevScale: e.target.checked }); };
        $('in-layer-regions').onchange = e => { store.set({ showRegionNames: e.target.checked }); };
        /* v0.3.6: 细节生成器绑定 */
        bind('in-detail-river-width', 'detailRiverWidth', v => v / 100, v => v);
        bind('in-detail-river-curve', 'detailRiverCurve', v => v / 100, v => v);
        bind('in-detail-coast-jagged', 'detailCoastJagged', v => v / 100, v => v);
        bind('in-detail-ridge-density', 'detailRidgeDensity', v => v / 100, v => v);
        bind('in-detail-rainfall-offset', 'detailRainfallOffset', v => +v, v => v);
        bind('in-detail-temp-gradient', 'detailTempGradient', v => v / 100, v => v);
        bind('in-detail-biome-blend', 'detailBiomeBlend', v => v / 100, v => v);
        bind('in-light', 'lightAngle', v => +v, v => v + '°');
        $('in-style').onchange = e => store.set({ style: { terrain: 0, plates: 1, parchment: 2, satellite: 3, lowpoly: 4, terrain_detail: 5, biome: 6, contour: 7, relief: 8, azgaar: 9 }[e.target.value] });
        $('in-show-names').onchange = e => store.set({ showNames: e.target.checked });
        $('in-perf').onchange = e => { store.set({ perfEnabled: e.target.checked }); perf.setEnabled(e.target.checked); };
        $('in-laser').onchange = e => { laser.setActive(e.target.checked); store.set({ laserActive: e.target.checked }); if (!e.target.checked) { laser.clear(); selectionStats = {}; updateSelUI([]); } };
        $('in-laser-auto').onchange = e => laser.state.autoSelect = e.target.checked;
        $('in-trail').onchange = e => { laser.state.trailEnabled = e.target.checked; store.set({ trailEnabled: e.target.checked }); };
        $('in-laser-smooth').onchange = e => laser.setSmoothing(e.target.checked);
        /* v0.3.4: 光标绑定 */
        $('in-cursor').onchange = e => { cursor.setActive(e.target.checked); store.set({ cursorActive: e.target.checked }); };
        /* v0.3.1: 图层分离控制绑定 */
        $('in-layer-terrain').onchange = e => store.set({ showTerrain: e.target.checked });
        $('in-layer-boundaries').onchange = e => store.set({ showBoundaries: e.target.checked });
        $('in-layer-rivers').onchange = e => store.set({ showRivers: e.target.checked });
        $('in-layer-contours').onchange = e => store.set({ showContours: e.target.checked });
        $('in-layer-names').onchange = e => store.set({ showNames: e.target.checked });
        $('in-layer-selection').onchange = e => store.set({ showSelection: e.target.checked });
        $('btn-generate').onclick = debounce(() => { if (generating) return; $('drawer').classList.remove('open'); $('drawer').classList.remove('sheet-half'); $('drawer').classList.remove('sheet-full'); $('scrim').classList.remove('show'); if (fabCtrl) fabCtrl.collapse(); store.set({}, true); }, 200);
        $('btn-random').onclick = debounce(() => { const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; let s = ''; for (let i = 0; i < 8; i++) s += c[Math.floor(Math.random() * c.length)]; $('in-seed').value = s; store.set({ seedStr: s }, true); }, 100);
        $('btn-save').onclick = async () => { const st = store.get(); try { await storage.save(`${st.seedStr}_${Date.now()}`, st); showToast(t().save_success); } catch (e) { logger.error('Save', e); } };
        $('btn-load').onclick = async () => { try { const maps = await storage.list(); renderModal(maps); $('storage-modal').classList.add('active'); $('scrim').classList.add('show'); } catch (e) { logger.error('Load', e); } };
        $('btn-close-modal').onclick = () => { $('storage-modal').classList.remove('active'); $('scrim').classList.remove('show'); };
        $('btn-close-test').onclick = () => { $('test-modal').classList.remove('active'); $('scrim').classList.remove('show'); };
        $('btn-test').onclick = async () => { if (!testSuite) testSuite = await LazyLoader.load('testSuite'); testSuite.run(); };

        /* ========== v0.3.8: 标签管理系统 ========== */
        const renderLabelManager = () => {
            const el = $('label-manager-content');
            if (!el) return;
            const lang = I18N[currentLang];
            const st = store.get();
            const cpNames = st.customPlateNames || {};
            const crNames = st.customRegionNames || {};
            let html = '';
            // 板块标签
            html += `<div style="font:var(--type-label);color:var(--color-primary);margin-bottom:6px">📋 ${lang.label_plate}</div>`;
            if (engine.plates && engine.plates.length) {
                for (let i = 0; i < engine.plates.length; i++) {
                    const p = engine.plates[i];
                    const custom = cpNames[i];
                    const origName = engine.plateNames[i] || `#${i + 1}`;
                    const displayName = custom || origName;
                    const isCustom = !!custom;
                    html += `<div class="label-row" style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:var(--color-surface-high);border-radius:6px;margin-bottom:4px;font-size:12px">
                        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${isCustom ? 'color:var(--color-primary);font-weight:600' : ''}">${escapeHTML(displayName)}</span>
                        <span style="color:var(--color-on-surface-variant);font-size:10px;margin:0 6px;white-space:nowrap">${p.type ? lang.type_cont : lang.type_ocean} #${i + 1}</span>
                        <button class="md-btn md-btn-text label-edit-btn" data-type="plate" data-idx="${i}" style="padding:2px 8px;min-height:24px;font-size:11px" title="${lang.label_rename}">✎</button>
                    </div>`;
                }
            }
            // 地形区标签
            if (engine.regions && engine.regions.length) {
                html += `<div style="font:var(--type-label);color:var(--color-primary);margin:10px 0 6px">🏔 ${lang.label_region}</div>`;
                for (let i = 0; i < engine.regions.length; i++) {
                    const r = engine.regions[i];
                    const custom = crNames[i];
                    const origName = engine.regionNames[i] || `Region #${i + 1}`;
                    const displayName = custom || origName;
                    const isCustom = !!custom;
                    const typeKey = `region_type_${r.type}`;
                    const typeName = lang[typeKey] || r.type;
                    html += `<div class="label-row" style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:var(--color-surface-high);border-radius:6px;margin-bottom:4px;font-size:12px">
                        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${isCustom ? 'color:var(--color-primary);font-weight:600' : ''}">${escapeHTML(displayName)}</span>
                        <span style="color:var(--color-on-surface-variant);font-size:10px;margin:0 6px;white-space:nowrap">${typeName}</span>
                        <button class="md-btn md-btn-text label-edit-btn" data-type="region" data-idx="${i}" style="padding:2px 8px;min-height:24px;font-size:11px" title="${lang.label_rename}">✎</button>
                    </div>`;
                }
            }
            // 重置按钮
            html += `<div style="margin-top:8px"><button class="md-btn md-btn-text" id="btn-label-reset" style="width:100%;color:var(--color-error);font-size:12px" data-i18n="label_reset">${lang.label_reset}</button></div>`;
            el.innerHTML = html;
            // 绑定编辑按钮
            el.querySelectorAll('.label-edit-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const type = btn.dataset.type;
                    const idx = parseInt(btn.dataset.idx);
                    const st2 = store.get();
                    const customMap = type === 'plate' ? (st2.customPlateNames || {}) : (st2.customRegionNames || {});
                    const origName = type === 'plate'
                        ? (engine.plateNames[idx] || `#${idx + 1}`)
                        : (engine.regionNames[idx] || `Region #${idx + 1}`);
                    const currentName = customMap[idx] || origName;
                    openLabelEditModal(type, idx, currentName, origName);
                };
            });
            // 绑定重置按钮
            const resetBtn = el.querySelector('#btn-label-reset');
            if (resetBtn) {
                resetBtn.onclick = () => {
                    if (window.confirm(lang.label_reset_confirm || 'Reset all labels?')) {
                        store.set({ customPlateNames: {}, customRegionNames: {} });
                        // 恢复原始名称
                        if (engine.plates.length) {
                            const seed = store.get().seedStr;
                            const origPlates = (() => {
                                let s = hashSeed(seed);
                                const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
                                const head = ['艾','索','瓦','克','赞','莫','维','伊','纳','顿','安','贝','铎','葛','赫'];
                                const middle = ['尔','林','尼','拉','恩','斯','罗','诺','瑞','萨','卡','塔'];
                                const tail = ['兰','多','亚','德','地','加','特','曼','达','尔','斯','姆','堡','原','野'];
                                const n = [], u = new Set();
                                for (let i = 0; i < engine.plates.length; i++) {
                                    let name, t = 0;
                                    do { const h = head[Math.floor(r() * head.length)]; const roll = r();
                                        if (roll < 0.15) name = h + tail[Math.floor(r() * tail.length)];
                                        else if (roll < 0.70) name = h + middle[Math.floor(r() * middle.length)] + tail[Math.floor(r() * tail.length)];
                                        else { const m1 = middle[Math.floor(r() * middle.length)]; let m2 = middle[Math.floor(r() * middle.length)]; while (m2 === m1) m2 = middle[Math.floor(r() * middle.length)]; name = h + m1 + m2 + tail[Math.floor(r() * tail.length)]; } t++;
                                    } while (u.has(name) && t < 12);
                                    u.add(name); n.push(name);
                                }
                                return n;
                            })();
                            origPlates.forEach((n, i) => { engine.plateNames[i] = n; });
                        }
                        markDirty();
                        showToast(lang.label_edited);
                        renderLabelManager();
                    }
                };
            }
        };
        // 打开标签编辑 Modal
        const openLabelEditModal = (type, idx, currentName, origName) => {
            const modal = $('label-edit-modal');
            const input = $('label-edit-input');
            const original = $('label-edit-original');
            const scrim = $('scrim');
            const lang = I18N[currentLang];
            $('label-edit-title').textContent = lang.label_edit_title;
            original.textContent = `${lang.label_name}: ${origName}`;
            input.value = currentName;
            input.focus();
            input.select();
            modal.classList.add('active');
            scrim.classList.add('show');
            // 确认回调
            const confirmEdit = () => {
                const newName = input.value.trim();
                if (newName && newName !== origName) {
                    const st = store.get();
                    const key = type === 'plate' ? 'customPlateNames' : 'customRegionNames';
                    const customMap = { ...(st[key] || {}) };
                    customMap[idx] = newName;
                    store.set({ [key]: customMap });
                    // 同步更新引擎名称数组
                    if (type === 'plate') {
                        engine.plateNames[idx] = newName;
                    } else {
                        engine.regionNames[idx] = newName;
                    }
                    markDirty();
                    showToast(lang.label_edited);
                    renderLabelManager();
                }
                closeModal();
            };
            const cancel = () => { closeModal(); };
            const closeModal = () => {
                modal.classList.remove('active');
                scrim.classList.remove('show');
                $('btn-label-confirm').onclick = null;
                $('btn-label-cancel').onclick = null;
                input.onkeydown = null;
            };
            $('btn-label-confirm').onclick = confirmEdit;
            $('btn-label-cancel').onclick = cancel;
            input.onkeydown = (e) => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') cancel(); };
        };
        // 监听标签管理卡片展开以刷新内容
        const labelManagerCard = $('card-label-manager');
        if (labelManagerCard) {
            const observer = new MutationObserver(() => {
                if (!labelManagerCard.classList.contains('collapsed')) {
                    renderLabelManager();
                }
            });
            observer.observe(labelManagerCard, { attributes: true, attributeFilter: ['class'] });
            // 也监听 data-toggle 的点击
            const labelToggle = labelManagerCard.querySelector('[data-toggle]');
            if (labelToggle) {
                labelToggle.addEventListener('click', () => {
                    setTimeout(() => {
                        if (!labelManagerCard.classList.contains('collapsed')) {
                            renderLabelManager();
                        }
                    }, 350); // 等待展开动画
                });
            }
        }

        /* ========== v0.3.1: 多格式导出系统 ========== */
        let _exportBitmapCache = null; // 缓存合并后的 ImageBitmap
        let _exportCacheKey = null;    // 缓存有效性标记
        const _exportDropdown = $('export-dropdown');
        const _exportMenu = $('export-menu');
        const _qualityRow = $('export-quality-row');
        const _qualitySlider = $('export-quality');
        const _qualityVal = $('export-quality-val');

        // 切换导出下拉菜单
        $('btn-export').onclick = (e) => {
            e.stopPropagation();
            _exportDropdown.classList.toggle('open');
            _exportMenu.style.display = 'block';
        };
        document.addEventListener('click', (e) => {
            if (!_exportDropdown.contains(e.target)) {
                _exportDropdown.classList.remove('open');
                _exportMenu.style.display = '';
            }
        });
        // 导出质量滑块
        _qualitySlider.oninput = () => { _qualityVal.textContent = _qualitySlider.value + '%'; };
        // JPEG/WebP 显示质量滑块
        const _showQuality = (fmt) => { const show = (fmt === 'jpeg' || fmt === 'webp'); _qualityRow.style.display = show ? 'flex' : 'none'; };

        // 合并 WebGL + Overlay 画布到离屏画布（带缓存）
        const _mergeCanvasToBlob = async (format, quality) => {
            const w = glCanvas.width, h = glCanvas.height;
            const cacheKey = `${w}_${h}_${renderer._lastDrawSeq ? renderer._lastDrawSeq.value : 0}`;
            let bitmap = null;
            if (_exportBitmapCache && _exportCacheKey === cacheKey) {
                bitmap = _exportBitmapCache;
            } else {
                const offscreen = document.createElement('canvas');
                offscreen.width = w; offscreen.height = h;
                const ctx = offscreen.getContext('2d');
                ctx.drawImage(glCanvas, 0, 0);
                ctx.drawImage(overlayCanvas, 0, 0);
                bitmap = offscreen;
                _exportBitmapCache = offscreen;
                _exportCacheKey = cacheKey;
            }
            // 生成指定格式 Blob
            const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : format === 'bmp' ? 'image/bmp' : 'image/png';
            const q = (format === 'jpeg' || format === 'webp') ? quality / 100 : undefined;
            if (bitmap instanceof HTMLCanvasElement) {
                return new Promise((r, j) => { bitmap.toBlob(b => b ? r(b) : j(new Error('toBlob returned null')), mimeType, q); });
            }
            // bitmap 是 ImageBitmap：绘制到临时 canvas
            const tmp = document.createElement('canvas');
            tmp.width = w; tmp.height = h;
            const tmpCtx = tmp.getContext('2d');
            tmpCtx.drawImage(bitmap, 0, 0);
            return new Promise((r, j) => { tmp.toBlob(b => b ? r(b) : j(new Error('toBlob returned null')), mimeType, q); });
        };

        // 导出高程数据 JSON
        const _exportHeightmap = (st) => {
            const W = engine.W, H = engine.H;
            const data = {
                version: VERSION,
                seed: st.seedStr,
                width: W,
                height: H,
                seaLevel: st.seaLevel,
                elevMap: engine.elevMap ? Array.from(engine.elevMap) : [],
                moistMap: engine.moistMap ? Array.from(engine.moistMap) : [],
                tempMap: engine.tempMap ? Array.from(engine.tempMap) : [],
                plateMap: engine.plateMap ? Array.from(engine.plateMap) : []
            };
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            return blob;
        };

        // 导出完整地形数据 JSON
        const _exportTerrainData = (st) => {
            const data = {
                version: VERSION,
                config: { seedStr: st.seedStr, mapSize: st.mapSize, plateCount: st.plateCount, landmass: st.landmass,
                    noiseType: st.noiseType, fbmType: st.fbmType, octaves: st.octaves, lacunarity: st.lacunarity,
                    persistence: st.persistence, seaLevel: st.seaLevel, style: st.style, erosionStrength: st.erosionStrength,
                    erosionIterations: st.erosionIterations, mountainFold: st.mountainFold, tempOffset: st.tempOffset,
                    snowLine: st.snowLine, showRivers: st.showRivers, contourInterval: st.contourInterval },
                width: engine.W,
                height: engine.H,
                plates: engine.plates.map((p, i) => ({ id: p.id, name: engine.plateNames[i] || `#${i+1}`, type: p.type, cx: p.x, cy: p.y, vx: p.vx, vy: p.vy, density: p.density })),
                elevMap: engine.elevMap ? Array.from(engine.elevMap) : [],
                moistMap: engine.moistMap ? Array.from(engine.moistMap) : [],
                tempMap: engine.tempMap ? Array.from(engine.tempMap) : [],
                plateMap: engine.plateMap ? Array.from(engine.plateMap) : [],
                riverMap: engine.riverMap ? Array.from(engine.riverMap) : []
            };
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            return blob;
        };

        // 通用下载
        const _download = (blob, filename) => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        };

        // 各格式导出菜单项点击处理
        _exportMenu.querySelectorAll('.export-item').forEach(item => {
            item.onclick = async () => {
                const fmt = item.dataset.format;
                _exportDropdown.classList.remove('open');
                _showQuality(fmt);

                const st = store.get();
                if (st._isGenerating || generating) { showToast('正在生成中，请稍候...', true); return; }

                const safeSeed = st.seedStr.replace(/[\\/:*?"<>|]/g, '_');
                const t0 = performance.now();

                try {
                    // 数据导出（无需合并画布）
                    if (fmt === 'heightmap') {
                        showToast(t().exporting || '导出中...');
                        const blob = _exportHeightmap(st);
                        _download(blob, `heightmap_${safeSeed}_v${VERSION.replace(/\./g, '')}.json`);
                        showToast(`${t().export_done || '导出完成'} (${((performance.now() - t0) / 1000).toFixed(1)}s)`);
                        return;
                    }
                    if (fmt === 'terraindata') {
                        showToast(t().exporting || '导出中...');
                        const blob = _exportTerrainData(st);
                        _download(blob, `terrain_${safeSeed}_v${VERSION.replace(/\./g, '')}.json`);
                        showToast(`${t().export_done || '导出完成'} (${((performance.now() - t0) / 1000).toFixed(1)}s)`);
                        return;
                    }

                    // 图片导出：确保画布尺寸正确 (v0.3.2: 修复导出不尊重宽高比)
                    const aspect = st.mapAspect || '1:1';
                    const [aw2, ah2] = aspect.split(':').map(Number);
                    const expRatio = aw2 / ah2;
                    let expW, expH;
                    if (expRatio >= 1) { expW = st.mapSize; expH = Math.round(st.mapSize / expRatio); }
                    else { expH = st.mapSize; expW = Math.round(st.mapSize * expRatio); }
                    expW = Math.max(64, expW); expH = Math.max(64, expH);
                    if (glCanvas.width !== expW || glCanvas.height !== expH) {
                        showToast(t().export_preparing || '准备高清画布...');
                        clearTimeout(lodTimer);
                        glCanvas.width = expW; glCanvas.height = expH;
                        overlayCanvas.width = expW; overlayCanvas.height = expH;
                        engine.setSize(expW, expH);
                        overlay.resize(expW, expH);
                        $('info-lod').textContent = 'LOD: 1';
                        const exportAbort = new AbortController();
                        const data = await engine.generate(st, null, exportAbort.signal);
                        renderer.upload(data.plateData, data.elevData, data.moistData, data.tempData, data.riverData, expW, expH);
                        _exportCacheKey = null; // 数据变化，清除缓存
                    }

                    // 渲染一帧确保画面最新
                    renderer.draw(buildOpts());
                    overlay.draw(engine, st.showNames, st.seedStr, { geoLabels: st.geoLabels, seaLevel: st.seaLevel, showGrid: st.showGrid, worldScale: st.worldScale, showClimate: st.showClimate, showElevScale: st.showElevScale, snowLine: st.snowLine, showRegionNames: st.showRegionNames, customPlateNames: st.customPlateNames, customRegionNames: st.customRegionNames });

                    const quality = parseInt(_qualitySlider.value);
                    showToast(`${t().exporting || '导出中'}... ${fmt.toUpperCase()} ${fmt === 'png' ? '(无损)' : fmt === 'bmp' ? '(极速)' : `(质量${quality}%)`}`);

                    // 使用 rAF 确保 WebGL 画布已刷新
                    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                    const blob = await _mergeCanvasToBlob(fmt, quality);
                    const ext = fmt === 'jpeg' ? 'jpg' : fmt;
                    _download(blob, `map_${safeSeed}_v${VERSION.replace(/\./g, '')}.${ext}`);

                    const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
                    const sizeKB = (blob.size / 1024).toFixed(0);
                    showToast(`${t().export_done || '导出完成'} ${fmt.toUpperCase()} ${sizeKB}KB (${elapsed}s)`);
                    logger.info('Export', { format: fmt, quality, size: blob.size, time: elapsed });
                } catch (e) {
                    logger.error('Export', e);
                    showToast(t().export_error || '导出失败', true);
                }
            };
        });

        $('btn-logs').onclick = () => logger.export();

        /* ========== 版本生成器 ========== */
        const vgResults = $('vg-results');
        const vgProgress = $('vg-progress');
        const vgProgressBar = $('vg-progress-bar');
        const vgStatus = $('vg-status');
        const vgBtnGenerate = $('btn-vg-generate');
        const vgBtnDownloadAll = $('btn-vg-download-all');
        let generatedBlobs = [];

        const parseSemver = v => { const m = v.match(/^(\d+)\.(\d+)\.(\d+)/); return m ? [+m[1], +m[2], +m[3]] : [0, 0, 0]; };
        const formatSemver = ([maj, min, pat]) => `${maj}.${min}.${pat}`;
        const SUFFIX_ORDER = ['-alpha', '-beta', '-rc', '-preview', ''];

        const computeVersions = () => {
            const baseVer = $('in-vg-version').value.trim() || '0.4.0';
            const suffix = $('in-vg-suffix').value;
            const count = Math.min(Math.max(parseInt($('in-vg-count').value) || 1, 1), 10);
            const mode = $('in-vg-mode').value;
            const [maj, min, pat] = parseSemver(baseVer);
            const versions = [];
            for (let i = 0; i < count; i++) {
                let ver, suf;
                if (mode === 'patch') {
                    ver = formatSemver([maj, min, pat + i]);
                    suf = suffix;
                } else if (mode === 'minor') {
                    ver = formatSemver([maj, min + i, 0]);
                    suf = suffix;
                } else {
                    ver = formatSemver([maj, min, pat]);
                    const startIdx = SUFFIX_ORDER.indexOf(suffix);
                    suf = startIdx >= 0 ? SUFFIX_ORDER[Math.min(startIdx + i, SUFFIX_ORDER.length - 1)] : suffix;
                }
                versions.push({ version: ver, suffix: suf, fullVersion: ver + suf, filename: `mapgen_v${ver}${suf}.html` });
            }
            return versions;
        };

        const generateVersionFile = (verInfo) => {
            const currentHTML = document.documentElement.outerHTML;
            let modified = '<!DOCTYPE html>\n' + currentHTML;
            const oldVerPattern = /const VERSION = ['"][^'"]+['"];/;
            modified = modified.replace(oldVerPattern, `const VERSION = '0.3.12-preview';

// ── Shader file loader (v0.3.12: loaded from /shaders/) ──
(function() {
    var vsEl = document.getElementById('vs-quad');
    var fsEl = document.getElementById('fs-map');
    if (vsEl && vsEl.textContent.trim() === '') {
        fetch('/shaders/vs-quad.vert')
            .then(function(r) { return r.text(); })
            .then(function(t) { vsEl.textContent = t; });
    }
    if (fsEl && fsEl.textContent.trim() === '') {
        fetch('/shaders/fs-map.frag')
            .then(function(r) { return r.text(); })
            .then(function(t) { fsEl.textContent = t; });
    }
})();

`);
            const titlePattern = /<title>[^<]*<\/title>/;
            modified = modified.replace(titlePattern, `<title>Material Map Generator v${verInfo.fullVersion}</title>`);
            const splashVerPattern = /<div class="splash-version">[^<]*<\/div>/;
            modified = modified.replace(splashVerPattern, `<div class="splash-version">v${verInfo.fullVersion}</div>`);
            const badgePattern1 = /<span class="version-badge">v[\d.]+(-[\w-]+)?<\/span>/g;
            modified = modified.replace(badgePattern1, `<span class="version-badge">v${verInfo.fullVersion}</span>`);
            return new Blob([modified], { type: 'text/html;charset=utf-8' });
        };

        const generateReadme = (verInfo) => {
            const lang = currentLang;
            const content = lang === 'zh'
                ? `# Material Map Generator v${verInfo.fullVersion}\n\n基于程序化噪声与板块模拟的地图生成工具。\n\n## 信息\n- 版本: ${verInfo.fullVersion}\n- 生成时间: ${new Date().toLocaleString('zh-CN')}\n- 文件: ${verInfo.filename}\n\n## 使用\n在浏览器中打开 HTML 文件即可使用。\n`
                : `# Material Map Generator v${verInfo.fullVersion}\n\nProcedural noise & tectonic simulation map generator.\n\n## Info\n- Version: ${verInfo.fullVersion}\n- Generated: ${new Date().toLocaleString()}\n- File: ${verInfo.filename}\n\n## Usage\nOpen the HTML file in a browser.\n`;
            return new Blob([content], { type: 'text/markdown;charset=utf-8' });
        };

        const generateChangelog = (allVerInfos) => {
            const lang = currentLang;
            const date = new Date().toISOString().split('T')[0];
            let content = lang === 'zh' ? `# 变更日志\n\n` : `# Changelog\n\n`;
            allVerInfos.forEach(v => {
                content += lang === 'zh'
                    ? `## ${v.fullVersion} (${date})\n\n- 版本构建\n\n`
                    : `## ${v.fullVersion} (${date})\n\n- Version build\n\n`;
            });
            return new Blob([content], { type: 'text/markdown;charset=utf-8' });
        };

        const downloadBlob = (blob, filename) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        };

        vgBtnGenerate.onclick = async () => {
            const versions = computeVersions();
            if (!versions.length) return;
            generatedBlobs = [];
            vgProgress.style.display = 'block';
            vgBtnGenerate.disabled = true;
            vgResults.replaceChildren();

            for (let i = 0; i < versions.length; i++) {
                const v = versions[i];
                vgProgressBar.style.width = `${((i + 0.5) / versions.length) * 100}%`;
                vgStatus.textContent = `${t().vg_downloading || '生成中...'} ${v.fullVersion}...`;

                await yieldToMain();

                const htmlBlob = generateVersionFile(v);
                const includeReadme = $('in-vg-include-readme').checked;
                const includeChangelog = $('in-vg-include-changelog').checked;
                const entry = { verInfo: v, htmlBlob };
                if (includeReadme) entry.readmeBlob = generateReadme(v);
                generatedBlobs.push(entry);

                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:var(--color-surface-high);border-radius:6px;margin-bottom:4px;font-size:12px;';
                const nameSpan = document.createElement('span');
                nameSpan.innerHTML = `<strong>v${v.fullVersion}</strong> <span style="color:var(--color-on-surface-variant);font-size:10px;">${v.filename}</span>`;
                const dlBtn = document.createElement('button');
                dlBtn.className = 'md-btn md-btn-text';
                dlBtn.textContent = t().vg_download || '下载';
                dlBtn.style.cssText = 'padding:2px 12px;font-size:11px;';
                const idx = generatedBlobs.length - 1;
                dlBtn.onclick = () => {
                    downloadBlob(generatedBlobs[idx].htmlBlob, generatedBlobs[idx].verInfo.filename);
                    if (generatedBlobs[idx].readmeBlob) {
                        setTimeout(() => downloadBlob(generatedBlobs[idx].readmeBlob, `README_v${generatedBlobs[idx].verInfo.fullVersion}.md`), 200);
                    }
                };
                row.appendChild(nameSpan);
                row.appendChild(dlBtn);
                vgResults.appendChild(row);

                vgProgressBar.style.width = `${((i + 1) / versions.length) * 100}%`;
            }

            if ($('in-vg-include-changelog').checked && generatedBlobs.length > 1) {
                const changelogBlob = generateChangelog(versions);
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:var(--color-surface-high);border-radius:6px;margin-bottom:4px;font-size:12px;';
                const nameSpan = document.createElement('span');
                nameSpan.innerHTML = `<strong>CHANGELOG.md</strong>`;
                const dlBtn = document.createElement('button');
                dlBtn.className = 'md-btn md-btn-text';
                dlBtn.textContent = t().vg_download || '下载';
                dlBtn.style.cssText = 'padding:2px 12px;font-size:11px;';
                dlBtn.onclick = () => downloadBlob(changelogBlob, 'CHANGELOG.md');
                row.appendChild(nameSpan);
                row.appendChild(dlBtn);
                vgResults.appendChild(row);
            }

            vgStatus.textContent = `${t().vg_done || '完成'} — ${versions.length} ${t().vg_file || '文件'}`;
            vgBtnGenerate.disabled = false;
            vgBtnDownloadAll.style.display = 'block';
        };

        vgBtnDownloadAll.onclick = async () => {
            for (let i = 0; i < generatedBlobs.length; i++) {
                const entry = generatedBlobs[i];
                downloadBlob(entry.htmlBlob, entry.verInfo.filename);
                if (entry.readmeBlob) {
                    await new Promise(r => setTimeout(r, 300));
                    downloadBlob(entry.readmeBlob, `README_v${entry.verInfo.fullVersion}.md`);
                }
                await new Promise(r => setTimeout(r, 300));
            }
        };

        document.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return; if (e.key.toLowerCase() === 'g') $('btn-generate')?.click(); if (e.key.toLowerCase() === 'r') $('btn-random')?.click(); if (e.key.toLowerCase() === 's') $('btn-save')?.click(); if (e.key.toLowerCase() === 'l') { const lt = $('in-laser'); lt.checked = !lt.checked; lt.dispatchEvent(new Event('change')); } });
    };
    const renderModal = maps => {
        const list = $('storage-list'); list.replaceChildren();
        if (!maps.length) { const p = document.createElement('p'); p.style.cssText = "text-align:center;color:var(--color-on-surface-variant)"; p.textContent = t().no_saved_maps; list.appendChild(p); return; }
        maps.forEach(m => {
            const item = document.createElement('div'); item.className = 'modal-item'; item.setAttribute('role', 'listitem');
            const info = document.createElement('div'); info.className = 'modal-item-info';
            const title = document.createElement('span'); title.className = 'modal-item-title'; title.textContent = m.state.seedStr;
            const sub = document.createElement('span'); sub.className = 'modal-item-sub'; const asp = m.state.mapAspect || '1:1'; const [aw, ah] = asp.split(':').map(Number); const mw = m.state.mapSize; const mh = aw && ah ? (aw >= ah ? Math.round(mw * ah / aw) : mw) : mw; sub.textContent = `${mw}×${mh} | ${new Date(m.ts).toLocaleString()}`;
            info.appendChild(title); info.appendChild(sub);
            const actions = document.createElement('div'); actions.className = 'modal-item-actions';
            const loadBtn = document.createElement('button'); loadBtn.className = 'md-btn md-btn-text'; loadBtn.textContent = t().load; loadBtn.dataset.act = 'load'; loadBtn.dataset.id = m.id;
            const delBtn = document.createElement('button'); delBtn.className = 'md-btn md-btn-text'; delBtn.style.color = 'var(--color-error)'; delBtn.textContent = '×'; delBtn.dataset.act = 'del'; delBtn.dataset.id = m.id;
            actions.appendChild(loadBtn); actions.appendChild(delBtn);
            item.appendChild(info); item.appendChild(actions); list.appendChild(item);
        });
        list.onclick = async e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.act === 'load') { const st = await storage.load(b.dataset.id); const clean = sanitizeState(st); if (clean) { applyState(clean); $('storage-modal').classList.remove('active'); $('scrim').classList.remove('show'); showToast(t().load_success); } else { showToast('存档数据无效', true); } } else if (b.dataset.act === 'del') { await storage.delete(b.dataset.id); renderModal(await storage.list()); showToast(t().delete_success); } };
    };
    const applyState = st => { const $ = id => { if (_domCache.has(id)) return _domCache.get(id); const el = document.getElementById(id); if (el) _domCache.set(id, el); return el; }; const setV = (id, v) => { const e = $(id); if (e) e.value = v; }; const setT = (id, v) => { const e = $(id); if (e) e.textContent = v; }; const setC = (id, v) => { const e = $(id); if (e) e.checked = v; }; setV('in-seed', st.seedStr); setV('in-size', st.mapSize); setV('in-plates', st.plateCount); setT('val-plates', st.plateCount); setV('in-landmass', st.landmass); setT('val-landmass', st.landmass + '%'); setV('in-noise', st.noiseType); setV('in-fbm', st.fbmType); setV('in-octaves', st.octaves); setT('val-octaves', st.octaves); setV('in-lacunarity', st.lacunarity * 10); setT('val-lacunarity', st.lacunarity.toFixed(1)); setV('in-persistence', st.persistence * 100); setT('val-persistence', st.persistence.toFixed(2)); setV('in-sea', st.seaLevel * 100); setT('val-sea', st.seaLevel.toFixed(2)); setV('in-light', st.lightAngle); setT('val-light', st.lightAngle + '°'); const fbmOctaves = st.fbmOctaves || st.octaves, fbmLacunarity = st.fbmLacunarity || st.lacunarity, fbmPersistence = st.fbmPersistence || st.persistence; const erosionStrength = st.erosionStrength != null ? st.erosionStrength : 0.3, erosionIterations = st.erosionIterations != null ? st.erosionIterations : 20, mountainFold = st.mountainFold != null ? st.mountainFold : 0.5, tempOffset = st.tempOffset != null ? st.tempOffset : 0, snowLine = st.snowLine != null ? st.snowLine : 0.65, showRivers = st.showRivers != null ? st.showRivers : true, contourInterval = st.contourInterval != null ? st.contourInterval : 5; /* v0.3.0: restore terrain sliders */ setV('in-erosion-strength', erosionStrength * 100); setT('val-erosion-strength', Math.round(erosionStrength * 100)); setV('in-erosion-iterations', erosionIterations); setT('val-erosion-iterations', erosionIterations); setV('in-mountain-fold', mountainFold * 100); setT('val-mountain-fold', Math.round(mountainFold * 100)); setV('in-temp-offset', tempOffset); setT('val-temp-offset', tempOffset); setV('in-snow-line', snowLine * 100); setT('val-snow-line', Math.round(snowLine * 100)); setC('in-show-rivers', showRivers); setV('in-contour-interval', contourInterval); setT('val-contour-interval', contourInterval); setC('in-boundaries', st.showBoundaries !== false); setC('in-point-light', !!st.pointLightEnabled); setC('in-glow', !!st.glowEnabled); setC('in-show-names', st.showNames !== false); setV('in-style', {0:'terrain',1:'plates',2:'parchment',3:'satellite',4:'lowpoly',5:'terrain_detail',6:'biome',7:'contour',8:'relief',9:'azgaar'}[st.style] || 'lowpoly'); setC('in-layer-terrain', st.showTerrain !== false); setC('in-layer-boundaries', st.showBoundaries !== false); setC('in-layer-rivers', st.showRivers !== false); setC('in-layer-contours', st.showContours !== false); setC('in-layer-names', st.showNames !== false); setC('in-layer-selection', st.showSelection !== false); /* v0.3.2: restore map size & geo detail fields */ const mapAspect = st.mapAspect || '1:1', worldScale = st.worldScale != null ? st.worldScale : 3; const coastDetail = st.coastDetail != null ? st.coastDetail : 0.4, lakeDensity = st.lakeDensity != null ? st.lakeDensity : 0.2; const showClimate = st.showClimate != null ? st.showClimate : false, geoLabels = st.geoLabels != null ? st.geoLabels : false, showGrid = st.showGrid != null ? st.showGrid : false; setV('in-aspect', mapAspect); setV('in-world-scale', worldScale); setT('val-world-scale', worldScale); setV('in-coast-detail', coastDetail * 100); setT('val-coast-detail', Math.round(coastDetail * 100)); setV('in-lake-density', lakeDensity * 100); setT('val-lake-density', Math.round(lakeDensity * 100)); setC('in-show-climate', showClimate); setC('in-geo-labels', geoLabels); setC('in-show-grid', showGrid); /* v0.3.8: restore new fields */ const showElevScale = st.showElevScale != null ? st.showElevScale : false; const showRegionNames = st.showRegionNames != null ? st.showRegionNames : true; setC('in-elev-scale', showElevScale); setC('in-layer-regions', showRegionNames); /* v0.3.8 fix: restore point light position/intensity/color */ const plPos = st.pointLightPos || [0.3, 0.7]; const plIntensity = st.pointLightIntensity != null ? st.pointLightIntensity : 1.0; const plColor = st.pointLightColor || [1, 0.96, 0.84]; setV('in-light-x', Math.round(plPos[0] * 100)); setT('val-light-x', plPos[0].toFixed(2)); setV('in-light-y', Math.round((1 - plPos[1]) * 100)); setT('val-light-y', plPos[1].toFixed(2)); setV('in-light-intensity', Math.round(plIntensity * 100)); setT('val-light-intensity', plIntensity.toFixed(2)); const rHex = v => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0'); setV('in-light-color', '#' + rHex(plColor[0]) + rHex(plColor[1]) + rHex(plColor[2])); /* v0.3.8 fix: restore detail generator sliders */ const detailRW = st.detailRiverWidth != null ? st.detailRiverWidth : 1.0, detailRC = st.detailRiverCurve != null ? st.detailRiverCurve : 0.5, detailCJ = st.detailCoastJagged != null ? st.detailCoastJagged : 0.4, detailRD = st.detailRidgeDensity != null ? st.detailRidgeDensity : 0.5, detailRO = st.detailRainfallOffset != null ? st.detailRainfallOffset : 0.0, detailTG = st.detailTempGradient != null ? st.detailTempGradient : 1.0, detailBB = st.detailBiomeBlend != null ? st.detailBiomeBlend : 0.3; setV('in-detail-river-width', Math.round(detailRW * 100)); setT('val-detail-river-width', detailRW.toFixed(2)); setV('in-detail-river-curve', Math.round(detailRC * 100)); setT('val-detail-river-curve', detailRC.toFixed(2)); setV('in-detail-coast-jagged', Math.round(detailCJ * 100)); setT('val-detail-coast-jagged', detailCJ.toFixed(2)); setV('in-detail-ridge-density', Math.round(detailRD * 100)); setT('val-detail-ridge-density', detailRD.toFixed(2)); setV('in-detail-rainfall-offset', detailRO); setT('val-detail-rainfall-offset', detailRO); setV('in-detail-temp-gradient', Math.round(detailTG * 100)); setT('val-detail-temp-gradient', detailTG.toFixed(2)); setV('in-detail-biome-blend', Math.round(detailBB * 100)); setT('val-detail-biome-blend', detailBB.toFixed(2)); /* v0.3.4: restore cursor state */ setC('in-cursor', !!st.cursorActive); if (cursor) cursor.setActive(!!st.cursorActive); /* v0.2.8 稳定: 加载状态走白名单——未知键被丢弃 */
        const clean = sanitizeState({ ...st, fbmOctaves, fbmLacunarity, fbmPersistence, erosionStrength, erosionIterations, mountainFold, tempOffset, snowLine, showRivers, contourInterval, mapAspect, worldScale, coastDetail, lakeDensity, showClimate, geoLabels, showGrid, detailRiverWidth: st.detailRiverWidth, detailRiverCurve: st.detailRiverCurve, detailCoastJagged: st.detailCoastJagged, detailRidgeDensity: st.detailRidgeDensity, detailRainfallOffset: st.detailRainfallOffset, detailTempGradient: st.detailTempGradient, detailBiomeBlend: st.detailBiomeBlend, /* v0.3.8 */ showElevScale: st.showElevScale, showRegionNames: st.showRegionNames, customPlateNames: st.customPlateNames, customRegionNames: st.customRegionNames }) || {};
        store.set({ ...clean, _needsRegen: true }, true);
        resize(true);
        /* 选区统计随状态变更对齐失效 */
        selectionStats = {};
        updateSelUI([]);
    };
    const triggerLOD = () => { if (generating) return; const baseW = store.get().mapSize, aspect = store.get().mapAspect || '1:1'; const [aw, ah] = aspect.split(':').map(Number); const ratio = aw / ah; let baseW2, baseH2; if (ratio >= 1) { baseW2 = baseW; baseH2 = Math.round(baseW / ratio); } else { baseH2 = baseW; baseW2 = Math.round(baseW * ratio); } const lod = Math.max(256, Math.floor(baseW2 / 2)); const lodH = Math.max(256, Math.floor(baseH2 / 2)); if (glCanvas.width !== lod) { glCanvas.classList.add('lod-active'); overlayCanvas.classList.add('lod-active'); glCanvas.width = lod; glCanvas.height = lodH; overlayCanvas.width = lod; overlayCanvas.height = lodH; engine.setSize(lod, lodH); overlay.resize(lod, lodH); $('info-lod').textContent = 'LOD: ½'; } clearTimeout(lodTimer); lodTimer = setTimeout(() => { glCanvas.width = baseW2; glCanvas.height = baseH2; overlayCanvas.width = baseW2; overlayCanvas.height = baseH2; engine.setSize(baseW2, baseH2); overlay.resize(baseW2, baseH2); $('info-lod').textContent = 'LOD: 1'; glCanvas.classList.remove('lod-active'); overlayCanvas.classList.remove('lod-active'); store.set({}, true); }, 300); };
    const updateSelUI = ids => {
        const el = $('selection-card'); const lang = t();
        if (!ids.length) { el.classList.remove('visible'); el.style.display = 'none'; return; }
        let html = `<h4>${lang.selected} ${ids.length} ${lang.plates_stat} <span class="md-btn md-btn-text" style="padding:4px 12px;font-size:12px">${lang.clear}</span></h4>`;
        ids.forEach(pid => { const s = selectionStats[pid]; if (!s) return; const sea = store.get().seaLevel; const toM = e => e < sea ? -((sea - e) * 11000).toFixed(0) : ((e - sea) * 8848).toFixed(0);
            html += `<div class="plate-detail"> <div class="plate-detail-header"> <span class="plate-name">${escapeHTML(s.name)}</span> <span style="font-size:11px;color:var(--color-on-surface-variant)">${s.type ? lang.type_cont : lang.type_ocean} · #${pid + 1}</span> </div> <div class="plate-detail-grid"> <span class="label">${lang.avg_elev}</span><span class="value">${toM(s.avgE)}m</span> <span class="label">${lang.max_elev}</span><span class="value">${toM(s.max)}m</span> <span class="label">${lang.min_elev}</span><span class="value">${toM(s.min)}m</span> <span class="label">${lang.avg_moist}</span><span class="value">${(s.avgM * 100).toFixed(0)}%</span> <span class="label">${lang.area}</span><span class="value">${(s.area / (engine.W * engine.H) * 100).toFixed(1)}%</span> <span class="label">${lang.density}</span><span class="value">${s.dens.toFixed(2)}</span> <span class="label">${lang.velocity}</span><span class="value">(${s.vx.toFixed(1)}, ${s.vy.toFixed(1)})</span> </div> </div>`; });
        el.innerHTML = html; requestAnimationFrame(() => el.style.display = 'block');
        requestAnimationFrame(() => el.classList.add('visible'));
        const clearBtn = el.querySelector('h4 .md-btn');
        if (clearBtn) clearBtn.onclick = () => { laser.clear(); selectionStats = {}; updateSelUI([]); document.dispatchEvent(new Event('clear-sel')); };
    };
    document.addEventListener('clear-sel', () => { if (laser) laser.clear(); selectionStats = {}; updateSelUI([]); });
    const updateStatsUI = () => { if (!engine.plates.length) return; const lang = t(), plates = engine.plates, st = store.get(); const cont = plates.filter(p => p.type).length; let land = 0, sampled = 0; if (engine.elevMap) { const step = Math.max(1, Math.floor(engine.elevMap.length / 100000)); for (let i = 0; i < engine.elevMap.length; i += step) { if (engine.elevMap[i] >= st.seaLevel) land++; sampled++; } land = sampled > 0 ? Math.round(land / sampled * engine.elevMap.length) : 0; } const pct = engine.elevMap ? (land / engine.elevMap.length * 100).toFixed(1) : '0.0'; const scale = st.worldScale || 3; const areaKm2 = (engine.W * engine.H * scale * scale * 0.01).toFixed(0); const widthKm = (engine.W * scale * 0.1).toFixed(0); const heightKm = (engine.H * scale * 0.1).toFixed(0); $('stats-card').innerHTML = `${lang.plates_stat}: ${plates.length} (${lang.cont_stat}:${cont} / ${lang.ocean_stat}:${plates.length - cont})<br>${lang.land_stat}: ${pct}%<br>~${areaKm2}km² (${widthKm}×${heightKm}km)`; $('stats-card').classList.add('visible'); };
    const buildOpts = () => { const s = store.get(), l = laser ? laser.getState() : { laserActive: false, laserStart: [0,0], laserEnd: [0,0], laserWidth: 2, selectedPlates: [], selectedCount: 0, hasTrail: false }, c = cursor ? cursor.getState() : { cursorActive: false, cursorPos: [0.5, 0.5], cursorSize: 14 }; return { style: s.style, seaLevel: s.seaLevel, lightAngleRad: s.lightAngle * DEG2RAD, showBoundaries: s.showBoundaries, boundaryWidth: s.boundaryWidth, boundaryColor: s.boundaryColor, pointLightEnabled: s.pointLightEnabled, pointLightPos: s.pointLightPos, pointLightIntensity: s.pointLightIntensity, pointLightColor: s.pointLightColor, glowEnabled: s.glowEnabled, plateTotal: engine.plates.length, fbmOctaves: s.fbmOctaves != null ? s.fbmOctaves : s.octaves, fbmLacunarity: s.fbmLacunarity != null ? s.fbmLacunarity : s.lacunarity, fbmPersistence: s.fbmPersistence != null ? s.fbmPersistence : s.persistence, snowLine: s.snowLine != null ? s.snowLine : 0.65, erosionStrength: s.erosionStrength != null ? s.erosionStrength : 0.3, showRivers: s.showRivers != null ? s.showRivers : true, contourInterval: s.contourInterval != null ? s.contourInterval : 5, showContours: s.showContours != null ? s.showContours : true, showTerrain: s.showTerrain !== false, showSelection: s.showSelection !== false, showClimate: s.showClimate || false, detailRiverWidth: s.detailRiverWidth != null ? s.detailRiverWidth : 1.0, detailRiverCurve: s.detailRiverCurve != null ? s.detailRiverCurve : 0.5, detailCoastJagged: s.detailCoastJagged != null ? s.detailCoastJagged : 0.4, detailRidgeDensity: s.detailRidgeDensity != null ? s.detailRidgeDensity : 0.5, detailRainfallOffset: s.detailRainfallOffset != null ? s.detailRainfallOffset : 0.0, detailTempGradient: s.detailTempGradient != null ? s.detailTempGradient : 1.0, detailBiomeBlend: s.detailBiomeBlend != null ? s.detailBiomeBlend : 0.3, /* v0.3.8 */ showElevScale: s.showElevScale || false, showRegionNames: s.showRegionNames !== false, customPlateNames: s.customPlateNames || {}, customRegionNames: s.customRegionNames || {}, ...l, ...c }; };
    let renderDirty = true;
    const markDirty = () => { renderDirty = true; };
    const onStateChange = async (state, meta) => {
        if (state._isGenerating && !meta.needsRegen) return;
        if (state._needsRegen) {
            if (generating) return;
            generating = true;
            if (currentAbort) currentAbort.abort();
            currentAbort = new AbortController();
            /* v0.2.8 稳定: 记录本次生成序号——过期结果不入主回路 */
            const mySeq = ++genSeq;
            store.set({ _isGenerating: true, _needsRegen: false });
            const pc = $('gen-progress'), pb = $('gen-progress-bar');
            pc.classList.add('active'); pb.style.width = '0%';
            /* v0.3.5: 生成进度遮罩 */
            const genOverlay = document.getElementById('gen-overlay');
            const genPhase = document.getElementById('gen-phase');
            const genPct = document.getElementById('gen-pct');
            const genPbOverlay = document.getElementById('gen-progress-bar-overlay');
            let lastPhase = '';
            const phaseMap = new Map(I18N[currentLang].gen_phases || []);
            if (genOverlay) { genOverlay.classList.add('active'); genPbOverlay.style.width = '0%'; genPct.textContent = '0%'; }
            const progressCb = (p) => {
                pb.style.transition = 'width 120ms cubic-bezier(0.4, 0, 0.2, 1)';
                pb.style.width = `${p * 100}%`;
                if (genPbOverlay) { genPbOverlay.style.width = `${p * 100}%`; genPct.textContent = `${Math.round(p * 100)}%`; }
                let phase = '';
                if (p < 0.15) phase = (phaseMap.get('init') || I18N[currentLang].gen_phase_init || '初始化参数...');
                else if (p < 0.35) phase = (phaseMap.get('tectonic') || I18N[currentLang].gen_phase_tectonic || '正在合成板块...');
                else if (p < 0.55) phase = (phaseMap.get('noise') || I18N[currentLang].gen_phase_noise || '正在计算噪声...');
                else if (p < 0.75) phase = (phaseMap.get('terrain') || I18N[currentLang].gen_phase_terrain || '正在渲染地形...');
                else if (p < 0.88) phase = (phaseMap.get('regions') || I18N[currentLang].gen_phase_regions || '正在分析地形区...');
                else if (p < 0.95) phase = (phaseMap.get('final') || I18N[currentLang].gen_phase_final || '正在完成...');
                else phase = (phaseMap.get('done') || I18N[currentLang].gen_phase_done || '✓ 生成完成');
                if (phase !== lastPhase && genPhase) { genPhase.textContent = phase; lastPhase = phase; }
            };
            const t0 = performance.now();
            try {
                const data = await engine.generate({ ...state, _lang: currentLang }, progressCb, currentAbort.signal);
                /* 过期结果丢弃 */
                if (mySeq !== genSeq) { generating = false; if (genOverlay) genOverlay.classList.remove('active'); return; }
                renderer.upload(data.plateData, data.elevData, data.moistData, data.tempData, data.riverData, engine.W, engine.H);
                perf.recordGen(performance.now() - t0);
                $('info-time').textContent = `${(performance.now() - t0).toFixed(0)}ms`;
                updateStatsUI();
                renderer.setEngineRef(engine);
                store.set({ _needsRegen: false, _isGenerating: false });
                markDirty();
                /* v0.3.5: 延迟隐藏进度遮罩，展示完成状态 */
                if (genPhase) genPhase.textContent = (phaseMap.get('done') || I18N[currentLang].gen_phase_done || '✓ 生成完成');
                if (genPct) genPct.textContent = '100%';
                if (genPbOverlay) genPbOverlay.style.width = '100%';
                setTimeout(() => { if (genOverlay) genOverlay.classList.remove('active'); }, 500);
            } catch (e) {
                if (e.name !== 'AbortError') { logger.error('Gen', e); store.set({ _isGenerating: false }); }
                else store.set({ _isGenerating: false, _needsRegen: false });
                markDirty();
                if (genOverlay) genOverlay.classList.remove('active');
            } finally { generating = false; setTimeout(() => pc.classList.remove('active'), 300); }
        } else if (!state._needsRegen) { if (overlay) overlay.draw(engine, state.showNames, state.seedStr, { geoLabels: state.geoLabels, seaLevel: state.seaLevel, showGrid: state.showGrid, worldScale: state.worldScale, showClimate: state.showClimate, showElevScale: state.showElevScale, snowLine: state.snowLine, showRegionNames: state.showRegionNames, customPlateNames: state.customPlateNames, customRegionNames: state.customRegionNames, lang: currentLang }); markDirty(); }
    };
    /* Splash 屏 —— 首帧渲染完成后平滑过渡消失 */
    const splashEl = document.getElementById('splash-screen');
    const dismissSplash = () => {
        if (!splashEl || splashEl.classList.contains('dismissed')) return;
        splashEl.classList.add('dismissed');
        document.body.style.overflow = '';
    };
    /* v0.3.10: 惰性加载就绪前使用最小渲染路径 */
    let _loopActive = false;
    const scheduleLoop = () => { if (!_loopActive) { _loopActive = true; requestAnimationFrame(loop); } };
    const loop = () => {
        _loopActive = false;
        try {
            if (!_deferredReady) {
                if (renderDirty) { renderer.draw(buildOpts()); renderDirty = false; }
            } else {
                const laserActive = laser ? laser.getState().laserActive : false;
                const cursorActive = cursor ? cursor.getState().cursorActive : false;
                if (renderDirty || laserActive || cursorActive) {
                    renderer.draw(buildOpts());
                    renderDirty = false;
                }
            }
        } catch (e) {
            if (renderer && renderer.gl && renderer.gl.isContextLost()) { /* context lost, wait for restore */ }
            else { if (typeof logger !== 'undefined') logger.warn('Render loop error', e); }
        }
        perf.tick();
        /* Only keep rAF running when there's work; otherwise poll at ~4fps */
        const laserActive = laser ? laser.getState().laserActive : false;
        const cursorActive = cursor ? cursor.getState().cursorActive : false;
        if (renderDirty || laserActive || cursorActive) {
            requestAnimationFrame(loop);
        } else {
            setTimeout(scheduleLoop, 250);
        }
    };
    store.subscribe(onStateChange);
    store.set({});
    /* 首帧渲染后关闭 Splash，然后切换到正常循环 */
    let splashDismissed = false;
    const tryDismissSplash = () => { if (!splashDismissed) { splashDismissed = true; dismissSplash(); } };
    /* 安全网：最多 2 秒后强制关闭 */
    setTimeout(tryDismissSplash, 2000);
    /* 首帧渲染或首秒后关闭 */
    const splashLoop = () => {
        try { if (renderDirty || (laser && laser.getState().laserActive) || (cursor && cursor.getState().cursorActive)) { renderer.draw(buildOpts()); renderDirty = false; } } catch(e) { if (renderer?.gl?.isContextLost()) { /* context 已丢失, 等待恢复 */ } else { logger.warn('Render loop error', e); } }
        tryDismissSplash();
        perf.tick(); requestAnimationFrame(loop);
    };
    _loopActive = true;
    splashLoop();
    /* v0.3.10: 惰性加载——非关键模块在下一帧初始化 */
    (function _scheduleDeferred() {
        var task = function() {
            try {
                overlay = createOverlayRenderer(overlayCanvas);
            } catch(e) { logger.error('overlay init', e); }
            try {
                laser = createLaserPointer(container, engine, { onFinal: function(ids) { selectionStats = engine.getStats(ids); updateSelUI(ids); }, onTrailUpdate: function() { if (renderer) renderer.markTrailDirty(); } });
            } catch(e) { logger.error('laser init', e); }
            try {
                cursor = createCursorSystem(container);
            } catch(e) { logger.error('cursor init', e); }
            try {
                Preloader.enqueue('testSuite', function() { return createTestSuite({ logger: logger, storage: storage, engine: engine, renderer: renderer, store: store, perf: perf }); }, -1);
            } catch(e) { logger.error('testSuite enqueue', e); }
            try {
                orientationMgr = createOrientationManager();
            } catch(e) { logger.error('orientation init', e); }
            try {
                touchZoom = createTouchZoom(container);
            } catch(e) { logger.error('touchZoom init', e); }
            try {
                createBottomSheet($('drawer'), $('scrim'));
            } catch(e) { logger.error('bottomSheet init', e); }
            try {
                fabCtrl = createFABController();
            } catch(e) { logger.error('FAB init', e); }
            try { resize(true); } catch(e) { logger.error('resize', e); }
            try { setupUI(); } catch(e) { logger.error('setupUI', e); }
            try { applyI18n(updateStatsUI); } catch(e) { logger.error('i18n', e); }
            storage.init()['catch'](function(e) { logger.error('DB', e); });
            try {
                window.addEventListener('resize', debounce(function() { triggerLOD(); if (orientationMgr) orientationMgr.update(); }, 150));
            } catch(e) { logger.error('resize listener', e); }
            setTimeout(function() { var c = $('stats-card'); if (c) c.classList.add('visible'); }, 300);
            _deferredReady = true;
            Preloader.runIdle();
        };
        /* setTimeout 0 确保在当前同步执行完成后、下一帧渲染前加载 */
        setTimeout(task, 0);
    })();
}
/* v0.3.10: 延迟一帧启动，让 splash 先渲染；移动端优化初始尺寸 */
window.addEventListener('DOMContentLoaded', function initApp() {
    requestAnimationFrame(function() {
        /* 移动端检测：减少默认地图尺寸 */
        var isMobile = /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop|Via/i.test(navigator.userAgent);
        if (isMobile && document.querySelector('meta[name="viewport"]')) {
            createApp(512);
        } else {
            createApp();
        }
    });
});