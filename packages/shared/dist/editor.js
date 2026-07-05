// 编辑器子系统：地形区检测 + 编辑命令 + 撤销栈
// 本文件先实现 detectTerrainRegions（命名系统依赖）；编辑命令/撤销栈在批次 F 补充。
import { labelComponents, computeComponentStats } from './connectedComponents.js';
import { EROSION_THRESHOLDS, CLIMATE_THRESHOLDS } from './constants.js';
// 类型 ID 编码（用于 Uint8Array 标记图）
const TYPE_IDS = {
    ocean: 0, mountain: 1, plateau: 2, basin: 3, desert: 4, forest: 5, plain: 6,
    glacier: 7, delta: 8, volcano: 9, archipelago: 10,
};
const TYPE_NAMES = ['ocean', 'mountain', 'plateau', 'basin', 'desert', 'forest', 'plain', 'glacier', 'delta', 'volcano', 'archipelago'];
const SLOPE_MOUNTAIN = 0.15;
const SLOPE_FLAT = 0.05;
const GLACIER_ICE_THRESHOLD = 0.3; // 陆地冰厚超过此值 → 冰川
const DELTA_COAST_RANGE = 10; // 距海岸像素数
const DELTA_RIVER_THRESHOLD = 0.05; // 河流掩码
const VOLCANO_MAX_AREA = 100; // 火山：孤立小山峰
const VOLCANO_MIN_ELEV = 0.75; // 火山最低高程
const VOLCANO_PROB_THRESHOLD = 0.35; // v2: 火山概率阈值
const ARCHIPELAGO_MAX_AREA = 50; // 群岛：小岛最大面积
/**
 * Single-pixel terrain classification.
 * Priority: ocean → glacier → delta → volcano → mountain → plateau → basin → desert → forest → plain
 * Glacier/delta/volcano require world-gen data from options; skipped if unavailable.
 * @param elev - Elevation value [−1, 1]
 * @param slope - Slope magnitude [0, 1]
 * @param moist - Moisture value [0, 1]
 * @param seaLevel - Sea level threshold
 * @param snowLine - Snow line elevation
 * @param idx - Pixel index for accessing option arrays
 * @param opts - Optional world-gen data (landIce/coastDist/riverMask/volcanoProb)
 * @returns Terrain type ID number
 */
function classifyTerrain(elev, slope, moist, seaLevel, snowLine, idx, opts) {
    if (elev <= seaLevel)
        return TYPE_IDS.ocean;
    // Glacier: land + sufficient ice thickness
    if (opts?.landIce && opts.landIce[idx] > GLACIER_ICE_THRESHOLD)
        return TYPE_IDS.glacier;
    // Delta: near coast + river mouth + low slope + low elevation
    if (opts?.coastDist && opts?.riverMask) {
        const cd = opts.coastDist[idx];
        if (cd > 0 && cd < DELTA_COAST_RANGE && opts.riverMask[idx] > DELTA_RIVER_THRESHOLD
            && slope < 0.03 && elev < seaLevel + 0.08) {
            return TYPE_IDS.delta;
        }
    }
    // v2: Volcano—high elevation + high volcano probability + steep slope
    if (opts?.volcanoProb && opts.volcanoProb[idx] > VOLCANO_PROB_THRESHOLD
        && elev > seaLevel + 0.3 && slope > SLOPE_MOUNTAIN * 0.7) {
        return TYPE_IDS.volcano;
    }
    if (elev > snowLine * 0.7 && slope > SLOPE_MOUNTAIN)
        return TYPE_IDS.mountain;
    if (elev > snowLine * 0.7 && slope < SLOPE_FLAT)
        return TYPE_IDS.plateau;
    // Basin: low-lying flat valley floor
    if (elev < seaLevel + EROSION_THRESHOLDS.BASIN_ELEVATION && slope < EROSION_THRESHOLDS.BASIN_SLOPE)
        return TYPE_IDS.basin;
    if (moist < CLIMATE_THRESHOLDS.ARID_BASE * 3)
        return TYPE_IDS.desert;
    if (moist > 0.6)
        return TYPE_IDS.forest;
    return TYPE_IDS.plain;
}
/**
 * 检测地形区连通域（AC-8.2 + 世界式增强）。
 * 4 邻接连通域标记 + 碎片过滤 + 质心/面积计算 + 后处理（火山/群岛）。
 *
 * @param minArea 面积小于此值的碎片被丢弃（默认 30 像素）
 * @param options 可选世界式数据（landIce/coastDist/riverMask），启用冰川/三角洲检测
 */
export function detectTerrainRegions(width, height, elevation, slope, moisture, seaLevel, snowLine, minArea = 30, options) {
    const size = width * height;
    const typeMap = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
        typeMap[i] = classifyTerrain(elevation[i], slope[i], moisture[i], seaLevel, snowLine, i, options);
    }
    const { labels, count } = labelComponents(width, height, (i) => typeMap[i] !== TYPE_IDS.ocean, (i, j) => typeMap[i] === typeMap[j]);
    const stats = computeComponentStats(width, height, labels);
    const oceanBorder = new Int32Array(count + 1);
    const landBorder = new Int32Array(count + 1);
    const sumElev = new Float64Array(count + 1);
    const regionType = new Uint8Array(count + 1);
    for (let i = 0; i < size; i++) {
        const lbl = labels[i];
        if (lbl === 0)
            continue;
        if (regionType[lbl] === 0)
            regionType[lbl] = typeMap[i];
        sumElev[lbl] += elevation[i];
    }
    for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
            const i = row + x;
            const lbl = labels[i];
            if (lbl === 0)
                continue;
            if (x + 1 < width) {
                const nl = labels[i + 1];
                if (nl === 0)
                    oceanBorder[lbl]++;
                else if (nl !== lbl)
                    landBorder[lbl]++;
            }
            if (y + 1 < height) {
                const nl = labels[i + width];
                if (nl === 0)
                    oceanBorder[lbl]++;
                else if (nl !== lbl)
                    landBorder[lbl]++;
            }
        }
    }
    const regions = [];
    const smallFragments = [];
    let regionCounter = 0;
    for (const [lbl, s] of stats) {
        const t = regionType[lbl];
        const ob = oceanBorder[lbl];
        const lb = landBorder[lbl];
        const centroid = [s.sumX / s.area, s.sumY / s.area];
        const count2 = s.area;
        if (t === TYPE_IDS.mountain && count2 < VOLCANO_MAX_AREA) {
            const avgE = sumElev[lbl] / count2;
            const totalBorder = ob + lb;
            if (avgE > VOLCANO_MIN_ELEV && (totalBorder === 0 || ob / totalBorder > 0.4)) {
                regions.push({
                    key: `r${regionCounter++}`,
                    type: 'volcano',
                    centroid, area: count2,
                });
                continue;
            }
        }
        if (count2 < ARCHIPELAGO_MAX_AREA && count2 >= 5
            && ob > 0
            && (ob + lb === 0 || ob / (ob + lb) > 0.7)) {
            smallFragments.push({
                key: `r${regionCounter++}`,
                type: 'archipelago',
                centroid, area: count2,
            });
            continue;
        }
        if (count2 >= minArea) {
            regions.push({
                key: `r${regionCounter++}`,
                type: TYPE_NAMES[t],
                centroid, area: count2,
            });
        }
        else if (count2 >= 5) {
            smallFragments.push({
                key: `r${regionCounter++}`,
                type: TYPE_NAMES[t],
                centroid, area: count2,
            });
        }
    }
    if (smallFragments.length >= 3) {
        const CLUSTER_DIST = 30;
        const used = new Uint8Array(smallFragments.length);
        for (let i = 0; i < smallFragments.length; i++) {
            if (used[i])
                continue;
            const cluster = [i];
            used[i] = 1;
            for (let j = i + 1; j < smallFragments.length; j++) {
                if (used[j])
                    continue;
                const dx = smallFragments[j].centroid[0] - smallFragments[i].centroid[0];
                const dy = smallFragments[j].centroid[1] - smallFragments[i].centroid[1];
                if (dx * dx + dy * dy < CLUSTER_DIST * CLUSTER_DIST) {
                    cluster.push(j);
                    used[j] = 1;
                }
            }
            if (cluster.length >= 3) {
                let cx = 0, cy = 0, ca = 0;
                for (const ci of cluster) {
                    cx += smallFragments[ci].centroid[0] * smallFragments[ci].area;
                    cy += smallFragments[ci].centroid[1] * smallFragments[ci].area;
                    ca += smallFragments[ci].area;
                }
                regions.push({
                    key: `r${regionCounter++}`,
                    type: 'archipelago',
                    centroid: [cx / ca, cy / ca],
                    area: ca,
                });
            }
        }
    }
    return regions;
}
/**
 * 撤销/重做栈。max=50（BR-3）。新编辑清空 redo 栈。
 */
export class CommandStack {
    constructor(max = 50) {
        this.undoStack = [];
        this.redoStack = [];
        this.max = max;
    }
    push(cmd) {
        this.undoStack.push(cmd);
        if (this.undoStack.length > this.max) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }
    undo() {
        const cmd = this.undoStack.pop();
        if (!cmd)
            return false;
        cmd.undo();
        this.redoStack.push(cmd);
        return true;
    }
    redo() {
        const cmd = this.redoStack.pop();
        if (!cmd)
            return false;
        cmd.redo();
        this.undoStack.push(cmd);
        return true;
    }
    get canUndo() { return this.undoStack.length > 0; }
    get canRedo() { return this.redoStack.length > 0; }
    get undoDepth() { return this.undoStack.length; }
    get redoDepth() { return this.redoStack.length; }
    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }
}
/** 高斯衰减（中心 1，边缘趋近 0） */
function gaussianFalloff(dist, radius) {
    const sigma = radius / 2;
    return Math.exp(-(dist * dist) / (2 * sigma * sigma));
}
/**
 * 画笔涂刷（AC-5.1, AC-5.2）。
 * 返回 Command，redo 已应用（调用方负责压栈）。
 * @param data  elevation 或 plateId 数组
 * @param target  raise/lower 调整高程；sea/land 设定陆海；plate-paint 切换板块
 */
export function applyBrushStroke(width, height, data, cx, cy, radius, strength, target, opts) {
    const seaLevel = opts?.seaLevel ?? 0;
    const targetPlateId = opts?.targetPlateId ?? 0;
    const r = Math.max(1, Math.floor(radius));
    const changes = [];
    const x0 = Math.max(0, Math.floor(cx) - r);
    const x1 = Math.min(width - 1, Math.floor(cx) + r);
    const y0 = Math.max(0, Math.floor(cy) - r);
    const y1 = Math.min(height - 1, Math.floor(cy) + r);
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            const dx = x - cx, dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > r)
                continue;
            const idx = y * width + x;
            const before = data[idx];
            let after = before;
            const fall = gaussianFalloff(dist, radius);
            switch (target) {
                case 'raise':
                    after = Math.min(1, before + strength * fall);
                    break;
                case 'lower':
                    after = Math.max(-1, before - strength * fall);
                    break;
                case 'sea': {
                    const seaTarget = seaLevel - 0.3;
                    after = before * (1 - fall) + seaTarget * fall;
                    break;
                }
                case 'land': {
                    const landTarget = 0.2;
                    after = before * (1 - fall) + landTarget * fall;
                    break;
                }
                case 'plate-paint':
                    // 板块涂刷：硬边（离散值不做高斯混合）
                    after = dist <= r ? targetPlateId : before;
                    break;
            }
            if (after !== before) {
                changes.push({ idx, before, after });
                data[idx] = after;
            }
        }
    }
    return {
        kind: 'brush',
        redo: () => { for (const c of changes)
            data[c.idx] = c.after; },
        undo: () => { for (const c of changes)
            data[c.idx] = c.before; },
    };
}
// ── 矢量线 → 山脉（AC-6.1）──
/** 点到线段最短距离 */
function pointToSegmentDist(px, py, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0)
        return Math.hypot(px - x0, py - y0);
    let t = ((px - x0) * dx + (py - y0) * dy) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}
export function applyVectorMountain(width, height, elevation, line, width_, mountainHeight) {
    const r = Math.max(1, width_);
    const changes = [];
    // 折线包围盒（含半径）
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of line) {
        if (x < minX)
            minX = x;
        if (x > maxX)
            maxX = x;
        if (y < minY)
            minY = y;
        if (y > maxY)
            maxY = y;
    }
    const x0 = Math.max(0, Math.floor(minX) - r);
    const x1 = Math.min(width - 1, Math.ceil(maxX) + r);
    const y0 = Math.max(0, Math.floor(minY) - r);
    const y1 = Math.min(height - 1, Math.ceil(maxY) + r);
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            // 像素中心点到折线的最短距离
            let minDist = Infinity;
            for (let i = 0; i < line.length - 1; i++) {
                const d = pointToSegmentDist(x + 0.5, y + 0.5, line[i][0], line[i][1], line[i + 1][0], line[i + 1][1]);
                if (d < minDist)
                    minDist = d;
            }
            if (minDist > r)
                continue;
            const idx = y * width + x;
            const before = elevation[idx];
            const fall = gaussianFalloff(minDist, r);
            // 抬升到目标（取 max，不破坏已有更高地形）
            const after = Math.max(before, before * (1 - fall) + mountainHeight * fall);
            if (after !== before) {
                changes.push({ idx, before, after });
                elevation[idx] = after;
            }
        }
    }
    return {
        kind: 'vector-mountain',
        redo: () => { for (const c of changes)
            elevation[c.idx] = c.after; },
        undo: () => { for (const c of changes)
            elevation[c.idx] = c.before; },
    };
}
// ── 矢量多边形 → 地形（AC-6.2）──
export function applyVectorPolygon(width, height, elevation, polygon, target, seaLevel = 0) {
    const targetElev = target === 'sea' ? seaLevel - 0.3
        : target === 'lake' ? seaLevel + 0.05
            : 0.2;
    const changes = [];
    // 多边形包围盒
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of polygon) {
        if (x < minX)
            minX = x;
        if (x > maxX)
            maxX = x;
        if (y < minY)
            minY = y;
        if (y > maxY)
            maxY = y;
    }
    minX = Math.max(0, Math.floor(minX));
    maxX = Math.min(width - 1, Math.ceil(maxX));
    minY = Math.max(0, Math.floor(minY));
    maxY = Math.min(height - 1, Math.ceil(maxY));
    // 射线法点在多边形内
    function inside(x, y) {
        let hit = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i][0], yi = polygon[i][1];
            const xj = polygon[j][0], yj = polygon[j][1];
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi)) {
                hit = !hit;
            }
        }
        return hit;
    }
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            if (!inside(x + 0.5, y + 0.5))
                continue;
            const idx = y * width + x;
            const before = elevation[idx];
            if (before !== targetElev) {
                changes.push({ idx, before, after: targetElev });
                elevation[idx] = targetElev;
            }
        }
    }
    return {
        kind: 'vector-terrain',
        redo: () => { for (const c of changes)
            elevation[c.idx] = c.after; },
        undo: () => { for (const c of changes)
            elevation[c.idx] = c.before; },
    };
}
// ── 板块几何重算（plate-paint/拖拽后，plateId 已变，需同步 plateDist + plates.type）──
/**
 * 基于当前 plateId 重算每个板块的质心、type、plateDist。
 * - 质心：板块所有像素的算术平均（像素坐标）。
 * - type：板块像素平均高程 > seaLevel → continent，否则 ocean。
 * - plateDist：每个像素到所属板块质心的欧氏距离（像素单位）。
 *
 * 用于 plate-paint / 板块拖拽后局部重算高程前，修正 generateElevation 依赖的几何量。
 */
export function recomputePlateGeometry(width, height, plateId, plates, elevation, seaLevel) {
    const size = width * height;
    const n = plates.length;
    const sumX = new Float64Array(n);
    const sumY = new Float64Array(n);
    const cnt = new Float64Array(n);
    const sumElev = new Float64Array(n);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const pid = plateId[idx] | 0;
            if (pid < 0 || pid >= n)
                continue;
            sumX[pid] += x;
            sumY[pid] += y;
            cnt[pid]++;
            sumElev[pid] += elevation[idx];
        }
    }
    const cx = new Float64Array(n);
    const cy = new Float64Array(n);
    const newPlates = plates.map((p, i) => {
        const ccx = cnt[i] > 0 ? sumX[i] / cnt[i] : p.x * width;
        const ccy = cnt[i] > 0 ? sumY[i] / cnt[i] : p.y * height;
        cx[i] = ccx;
        cy[i] = ccy;
        const meanElev = cnt[i] > 0 ? sumElev[i] / cnt[i] : seaLevel - 0.3;
        return {
            ...p,
            x: ccx / width,
            y: ccy / height,
            type: (meanElev > seaLevel ? 'continent' : 'ocean'),
            area: cnt[i],
        };
    });
    const plateDist = new Float32Array(size);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const pid = plateId[idx] | 0;
            if (pid < 0 || pid >= n) {
                plateDist[idx] = 0;
                continue;
            }
            const dx = x - cx[pid], dy = y - cy[pid];
            plateDist[idx] = Math.sqrt(dx * dx + dy * dy);
        }
    }
    return { plateDist, plates: newPlates };
}
// ── 板块拖拽（AC-7.1）──
export function movePlate(width, height, plateId, plateIdValue, dx, dy) {
    const size = width * height;
    // 收集该板块所有像素位置
    const srcPositions = [];
    for (let i = 0; i < size; i++) {
        if (plateId[i] === plateIdValue)
            srcPositions.push(i);
    }
    // 记录受影响单元格（源位置 + 目标位置）的 before
    const affected = new Map();
    for (const idx of srcPositions) {
        if (!affected.has(idx))
            affected.set(idx, plateId[idx]);
        const x = idx % width;
        const y = (idx / width) | 0;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nidx = ny * width + nx;
            if (!affected.has(nidx))
                affected.set(nidx, plateId[nidx]);
        }
    }
    function apply(doMove) {
        // 先把源位置填 0（海洋/空），再把目标位置设为 plateIdValue
        if (doMove) {
            for (const idx of srcPositions)
                plateId[idx] = 0;
            for (const idx of srcPositions) {
                const x = idx % width;
                const y = (idx / width) | 0;
                const nx = x + dx, ny = y + dy;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    plateId[ny * width + nx] = plateIdValue;
                }
            }
        }
        else {
            // undo：恢复 affected 的 before
            for (const [idx, before] of affected)
                plateId[idx] = before;
        }
    }
    // redo = 移动，undo = 恢复 affected
    return {
        kind: 'plate-move',
        redo: () => apply(true),
        undo: () => apply(false),
    };
}
