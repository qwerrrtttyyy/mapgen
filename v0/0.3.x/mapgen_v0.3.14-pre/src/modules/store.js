/**
 * 状态管理系统模块
 * Material Map Generator v0.3.12-preview
 */

const GEN_KEYS = [
    'seedStr', 'mapSize', 'plateCount', 'landmass', 'noiseType', 'fbmType', 
    'octaves', 'lacunarity', 'persistence', 'seaLevel', 'erosionStrength', 
    'erosionIterations', 'mountainFold', 'tempOffset', 'mapAspect', 'worldScale', 
    'coastDetail', 'lakeDensity'
];

const RENDER_KEYS = [
    'showBoundaries', 'boundaryWidth', 'boundaryColor', 'pointLightEnabled', 
    'pointLightPos', 'pointLightIntensity', 'pointLightColor', 'glowEnabled', 
    'style', 'showNames', 'fbmOctaves', 'fbmLacunarity', 'fbmPersistence', 
    'snowLine', 'erosionStrength', 'showRivers', 'contourInterval', 'showContours', 
    'showTerrain', 'showSelection', 'showGrid', 'detailRiverWidth', 'detailRiverCurve', 
    'detailCoastJagged', 'detailRidgeDensity', 'detailRainfallOffset', 'detailTempGradient', 
    'detailBiomeBlend'
];

/**
 * 创建状态存储
 */
export function createStore(initial) {
    let s = initial;
    const listeners = [];
    
    return { 
        get: () => s, 
        set: (p, forceRegen = false) => { 
            const oldS = s; 
            s = { ...s, ...p }; 
            const changedGen = GEN_KEYS.some(k => p[k] !== undefined && oldS[k] !== p[k]); 
            const needsRegen = forceRegen || changedGen; 
            if (needsRegen) s._needsRegen = true; 
            listeners.forEach(f => f(s, { changedGen, needsRegen, payload: p })); 
        }, 
        subscribe: f => listeners.push(f) 
    };
}

/**
 * 获取默认初始状态
 */
export function getDefaultState() {
    return {
        seedStr: 'Terra2026',
        mapSize: 1024,
        plateCount: 14,
        landmass: 35,
        noiseType: 'simplex',
        fbmType: 'standard',
        octaves: 6,
        lacunarity: 2.0,
        persistence: 0.5,
        seaLevel: 0.45,
        showBoundaries: true,
        boundaryWidth: 3,
        boundaryColor: [1, 0.2, 0.12],
        pointLightEnabled: false,
        pointLightPos: [0.3, 0.7],
        pointLightIntensity: 1.0,
        pointLightColor: [1, 0.96, 0.84],
        glowEnabled: false,
        style: 4,
        showNames: true,
        laserActive: false,
        trailEnabled: true,
        laserSmooth: false,
        cursorActive: false,
        perfEnabled: false,
        _needsRegen: true,
        _isGenerating: false,
        fbmOctaves: 6,
        fbmLacunarity: 2.0,
        fbmPersistence: 0.5,
        erosionStrength: 0.3,
        erosionIterations: 20,
        mountainFold: 0.5,
        tempOffset: 0,
        snowLine: 0.65,
        showRivers: true,
        contourInterval: 5,
        showContours: true,
        showTerrain: true,
        showSelection: true,
        lightAngle: 135,
        mapAspect: '1:1',
        worldScale: 3,
        coastDetail: 0.4,
        lakeDensity: 0.2,
        showClimate: false,
        geoLabels: false,
        showGrid: false,
        detailRiverWidth: 1.0,
        detailRiverCurve: 0.5,
        detailCoastJagged: 0.4,
        detailRidgeDensity: 0.5,
        detailRainfallOffset: 0.0,
        detailTempGradient: 1.0,
        detailBiomeBlend: 0.3,
        showElevScale: false,
        showRegionNames: true,
        customPlateNames: {},
        customRegionNames: {}
    };
}

export { GEN_KEYS, RENDER_KEYS };
