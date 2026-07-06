export { hashSeed, createNoise, NoiseEngine } from './noise.js';
export { generatePlates, assignPlates, computeBoundaries, computeBoundaryTypes } from './tectonic.js';
export { generateElevation, hydraulicErosion, generateLakes } from './erosion.js';
export { generateRivers } from './rivers.js';
export { analyzeRegions, computeClimate } from './regions.js';
export { generateNames, regenerateNames } from './naming.js';
export { detectTerrainRegions, CommandStack, applyBrushStroke, applyVectorMountain, applyVectorPolygon, movePlate, recomputePlateGeometry } from './editor.js';
export { computeSlope } from './slope.js';
export { classifyBiome, extractChannel, extractPlateId, packAllTextures, packClimateRiverTextures, packElevTex, packCurrentTex, packIceTex, packBiomeTex, packWatershedTex, packVolcanismTex, packSeasonTex } from './texturePack.js';
export { runDownstreamPipeline, applyDownstreamToMapData } from './downstream.js';
export { computeCoastDistance, continentalityFactor } from './coastline.js';
export { computeOceanCurrents } from './oceanCurrents.js';
export { computeIceSheet } from './ice.js';
export { computeDetailPatch, detectDetailPeaks } from './lazyGen.js';
export { classifyBiomes, biomeNormalize, getBiomeInfo, BIOME_INFO, BIOME_COUNT } from './biomes.js';
export { computeWatershed } from './watershed.js';
export { computeVolcanism } from './volcanism.js';
export { computeSeasonalVariation, decodeSeasonDelta } from './seasons.js';
export { t, getPreferredLocale, createTranslator, translations } from './i18n/index.js';
import { hashSeed } from './noise.js';
import { generatePlates, assignPlates, computeBoundaries, computeBoundaryTypes } from './tectonic.js';
import { generateElevation, hydraulicErosion, generateLakes } from './erosion.js';
import { generateRivers } from './rivers.js';
import { analyzeRegions, computeClimate } from './regions.js';
import { generateNames } from './naming.js';
import { detectTerrainRegions } from './editor.js';
import { classifyBiome } from './texturePack.js';
import { computeCoastDistance } from './coastline.js';
import { computeOceanCurrents } from './oceanCurrents.js';
import { computeIceSheet } from './ice.js';
import { computeSlope } from './slope.js';
import { classifyBiomes, getBiomeInfo } from './biomes.js';
import { computeWatershed } from './watershed.js';
import { computeVolcanism } from './volcanism.js';
import { computeSeasonalVariation } from './seasons.js';
const ASPECT_MAP = { '1:1': 1, '4:3': 4 / 3, '16:9': 16 / 9, '2:1': 2, '3:2': 3 / 2 };
export function generateMap(params, onProgress) {
    const seed = hashSeed(params.seedStr);
    let width, height;
    if (params.mapWidth && params.mapHeight) {
        width = params.mapWidth;
        height = params.mapHeight;
    }
    else {
        const aspect = ASPECT_MAP[params.mapAspect || '1:1'] || 1;
        width = params.mapSize || 512;
        height = Math.round(width / aspect);
    }
    const phases = [
        { name: 'tectonic', weight: 8 },
        { name: 'elevation', weight: 22 },
        { name: 'erosion', weight: 16 },
        { name: 'coastline', weight: 4 },
        { name: 'currents', weight: 5 },
        { name: 'climate', weight: 9 },
        { name: 'ice', weight: 6 },
        { name: 'biomes', weight: 3 },
        { name: 'watershed', weight: 4 },
        { name: 'volcanism', weight: 3 },
        { name: 'seasons', weight: 3 },
        { name: 'lakes', weight: 3 },
        { name: 'rivers', weight: 7 },
        { name: 'regions', weight: 4 },
        { name: 'naming', weight: 2 },
        { name: 'packing', weight: 1 },
    ];
    const totalWeight = phases.reduce((s, p) => s + p.weight, 0);
    let progress = 0;
    const phaseMap = new Map(phases.map(p => [p.name, p.weight / totalWeight]));
    function advance(phaseName) {
        const w = phaseMap.get(phaseName);
        if (w)
            progress += w;
        if (onProgress)
            onProgress(progress, phaseName);
    }
    const size0 = width * height;
    const isBlank = params.mode === 'blank';
    let plates;
    let plateId;
    let plateDist;
    let boundary;
    let tectonicForce;
    let elevation;
    let slope;
    let ridge;
    let ridgeMask;
    let checkpointTectonic;
    let checkpointElevation;
    let checkpointErosion;
    // 世界式生成产物（预分配零数组，blank 模式或开关关闭时保持零值）
    let coastDist = new Float32Array(size0);
    let currentVx = new Float32Array(size0);
    let currentVy = new Float32Array(size0);
    let currentTempDelta = new Float32Array(size0);
    let currentSpeed = new Float32Array(size0);
    let landIce = new Float32Array(size0);
    let seaIce = new Float32Array(size0);
    let glacierVx = new Float32Array(size0);
    let glacierVy = new Float32Array(size0);
    // v2 新增产物
    let biomeId = new Uint8Array(size0);
    let biomeNormalized = new Float32Array(size0);
    let basinId = new Int32Array(size0).fill(-1);
    let isDivide = new Uint8Array(size0);
    let streamOrder = new Uint8Array(size0);
    let volcanoProb = new Float32Array(size0);
    let calderaMask = new Uint8Array(size0);
    let seasonTex = new Float32Array(size0 * 4);
    let volcanoSites = [];
    let hotspots = [];
    // 边界类型（火山系统需要，提前声明）
    let boundaryTypeArr = new Float32Array(size0);
    if (isBlank) {
        // 空白模式：全海域，N 个海洋板块，平坦海底，等待手绘（AC-10.1）
        advance('tectonic');
        plates = generatePlates(seed, params.plateCount, width, height, 0).map(p => ({ ...p, type: 'ocean' }));
        const assigned = assignPlates(width, height, plates);
        plateId = assigned.plateId;
        plateDist = assigned.plateDist;
        boundary = computeBoundaries(width, height, plateId);
        const bt = computeBoundaryTypes(width, height, plateId, plates);
        tectonicForce = new Float32Array(size0); // 无构造力 → 无山脉
        for (let i = 0; i < boundary.length; i++) {
            if (boundary[i] > 0)
                boundary[i] = Math.min(1, 0.5 + bt.boundaryIntensity[i] * 0.3);
        }
        checkpointTectonic = { plates, plateId: new Float32Array(plateId), plateDist: new Float32Array(plateDist), boundary: new Float32Array(boundary) };
        advance('elevation');
        elevation = new Float32Array(size0).fill(params.seaLevel - 0.3);
        slope = new Float32Array(size0);
        ridge = new Float32Array(size0);
        ridgeMask = new Float32Array(size0);
        checkpointElevation = { elevation: new Float32Array(elevation), slope: new Float32Array(slope), ridge: new Float32Array(ridge), ridgeMask: new Float32Array(ridgeMask) };
        advance('erosion');
        checkpointErosion = { elevation: new Float32Array(elevation) };
    }
    else {
        advance('tectonic');
        plates = generatePlates(seed, params.plateCount, width, height, params.landmass);
        const assigned = assignPlates(width, height, plates);
        plateId = assigned.plateId;
        plateDist = assigned.plateDist;
        boundary = computeBoundaries(width, height, plateId);
        const { boundaryType, boundaryIntensity } = computeBoundaryTypes(width, height, plateId, plates);
        // 转换为 Float32Array 供火山系统使用（Uint8Array→Float32Array）
        boundaryTypeArr = new Float32Array(size0);
        for (let i = 0; i < size0; i++)
            boundaryTypeArr[i] = boundaryType[i];
        tectonicForce = new Float32Array(size0);
        for (let i = 0; i < size0; i++) {
            if (boundary[i] === 0)
                continue;
            if (boundaryType[i] === 1)
                tectonicForce[i] = boundaryIntensity[i];
            else if (boundaryType[i] === 2)
                tectonicForce[i] = -boundaryIntensity[i];
            else if (boundaryType[i] === 3)
                tectonicForce[i] = boundaryIntensity[i] * 0.3;
        }
        for (let i = 0; i < boundary.length; i++) {
            if (boundary[i] > 0)
                boundary[i] = Math.min(1, 0.5 + boundaryIntensity[i] * 0.3);
        }
        checkpointTectonic = { plates, plateId: new Float32Array(plateId), plateDist: new Float32Array(plateDist), boundary: new Float32Array(boundary) };
        advance('elevation');
        const elevResult = generateElevation(width, height, seed, plateId, plates, plateDist, tectonicForce, params.noiseType, params.fbmType, params.octaves, params.lacunarity, params.persistence, params.seaLevel, params.mountainFold, params.coastDetail);
        elevation = elevResult.elevation;
        slope = elevResult.slope;
        ridge = elevResult.ridge;
        ridgeMask = elevResult.ridgeMask;
        checkpointElevation = { elevation: new Float32Array(elevation), slope: new Float32Array(slope), ridge: new Float32Array(ridge), ridgeMask: new Float32Array(ridgeMask) };
        advance('erosion');
        if (params.erosionIterations > 0 && params.erosionStrength > 0) {
            elevation = hydraulicErosion(width, height, elevation, params.erosionIterations, params.erosionStrength, 0.01);
        }
        checkpointErosion = { elevation: new Float32Array(elevation) };
    }
    // ── 世界式生成阶段（blank 模式跳过，保持零数组）──
    if (!isBlank) {
        // 海岸距离场（大陆度 + 河口 + 洋流沿岸影响范围）
        advance('coastline');
        coastDist = computeCoastDistance(width, height, elevation, params.seaLevel);
        // 洋流系统（风驱动 + Ekman + 西边界强化）
        if (params.enableOceanCurrents !== false) {
            advance('currents');
            const currents = computeOceanCurrents({
                width, height, elevation, seaLevel: params.seaLevel,
                coastDist, windDirX: params.windDirX ?? 1, windDirY: params.windDirY ?? 0,
                rainStrength: params.rainStrength ?? 1, seed,
            });
            currentVx = currents.vx;
            currentVy = currents.vy;
            currentTempDelta = currents.tempDelta;
            currentSpeed = currents.speed;
        }
    }
    advance('climate');
    // blank 模式：全海域，无陆地 → 气候/湖泊/河流无意义，跳过计算（避免无谓遍历）
    let temperature, tempZone, moisture, rainfall;
    let lakes;
    let rivers;
    let riverMask, riverWidth, riverDepth;
    if (isBlank) {
        temperature = new Float32Array(size0);
        tempZone = new Float32Array(size0);
        moisture = new Float32Array(size0).fill(1); // 全海 → 高湿
        rainfall = new Float32Array(size0);
        lakes = new Float32Array(size0);
        rivers = [];
        riverMask = new Float32Array(size0);
        riverWidth = new Float32Array(size0);
        riverDepth = new Float32Array(size0);
    }
    else {
        const climate = computeClimate(width, height, elevation, params.seaLevel, params.tempOffset, params.snowLine, params.windDirX ?? 1, params.windDirY ?? 0, params.rainStrength ?? 1, 
        // 世界式气候增强（任一开关开启即启用对应项；缺省=全开）
        {
            coastDist,
            currentTempDelta,
            enableContinentality: params.enableContinentality !== false,
            enableOceanCurrents: params.enableOceanCurrents !== false,
            enableHadleyEnhancement: params.enableHadleyEnhancement !== false,
            enableMonsoon: params.enableMonsoon !== false,
        });
        temperature = climate.temperature;
        tempZone = climate.tempZone;
        moisture = climate.moisture;
        rainfall = climate.rainfall;
        // 动态冰盖 + 冰川侵蚀（侵蚀会就地改写 elevation，故 slope 后续需重算）
        if (params.enableIceSheet !== false) {
            advance('ice');
            const ice = computeIceSheet({
                width, height, elevation, seaLevel: params.seaLevel,
                temperature, snowLine: params.snowLine, seed,
            });
            landIce = ice.landIce;
            seaIce = ice.seaIce;
            glacierVx = ice.glacierVx;
            glacierVy = ice.glacierVy;
            // 冰川侵蚀改写了 elevation，重算 slope 保证下游 terrainRegions 阈值正确
            slope = computeSlope(width, height, elevation);
        }
        advance('lakes');
        lakes = generateLakes(width, height, elevation, params.seaLevel, params.lakeDensity, seed);
        advance('rivers');
        const riverCount = params.riverCount ?? Math.floor(width * height * 0.0005);
        const riverResult = generateRivers(width, height, elevation, moisture, params.seaLevel, riverCount, seed);
        rivers = riverResult.rivers;
        riverMask = riverResult.riverMask;
        riverWidth = riverResult.riverWidth;
        riverDepth = riverResult.riverDepth;
        // ── v2 复杂度增强：生物群系 / 流域 / 火山 / 季节 ──
        if (params.enableAdvancedBiomes !== false) {
            advance('biomes');
            const biomes = classifyBiomes({
                elevation, temperature, rainfall, moisture,
                seaLevel: params.seaLevel, snowLine: params.snowLine,
                coastDist, riverMask, lakeMask: lakes,
                landIce, seaIce,
            });
            biomeId = biomes.biomeId;
            biomeNormalized = biomes.biomeNormalized;
        }
        if (params.enableWatershed !== false) {
            advance('watershed');
            const ws = computeWatershed({
                width, height, elevation, seaLevel: params.seaLevel,
                riverMask, lakeMask: lakes,
                minBasinArea: 30,
            });
            basinId = ws.basinId;
            isDivide = ws.isDivide;
            streamOrder = ws.streamOrder;
        }
        if (params.enableVolcanism !== false) {
            advance('volcanism');
            const volc = computeVolcanism({
                width, height, elevation, seaLevel: params.seaLevel,
                plateId, plates,
                boundary, boundaryType: boundaryTypeArr,
                hotspotCount: 3, intensity: 1, seed,
            });
            volcanoProb = volc.volcanoProb;
            calderaMask = volc.calderaMask;
            volcanoSites = volc.volcanoSites;
            hotspots = volc.hotspots;
        }
        if (params.enableSeasons !== false) {
            advance('seasons');
            const seas = computeSeasonalVariation({
                width, height, elevation, seaLevel: params.seaLevel,
                temperature, rainfall, coastDist,
            });
            seasonTex = seas.seasonTex;
        }
    }
    const checkpointClimate = { temperature: new Float32Array(temperature), tempZone: new Float32Array(tempZone), moisture: new Float32Array(moisture), rainfall: new Float32Array(rainfall) };
    const checkpointRivers = { rivers, riverMask: new Float32Array(riverMask), riverWidth: new Float32Array(riverWidth), riverDepth: new Float32Array(riverDepth), lakes: new Float32Array(lakes) };
    advance('regions');
    const regions = analyzeRegions(width, height, elevation, moisture, temperature, plateId, params.seaLevel, seed);
    advance('naming');
    // 计算每个板块的质心（用于命名方位词 + 名称叠加层定位）
    const plateSumX = new Float64Array(plates.length);
    const plateSumY = new Float64Array(plates.length);
    const plateCount = new Float64Array(plates.length);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const pid = plateId[y * width + x] | 0;
            plateSumX[pid] += x;
            plateSumY[pid] += y;
            plateCount[pid]++;
        }
    }
    const nameablePlates = plates.map((p, i) => ({
        plateId: i,
        type: p.type === 'continent' ? 'continent' : 'ocean',
        centroid: plateCount[i] > 0
            ? [plateSumX[i] / plateCount[i], plateSumY[i] / plateCount[i]]
            : [width * 0.5, height * 0.5],
    }));
    // 检测地形区连通域并命名（含世界式增强 v2：冰川/三角洲/火山/群岛 + 火山概率场）
    const detectedRegions = detectTerrainRegions(width, height, elevation, slope, moisture, params.seaLevel, params.snowLine, 30, { landIce, coastDist, riverMask, volcanoProb, biomeId, streamOrder, basinId });
    const nameableRegions = detectedRegions.map(r => ({
        key: r.key,
        type: r.type,
        centroid: r.centroid,
        area: r.area,
    }));
    const names = generateNames(seed, width, height, nameablePlates, nameableRegions);
    advance('packing');
    const size = width * height;
    const plateTex = new Float32Array(size * 4);
    const elevTex = new Float32Array(size * 4);
    const moistTex = new Float32Array(size * 4);
    const riverTex = new Float32Array(size * 4);
    const tempTex = new Float32Array(size * 4);
    const currentTex = new Float32Array(size * 4);
    const iceTex = new Float32Array(size * 4);
    // v2 新纹理
    const biomeTex = new Float32Array(size * 4);
    const watershedTex = new Float32Array(size * 4);
    const volcanismTex = new Float32Array(size * 4);
    // seasonTex 已在生成阶段创建
    const plateTypeArr = new Uint8Array(plates.length);
    for (let i = 0; i < plates.length; i++) {
        plateTypeArr[i] = plates[i].type === 'continent' ? 1 : 0;
    }
    const invPlateCount = 1 / params.plateCount;
    const inv4 = 0.25;
    const inv13 = 1 / 15;
    const inv31 = 1 / 31;
    const inv7 = 1 / 7;
    const seaLevel = params.seaLevel;
    const snowLine = params.snowLine;
    for (let i = 0; i < size; i++) {
        const pid = plateId[i] | 0;
        const i4 = i * 4;
        const elev = elevation[i];
        const temp = temperature[i];
        const moist = moisture[i];
        const tz = tempZone[i] * inv4;
        plateTex[i4 + 0] = pid * invPlateCount;
        plateTex[i4 + 1] = plateTypeArr[pid];
        plateTex[i4 + 2] = boundary[i];
        plateTex[i4 + 3] = plateDist[i];
        elevTex[i4 + 0] = elev;
        elevTex[i4 + 1] = slope[i];
        elevTex[i4 + 2] = ridge[i];
        elevTex[i4 + 3] = ridgeMask[i];
        moistTex[i4 + 0] = moist;
        moistTex[i4 + 1] = rainfall[i];
        moistTex[i4 + 2] = temp;
        moistTex[i4 + 3] = tz;
        riverTex[i4 + 0] = riverMask[i];
        riverTex[i4 + 1] = riverWidth[i];
        riverTex[i4 + 2] = riverDepth[i];
        riverTex[i4 + 3] = lakes[i];
        // tempTex 通道 B：优先用 v2 高级 biome（覆盖简单 classifyBiome）
        const simpleBiome = classifyBiome(elev, temp, moist, seaLevel, snowLine);
        const advancedBiome = biomeNormalized[i]; // [0,1] 或 0（开关关闭）
        const useAdvanced = params.enableAdvancedBiomes !== false && advancedBiome > 0;
        tempTex[i4 + 0] = temp;
        tempTex[i4 + 1] = tz;
        tempTex[i4 + 2] = useAdvanced ? advancedBiome : simpleBiome * inv13;
        tempTex[i4 + 3] = 0;
        // 洋流纹理 RGBA: R=vx G=vy B=tempDelta A=speed
        currentTex[i4 + 0] = (currentVx[i] + 1) * 0.5; // [-1,1] → [0,1]
        currentTex[i4 + 1] = (currentVy[i] + 1) * 0.5;
        currentTex[i4 + 2] = (currentTempDelta[i] + 1) * 0.5; // [-1,1] → [0,1]
        currentTex[i4 + 3] = Math.min(1, currentSpeed[i] * 4);
        // 冰盖纹理 RGBA: R=landIce G=seaIce B=glacierVx A=glacierVy
        iceTex[i4 + 0] = landIce[i];
        iceTex[i4 + 1] = seaIce[i];
        iceTex[i4 + 2] = (glacierVx[i] + 1) * 0.5; // [-1,1] → [0,1]
        iceTex[i4 + 3] = (glacierVy[i] + 1) * 0.5;
        // v2 生物群系纹理 RGBA: R=biomeId/31 G=isLand(1/0) B=koppenBand(0..6) A=streamOrder/7
        const bId = biomeId[i];
        const bInfo = getBiomeInfo(bId);
        biomeTex[i4 + 0] = bId * inv31;
        biomeTex[i4 + 1] = bInfo.isLand ? 1 : 0;
        biomeTex[i4 + 2] = ['X', 'A', 'B', 'C', 'D', 'E', 'M'].indexOf(bInfo.koppen) * inv7;
        biomeTex[i4 + 3] = streamOrder[i] * inv7;
        // v2 流域纹理 RGBA: R=basinId/65535 G=isDivide B=streamOrder/7 A=flowDir/255
        // basinId 可能很大或 -1（海洋），用最大值归一化
        const b = basinId[i];
        watershedTex[i4 + 0] = b < 0 ? 0 : Math.min(1, b / 65535);
        watershedTex[i4 + 1] = isDivide[i];
        watershedTex[i4 + 2] = streamOrder[i] * inv7;
        // flowDir 暂用 0（已在 watershed 计算但暂不打包到纹理，节省带宽）
        // v2 火山纹理 RGBA: R=volcanoProb G=calderaMask(0/1/2) B=hotspotStrength A=volcanoSite(0/1)
        volcanismTex[i4 + 0] = volcanoProb[i];
        volcanismTex[i4 + 1] = calderaMask[i] * 0.5;
        // 热点强度：取最近热点（简化为全局最大值）
        volcanismTex[i4 + 2] = hotspots.length > 0
            ? Math.max(...hotspots.map(h => h.strength)) * 0.5
            : 0;
        volcanismTex[i4 + 3] = 0; // 具体火山位置通过 volcanoSites 列表传给 UI
    }
    const mapData = {
        width, height,
        plateTex, elevTex, moistTex, riverTex, tempTex,
        currentTex, iceTex, coastDist,
        biomeTex, watershedTex, volcanismTex, seasonTex,
        volcanoSites, hotspots,
        plates, regions, rivers, names, seed,
    };
    return {
        mapData,
        checkpoints: {
            tectonic: checkpointTectonic,
            elevation: checkpointElevation,
            erosion: checkpointErosion,
            climate: checkpointClimate,
            rivers: checkpointRivers,
        },
    };
}
