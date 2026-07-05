import { createNoise } from './noise.js';
import { computeSlope } from './slope.js';
import { BOUNDARY_SMOOTH, } from './constants.js';
const EROSION_DIRS = new Int16Array([-1, 0, 1, 0, 0, -1, 0, 1, -1, -1, -1, 1, 1, -1, 1, 1]);
export function generateElevation(width, height, seed, plateId, plates, plateDist, tectonicForce, noiseType, fbmType, octaves, lacunarity, persistence, seaLevel, mountainFold, coastDetail) {
    const size = width * height;
    const elevation = new Float32Array(size);
    const ridge = new Float32Array(size);
    const ridgeMask = new Float32Array(size);
    const noise = createNoise(seed, noiseType);
    const detailNoise = createNoise(seed + 1, 'simplex');
    const ridgeNoise = createNoise(seed + 999, 'perlin');
    const plateTypes = new Uint8Array(plates.length);
    for (let i = 0; i < plates.length; i++) {
        plateTypes[i] = plates[i].type === 'continent' ? 1 : 0;
    }
    // 预计算每个板块的归一化距离（0=中心, 1=边缘）
    // plateDist 是到板块中心的欧氏距离，需估计各板块的最大距离用于归一化
    const plateMaxDist = new Float32Array(plates.length);
    for (let i = 0; i < size; i++) {
        const pid = plateId[i] | 0;
        if (plateDist[i] > plateMaxDist[pid])
            plateMaxDist[pid] = plateDist[i];
    }
    const invW = 1 / width;
    const invH = 1 / height;
    for (let y = 0; y < height; y++) {
        const ny = y * invH;
        const row = y * width;
        for (let x = 0; x < width; x++) {
            const idx = row + x;
            const nx = x * invW;
            const pid = plateId[idx] | 0;
            const isContinental = plateTypes[pid] === 1;
            // ── 1. 板块基础高度（Azgaar：板块类型决定陆/海基底）──
            const maxD = plateMaxDist[pid] || 1;
            const normDist = plateDist[idx] / maxD; // 0 中心 → 1 边缘
            let elev;
            if (isContinental) {
                // 大陆：内部高，边缘大陆架下降
                const shelf = smoothstep(0.5, 1.0, normDist); // 边缘 ~0.4 衰减
                elev = 0.35 - shelf * 0.15;
            }
            else {
                // 大洋：中心深，边缘略浅（洋中脊由构造力处理）
                const abyss = 1 - smoothstep(0.0, 0.7, normDist);
                elev = -0.35 - abyss * 0.25;
            }
            // ── 2. 多尺度地形噪声（自然 FBM：谱权重+域形变+各向异性）──
            // 陆地：ridged（山脊）混合 standard（细节），海洋：standard 平滑
            if (isContinental) {
                const ridged = noise.fbmNatural(nx * 5, ny * 5, octaves, lacunarity, persistence, 'ridged', { warpStrength: 0.4, ridgeAngle: 0, anisotropy: 0.5 });
                const detail = noise.fbmNatural(nx * 5, ny * 5, octaves, lacunarity, persistence, 'standard', { warpStrength: 0.4 });
                elev += ridged * 0.12 + detail * 0.14;
            }
            else {
                const detail = noise.fbmNatural(nx * 5, ny * 5, octaves, lacunarity, persistence, 'standard', { warpStrength: 0.3 });
                elev += detail * 0.10;
            }
            // ── 3. 山脊场（用于独立山脊图层）──
            const r = ridgeNoise.fbm(nx * 8, ny * 8, 4, 2, 0.5, 'ridged');
            ridge[idx] = r;
            ridgeMask[idx] = r > 0.55 && elev > seaLevel ? 1 : 0;
            // ── 4. 海岸细节抖动 ──
            if (coastDetail > 0 && Math.abs(elev - seaLevel) < 0.12) {
                const cn = detailNoise.fbm(nx * 18, ny * 18, 3, 2, 0.5, 'standard');
                elev += cn * coastDetail * 0.06;
            }
            elevation[idx] = elev < -1 ? -1 : elev > 1 ? 1 : elev;
        }
    }
    // ── Plate boundary transition smoothing (AC-4.1) ──
    // Mark boundary band: radius-BAND_RADIUS neighborhood around plateId changes, apply 2-pass neighborhood averaging
    const boundaryBand = new Uint8Array(size);
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const pid = plateId[idx];
            if (plateId[idx - 1] !== pid || plateId[idx + 1] !== pid ||
                plateId[idx - width] !== pid || plateId[idx + width] !== pid) {
                for (let dy = -BOUNDARY_SMOOTH.BAND_RADIUS; dy <= BOUNDARY_SMOOTH.BAND_RADIUS; dy++) {
                    for (let dx = -BOUNDARY_SMOOTH.BAND_RADIUS; dx <= BOUNDARY_SMOOTH.BAND_RADIUS; dx++) {
                        const ny = y + dy, nx = x + dx;
                        if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                            boundaryBand[ny * width + nx] = 1;
                        }
                    }
                }
            }
        }
    }
    const smoothed = new Float32Array(elevation);
    for (let pass = 0; pass < BOUNDARY_SMOOTH.PASSES; pass++) {
        const src = pass === 0 ? elevation : smoothed;
        const dst = pass === 0 ? smoothed : elevation;
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                if (!boundaryBand[idx]) {
                    if (pass === 1)
                        dst[idx] = src[idx];
                    continue;
                }
                let sum = src[idx];
                let cnt = 1;
                for (let dy = -BOUNDARY_SMOOTH.BAND_RADIUS; dy <= BOUNDARY_SMOOTH.BAND_RADIUS; dy++) {
                    for (let dx = -BOUNDARY_SMOOTH.BAND_RADIUS; dx <= BOUNDARY_SMOOTH.BAND_RADIUS; dx++) {
                        if (dx === 0 && dy === 0)
                            continue;
                        const ni = (y + dy) * width + (x + dx);
                        sum += src[ni];
                        cnt++;
                    }
                }
                dst[idx] = sum / cnt;
            }
        }
    }
    // ── Boundary tectonic force overlay (AC-4.2, applied after smoothing to avoid dilution) ──
    // 汇聚→山脉（ridhed 噪声增强走向），离散→裂谷
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const tf = tectonicForce[idx];
            if (tf === 0)
                continue;
            const nx = x / width, ny = y / height;
            if (tf > 0) {
                let m = tf * mountainFold * 0.8;
                m += (ridgeNoise.fbm(nx * 30, ny * 30, 3, 2, 0.5, 'ridged') - 0.5) * mountainFold * 0.25;
                elevation[idx] = Math.min(1, elevation[idx] + m);
            }
            else {
                elevation[idx] = Math.max(-1, elevation[idx] + tf * mountainFold * 0.4);
            }
        }
    }
    // 坡度由共享 computeSlope 计算（与编辑器/refreshNames 标度一致）
    const slope = computeSlope(width, height, elevation);
    return { elevation, slope, ridge, ridgeMask };
}
function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}
export function hydraulicErosion(width, height, elevation, iterations, strength, evaporationRate = 0.01) {
    const elev = new Float32Array(elevation);
    const size = width * height;
    const water = new Float32Array(size);
    const sediment = new Float32Array(size);
    const dirs = EROSION_DIRS;
    const maxChangeThreshold = 1e-5;
    for (let iter = 0; iter < iterations; iter++) {
        for (let i = 0; i < size; i++) {
            if (elev[i] > 0)
                water[i] += 0.01;
        }
        let totalChange = 0;
        for (let y = 1; y < height - 1; y++) {
            const rowBase = y * width;
            for (let x = 1; x < width - 1; x++) {
                const idx = rowBase + x;
                const e = elev[idx];
                let minE = e, minDir = -1;
                for (let d = 0; d < 8; d++) {
                    const ni = idx + dirs[d * 2] + dirs[d * 2 + 1] * width;
                    const ne = elev[ni];
                    if (ne < minE) {
                        minE = ne;
                        minDir = d;
                    }
                }
                if (minDir >= 0) {
                    const slp = e - minE;
                    const carryCapacity = slp * water[idx] * strength * (1 + slp * 5);
                    const sDiff = carryCapacity - sediment[idx];
                    let amount = 0;
                    if (sDiff > 0) {
                        amount = Math.min(sDiff * 0.1, e - minE);
                        elev[idx] -= amount;
                        sediment[idx] += amount;
                    }
                    else {
                        amount = Math.min(-sDiff * 0.1, sediment[idx]);
                        elev[idx] += amount;
                        sediment[idx] -= amount;
                    }
                    totalChange += amount;
                    const ddx = dirs[minDir * 2];
                    const ddy = dirs[minDir * 2 + 1];
                    const ni = idx + ddx + ddy * width;
                    const halfWater = water[idx] * 0.5;
                    const halfSediment = sediment[idx] * 0.5;
                    water[ni] += halfWater;
                    sediment[ni] += halfSediment;
                    water[idx] = halfWater;
                    sediment[idx] = halfSediment;
                }
            }
        }
        for (let i = 0; i < size; i++)
            water[i] *= (1 - evaporationRate);
        if (totalChange < maxChangeThreshold)
            break;
    }
    return elev;
}
export function generateLakes(width, height, elevation, seaLevel, lakeDensity, seed) {
    const lakes = new Float32Array(width * height);
    const noise = createNoise(seed + 7, 'simplex');
    for (let y = 2; y < height - 2; y++) {
        for (let x = 2; x < width - 2; x++) {
            const idx = y * width + x;
            const elev = elevation[idx];
            if (elev > seaLevel && elev < seaLevel + 0.1) {
                const n = noise.fbm(x / width * 20, y / height * 20, 2, 2, 0.5, 'standard');
                if (n > 1 - lakeDensity) {
                    let isBasin = true;
                    for (let dy = -1; dy <= 1 && isBasin; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0)
                                continue;
                            if (elevation[(y + dy) * width + (x + dx)] < elev) {
                                isBasin = false;
                                break;
                            }
                        }
                    }
                    if (isBasin) {
                        lakes[idx] = 1;
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                lakes[(y + dy) * width + (x + dx)] = 1;
                            }
                        }
                    }
                }
            }
        }
    }
    return lakes;
}
