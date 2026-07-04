export type PresetCategory = 'theme' | 'mode' | 'type';
export type PresetId = string;

export interface Preset {
  id: PresetId;
  category: PresetCategory;
  name: string;
  icon: string;
  description: string;
  params: Record<string, number | boolean | string>;
}

export interface PresetGroup {
  category: PresetCategory;
  label: string;
  presets: Preset[];
}

const themes: Preset[] = [
  { id: 'theme.default', category: 'theme', name: '标准', icon: '🌍', description: '平衡地形', params: { seaLevel: 0.45, landmass: 0.4, plateCount: 8, octaves: 5, mountainFold: 0.3, erosionStrength: 1.0, erosionIterations: 50, snowLine: 0.5, tempOffset: 0, lakeDensity: 0.02 } },
  { id: 'theme.continent', category: 'theme', name: '大陆', icon: '🏔️', description: '广阔陆地', params: { seaLevel: 0.35, landmass: 0.65, plateCount: 10, octaves: 6, mountainFold: 0.4, erosionStrength: 0.7, erosionIterations: 40, snowLine: 0.55, tempOffset: 0, lakeDensity: 0.03 } },
  { id: 'theme.archipelago', category: 'theme', name: '群岛', icon: '🏝️', description: '碎岛散布', params: { seaLevel: 0.58, landmass: 0.22, plateCount: 14, octaves: 7, mountainFold: 0.25, erosionStrength: 1.4, erosionIterations: 70, coastDetail: 0.85, snowLine: 0.45, lakeDensity: 0.01 } },
  { id: 'theme.pangaea', category: 'theme', name: '盘古', icon: '🌐', description: '超级大陆', params: { seaLevel: 0.3, landmass: 0.85, plateCount: 4, octaves: 4, mountainFold: 0.5, erosionStrength: 0.5, erosionIterations: 30, snowLine: 0.6, lakeDensity: 0.04 } },
  { id: 'theme.tundra', category: 'theme', name: '苔原', icon: '❄️', description: '寒冷低地', params: { seaLevel: 0.4, landmass: 0.5, plateCount: 8, octaves: 5, mountainFold: 0.35, erosionStrength: 0.6, erosionIterations: 35, snowLine: 0.2, tempOffset: -0.35, rainStrength: 0.6, lakeDensity: 0.05 } },
  { id: 'theme.desert', category: 'theme', name: '沙漠', icon: '🏜️', description: '干旱高温', params: { seaLevel: 0.48, landmass: 0.55, plateCount: 7, octaves: 4, mountainFold: 0.4, erosionStrength: 0.3, erosionIterations: 20, snowLine: 0.75, tempOffset: 0.3, rainStrength: 0.2, lakeDensity: 0.002, enableMonsoon: false } },
  { id: 'theme.volcanic', category: 'theme', name: '火山', icon: '🌋', description: '熔岩地貌', params: { seaLevel: 0.42, landmass: 0.5, plateCount: 16, octaves: 6, mountainFold: 0.7, erosionStrength: 0.2, erosionIterations: 15, snowLine: 0.8, tempOffset: 0.2, coastDetail: 0.3, lakeDensity: 0.01 } },
  { id: 'theme.wetlands', category: 'theme', name: '湿地', icon: '🌿', description: '水网密布', params: { seaLevel: 0.52, landmass: 0.35, plateCount: 6, octaves: 5, mountainFold: 0.15, erosionStrength: 1.8, erosionIterations: 80, snowLine: 0.55, tempOffset: 0.1, rainStrength: 1.8, lakeDensity: 0.08, riverCount: 60 } },
  { id: 'theme.fjord', category: 'theme', name: '峡湾', icon: '🏞️', description: '冰川海岸', params: { seaLevel: 0.4, landmass: 0.55, plateCount: 12, octaves: 6, mountainFold: 0.6, erosionStrength: 1.6, erosionIterations: 100, snowLine: 0.3, tempOffset: -0.2, coastDetail: 0.9, lakeDensity: 0.06 } },
  { id: 'theme.canyon', category: 'theme', name: '峡谷', icon: '🪨', description: '深切侵蚀', params: { seaLevel: 0.5, landmass: 0.4, plateCount: 9, octaves: 5, mountainFold: 0.55, erosionStrength: 2.5, erosionIterations: 150, snowLine: 0.65, tempOffset: 0.05, lakeDensity: 0.005 } },
  { id: 'theme.alien', category: 'theme', name: '外星', icon: '👽', description: '奇异地貌', params: { seaLevel: 0.35, landmass: 0.6, plateCount: 18, octaves: 8, noiseType: 'worley', fbmType: 'warped', mountainFold: 0.8, erosionStrength: 0.4, erosionIterations: 25, snowLine: 0.4, tempOffset: 0.15, lakeDensity: 0.03, enableIceSheet: false, enableOceanCurrents: false } },
  { id: 'theme.moon', category: 'theme', name: '月球', icon: '🌙', description: '陨石坑', params: { seaLevel: 0, landmass: 1, plateCount: 3, octaves: 3, noiseType: 'worley', fbmType: 'standard', mountainFold: 0.1, erosionStrength: 0, erosionIterations: 0, snowLine: 1, tempOffset: -0.5, lakeDensity: 0, riverCount: 0, enableOceanCurrents: false, enableIceSheet: false, enableMonsoon: false, enableContinentality: false, enableHadleyEnhancement: false } },
];

const modes: Preset[] = [
  { id: 'mode.standard', category: 'mode', name: '标准', icon: '🎯', description: 'Perlin+FBM', params: { noiseType: 'perlin', fbmType: 'standard', lacunarity: 2.0, persistence: 0.5 } },
  { id: 'mode.simplex', category: 'mode', name: 'Simplex', icon: '🌀', description: '自然细节', params: { noiseType: 'simplex', fbmType: 'standard', lacunarity: 2.1, persistence: 0.5 } },
  { id: 'mode.ridged', category: 'mode', name: '山脊', icon: '⛰️', description: '尖锐峰岭', params: { noiseType: 'simplex', fbmType: 'ridged', lacunarity: 2.3, persistence: 0.45, mountainFold: 0.6 } },
  { id: 'mode.billowy', category: 'mode', name: '丘陵', icon: '⛅', description: '柔和起伏', params: { noiseType: 'perlin', fbmType: 'billowy', lacunarity: 1.9, persistence: 0.55, mountainFold: 0.2 } },
  { id: 'mode.warped', category: 'mode', name: '扭曲', icon: '🧬', description: '有机域扭曲', params: { noiseType: 'simplex', fbmType: 'warped', lacunarity: 2.0, persistence: 0.5, octaves: 6 } },
  { id: 'mode.worley', category: 'mode', name: 'Worley', icon: '🔷', description: '细胞多边形', params: { noiseType: 'worley', fbmType: 'standard', lacunarity: 2.0, persistence: 0.5, octaves: 4 } },
];

const renderStyles: { id: string; name: string; icon: string; style: number; }[] = [
  { id: 'style.terrain', name: '地形', icon: '🗺', style: 0 },
  { id: 'style.biome', name: '群系', icon: '🌿', style: 6 },
  { id: 'style.azgaar', name: 'Azgaar', icon: '🏰', style: 9 },
  { id: 'style.satellite', name: '卫星', icon: '🛰', style: 3 },
  { id: 'style.plates', name: '板块', icon: '🧩', style: 1 },
  { id: 'style.parchment', name: '羊皮纸', icon: '📜', style: 2 },
];

export const PRESET_GROUPS: PresetGroup[] = [
  { category: 'theme', label: '世界主题', presets: themes },
  { category: 'mode', label: '噪声模式', presets: modes },
];

export const RENDER_STYLES = renderStyles;

export function findPreset(id: PresetId): Preset | undefined {
  for (const g of PRESET_GROUPS) {
    const p = g.presets.find(p => p.id === id);
    if (p) return p;
  }
  return undefined;
}

export function defaultSelection(): Record<PresetCategory, PresetId> {
  return { theme: 'theme.default', mode: 'mode.standard', type: 'type.terrain' };
}
