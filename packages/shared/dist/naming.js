// Naming system: automatic narrative names for plates and terrain regions
// AC-8.1, AC-8.2, AC-8.4, AC-8.5, BR-4 (seed-driven determinism)
import { detectTerrainRegions } from './editor.js';
// ── 词库（BR-5：默认中文）──
const DIRECTION_8 = ['东', '东南', '南', '西南', '西', '西北', '北', '东北'];
const DIRECTION_CENTER = '中央';
const PLATE_TYPE_WORDS = {
    continent: ['大陆', '洲', '陆地'],
    ocean: ['洋', '海', '湾'],
};
const TERRAIN_WORDS = {
    mountain: ['山脉', '山脊', '峰群'],
    plain: ['平原', '草原', '低地'],
    plateau: ['高原', '台地'],
    basin: ['盆地', '洼地'],
    desert: ['沙漠', '荒原'],
    forest: ['森林', '林地'],
    glacier: ['冰川', '冰原', '冰盖'],
    delta: ['三角洲', '河口'],
    volcano: ['火山', '熔岩峰'],
    archipelago: ['群岛', '列岛'],
};
// 专有名词库（≥ 50，确保大地图地形区专有名不重复）
const PROPER_NAMES = [
    '龙脊', '银沙', '苍穹', '碧落', '玄铁', '霜语', '烈焰', '深岚', '星陨', '月隐',
    '风哭', '雷鸣', '雪啸', '云隐', '雾锁', '冰封', '岩心', '水晶', '琥珀', '翡翠',
    '青铜', '赤金', '墨玉', '白霜', '紫电', '青风', '蓝潮', '红土', '黑石', '白银',
    '飞鹰', '潜龙', '奔狼', '眠熊', '孤鹫', '游鳞', '隐豹', '怒象', '静鹿', '寒鸦',
    '永恒', '破碎', '低语', '回响', '残辉', '暮色', '晨曦', '星河', '云海', '雾林',
    '古战场', '神殿', '遗迹', '圣地', '荒原', '裂谷', '天堑', '玄关',
];
// ── mulberry32 PRNG（轻量确定性）──
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/**
 * 由质心相对地图中心方位角确定方向词。
 * 屏幕坐标 y 向下，atan2(dy, dx) 中 dy>0 表示南方。
 */
function directionFor(centroid, width, height) {
    const cx = width * 0.5, cy = height * 0.5;
    const dx = centroid[0] - cx;
    const dy = centroid[1] - cy;
    // 接近中心 → 中央
    if (Math.abs(dx) < width * 0.12 && Math.abs(dy) < height * 0.12) {
        return DIRECTION_CENTER;
    }
    const ang = Math.atan2(dy, dx); // -π..π，y 向下故 dy>0 = 南
    // 8 扇区，每扇 π/4，以东为 0 起始；+π/8 让扇区以正方向为中心
    const sector = Math.floor(((ang + Math.PI / 8) / (Math.PI / 4) + 8)) % 8;
    return DIRECTION_8[sector];
}
/**
 * 生成板块与地形区名称。
 * @param seed  PRNG 种子（同一地图 seed → 同一名称集，BR-4）
 * @param width 地图宽度（像素）
 * @param height 地图高度（像素）
 * @param plates 待命名的板块
 * @param regions 待命名的地形区
 */
export function generateNames(seed, width, height, plates, regions) {
    const rng = mulberry32(seed || 1);
    // ── 板块名：方位词 + 类型词（AC-8.4）──
    // 同方位多板块时追加序号避免重名
    const dirCount = new Map();
    const namedPlates = plates.map(p => {
        const dir = directionFor(p.centroid, width, height);
        const typeWords = PLATE_TYPE_WORDS[p.type];
        const typeWord = typeWords[Math.floor(rng() * typeWords.length)];
        const cnt = (dirCount.get(dir) ?? 0) + 1;
        dirCount.set(dir, cnt);
        // 首个不加序号；后续同方位加序号（如「北大陆」「北二大陆」）
        const name = cnt === 1 ? `${dir}${typeWord}` : `${dir}${cnt}${typeWord}`;
        return { plateId: p.plateId, type: p.type, name, centroid: p.centroid };
    });
    // ── 地形区名：专有名（不重复）+ 地貌词（AC-8.5）──
    const usedProper = new Set();
    const shuffledProper = [...PROPER_NAMES];
    // Fisher-Yates 洗牌（rng 驱动）
    for (let i = shuffledProper.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffledProper[i], shuffledProper[j]] = [shuffledProper[j], shuffledProper[i]];
    }
    let properIdx = 0;
    let serial = 1; // 词库耗尽后追加的序号
    const namedRegions = regions.map(r => {
        // 取下一个未用专有名；若全部用尽，追加序号保证唯一
        let proper = shuffledProper[properIdx % shuffledProper.length];
        properIdx++;
        while (usedProper.has(proper)) {
            proper = `${shuffledProper[properIdx % shuffledProper.length]}${serial++}`;
            properIdx++;
        }
        usedProper.add(proper);
        const terrainWords = TERRAIN_WORDS[r.type];
        const terrainWord = terrainWords[Math.floor(rng() * terrainWords.length)];
        return {
            key: r.key,
            type: r.type,
            name: `${proper}${terrainWord}`,
            centroid: r.centroid,
            area: r.area,
        };
    });
    return { plates: namedPlates, regions: namedRegions };
}
/**
 * 编辑后刷新名称：从 MapData 纹理重算板块质心、检测地形区、生成名称，并保留旧板块名（含用户改名）。
 * 高内聚：把 plateCentroid 计算 + detectTerrainRegions + generateNames + 旧名保留 收敛到 core 层。
 *
 * @param md          MapData（读 elevTex/moistTex/plateTex，写 names）
 * @param seaLevel    海平面
 * @param snowLine    雪线
 * @param plateCount  板块数（用于 plateTex 解码）
 * @param slope       预提取的坡度场（若未提供则从 elevTex 通道1 读取）
 */
export function regenerateNames(md, seaLevel, snowLine, plateCount, slope) {
    const { width, height } = md;
    const size = width * height;
    const elevation = new Float32Array(size);
    const moisture = new Float32Array(size);
    const sl = slope ?? new Float32Array(size);
    for (let i = 0; i < size; i++) {
        elevation[i] = md.elevTex[i * 4];
        if (!slope)
            sl[i] = md.elevTex[i * 4 + 1];
        moisture[i] = md.moistTex[i * 4];
    }
    // 提取世界式数据用于地形区检测（冰川/三角洲）
    const terrainOpts = {};
    if (md.iceTex) {
        const landIce = new Float32Array(size);
        for (let i = 0; i < size; i++)
            landIce[i] = md.iceTex[i * 4];
        terrainOpts.landIce = landIce;
    }
    if (md.coastDist)
        terrainOpts.coastDist = md.coastDist;
    if (md.riverTex) {
        const riverMask = new Float32Array(size);
        for (let i = 0; i < size; i++)
            riverMask[i] = md.riverTex[i * 4];
        terrainOpts.riverMask = riverMask;
    }
    // 板块质心
    const plateSumX = new Float64Array(md.plates.length);
    const plateSumY = new Float64Array(md.plates.length);
    const plateCnt = new Float64Array(md.plates.length);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const pid = Math.round(md.plateTex[(y * width + x) * 4] * plateCount);
            if (pid >= 0 && pid < md.plates.length) {
                plateSumX[pid] += x;
                plateSumY[pid] += y;
                plateCnt[pid]++;
            }
        }
    }
    const nameablePlates = md.plates.map((p, i) => ({
        plateId: i,
        type: (p.type === 'continent' ? 'continent' : 'ocean'),
        centroid: (plateCnt[i] > 0
            ? [plateSumX[i] / plateCnt[i], plateSumY[i] / plateCnt[i]]
            : [width * 0.5, height * 0.5]),
    }));
    // 检测地形区（detectTerrainRegions 已在顶部静态导入，含世界式增强）
    const detected = detectTerrainRegions(width, height, elevation, sl, moisture, seaLevel, snowLine, 30, terrainOpts);
    const nameableRegions = detected.map(r => ({ key: r.key, type: r.type, centroid: r.centroid, area: r.area }));
    const fresh = generateNames(md.seed, width, height, nameablePlates, nameableRegions);
    // 保留旧板块名（按 plateId，含用户改名）；地形区名随连通域变化而刷新
    const oldPlateNames = new Map(md.names.plates.map(p => [p.plateId, p.name]));
    fresh.plates = fresh.plates.map(p => {
        const old = oldPlateNames.get(p.plateId);
        return old ? { ...p, name: old } : p;
    });
    md.names = fresh;
}
