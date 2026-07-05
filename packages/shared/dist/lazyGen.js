// 惰性生成：视野局部高分辨率重算。
// 当用户放大到一定级别时，对可见区域生成高分辨率高程细节（双线性上采样 + 高频噪声叠加），
// 并检测小尺度山峰/山脊——这些在基础分辨率下不可见，放大后才需计算（惰性）。
import { createNoise } from './noise.js';
/** 双线性采样基础高程到高分辨率网格 */
function bilinearSample(base, baseW, baseH, mapX, mapY) {
    // 钳制到基础网格范围
    const fx = Math.max(0, Math.min(baseW - 1.001, mapX));
    const fy = Math.max(0, Math.min(baseH - 1.001, mapY));
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const tx = fx - x0;
    const ty = fy - y0;
    const v00 = base[y0 * baseW + x0];
    const v10 = base[y0 * baseW + x1];
    const v01 = base[y1 * baseW + x0];
    const v11 = base[y1 * baseW + x1];
    const top = v00 + (v10 - v00) * tx;
    const bot = v01 + (v11 - v01) * tx;
    return top + (bot - top) * ty;
}
/**
 * 为视野区域生成高分辨率高程细节。
 * 算法：双线性上采样基础高程 + 高频 FBM 噪声叠加（仅高频 octave，不重复低频）。
 *
 * @param detailStrength 噪声叠加强度（0.02~0.08，越大细节越粗）
 * @param detailOctaves 高频 octave 起始层（默认 4，即从第 4 个 octave 开始叠加）
 */
export function computeDetailPatch(baseElevation, baseWidth, baseHeight, region, seed, noiseType = 'perlin', fbmType = 'standard', lacunarity = 2.0, persistence = 0.5, detailStrength = 0.04, detailOctaves = 3) {
    const { x: rx, y: ry, w: rw, h: rh, outW, outH } = region;
    const size = outW * outH;
    const elevation = new Float32Array(size);
    const noise = createNoise(seed + 7919, noiseType); // 偏移种子避免与主噪声相关
    // 视野到地图坐标的缩放比
    const sx = rw / outW;
    const sy = rh / outH;
    // 噪声采样频率：基础网格的 lacunarity^detailOctaves 倍（仅高频层）
    const baseFreq = lacunarity * lacunarity; // 起始 ~4x 基础频率
    for (let py = 0; py < outH; py++) {
        const mapY = ry + py * sy;
        for (let px = 0; px < outW; px++) {
            const mapX = rx + px * sx;
            const idx = py * outW + px;
            // 1. 双线性上采样基础高程
            let elev = bilinearSample(baseElevation, baseWidth, baseHeight, mapX, mapY);
            // 2. 高频噪声叠加（仅高频 octave，模拟基础网格丢失的细节）
            const nx = mapX * baseFreq;
            const ny = mapY * baseFreq;
            let detail = 0, amp = 1, freq = 1, maxV = 0;
            for (let o = 0; o < detailOctaves; o++) {
                let n = noise.sample(nx * freq, ny * freq);
                if (fbmType === 'ridged')
                    n = 1 - Math.abs(n);
                else if (fbmType === 'billowy')
                    n = Math.abs(n);
                detail += n * amp;
                maxV += amp;
                amp *= persistence;
                freq *= lacunarity;
            }
            detail = (detail / maxV - 0.5) * detailStrength;
            elev += detail;
            elevation[idx] = elev < 0 ? 0 : elev > 1 ? 1 : elev;
        }
    }
    // 计算坡度（中心差分）
    const slope = new Float32Array(size);
    for (let py = 1; py < outH - 1; py++) {
        for (let px = 1; px < outW - 1; px++) {
            const idx = py * outW + px;
            const dzx = elevation[idx + 1] - elevation[idx - 1];
            const dzy = elevation[idx + outW] - elevation[idx - outW];
            slope[idx] = Math.sqrt(dzx * dzx + dzy * dzy) * 0.5;
        }
    }
    return { width: outW, height: outH, elevation, slope, region };
}
/**
 * 在高分辨率网格中检测局部山峰（用于放大后标注）。
 * 局部极大值 + 突出度过滤——仅保留显著的山峰。
 *
 * @param minProminence 最小突出度（相对周围最低点的高差），默认 0.03
 * @param minSpacing 最小间距（像素），避免密集标注，默认 8
 */
export function detectDetailPeaks(patch, seaLevel, minProminence = 0.03, minSpacing = 8) {
    const { width: w, height: h, elevation, region } = patch;
    const candidates = [];
    const R = 3; // 局部极大值检查半径
    for (let py = R; py < h - R; py++) {
        for (let px = R; px < w - R; px++) {
            const idx = py * w + px;
            const elev = elevation[idx];
            if (elev <= seaLevel + 0.1)
                continue; // 仅陆地高地
            // 检查是否为局部极大值
            let isMax = true;
            for (let dy = -R; dy <= R && isMax; dy++) {
                for (let dx = -R; dx <= R; dx++) {
                    if (dx === 0 && dy === 0)
                        continue;
                    if (elevation[idx + dy * w + dx] > elev) {
                        isMax = false;
                        break;
                    }
                }
            }
            if (!isMax)
                continue;
            // 计算突出度：周围 R*3 半径内的最低点与峰值之差
            const probeR = R * 3;
            let minElev = 1;
            for (let dy = -probeR; dy <= probeR; dy++) {
                for (let dx = -probeR; dx <= probeR; dx++) {
                    const nx = px + dx, ny = py + dy;
                    if (nx < 0 || nx >= w || ny < 0 || ny >= h)
                        continue;
                    const e = elevation[ny * w + nx];
                    if (e < minElev)
                        minElev = e;
                }
            }
            const prominence = elev - minElev;
            if (prominence < minProminence)
                continue;
            candidates.push({
                x: px, y: py,
                mapX: region.x + px * (region.w / w),
                mapY: region.y + py * (region.h / h),
                elevation: elev,
                prominence,
            });
        }
    }
    // 间距过滤：保留每个 minSpacing 半径内突出度最高的峰
    candidates.sort((a, b) => b.prominence - a.prominence);
    const kept = [];
    for (const c of candidates) {
        let tooClose = false;
        for (const k of kept) {
            const dx = c.x - k.x, dy = c.y - k.y;
            if (dx * dx + dy * dy < minSpacing * minSpacing) {
                tooClose = true;
                break;
            }
        }
        if (!tooClose)
            kept.push(c);
    }
    return kept;
}
