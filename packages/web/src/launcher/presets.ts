// 启动器预设 — 主题/模式/类型

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
  {
    id: 'theme.default',
    category: 'theme',
    name: '默认',
    icon: '🌍',
    description: '平衡地形，适合大多数场景',
    params: { seaLevel: 0.45, landmass: 0.4, plateCount: 8, octaves: 5, mountainFold: 0.3, erosionStrength: 1.0, erosionIterations: 50, snowLine: 0.5 },
  },
  {
    id: 'theme.continent',
    category: 'theme',
    name: '大陆',
    icon: '🏔️',
    description: '大片陆地、较深海洋',
    params: { seaLevel: 0.35, landmass: 0.65, plateCount: 10, octaves: 6, mountainFold: 0.4, erosionStrength: 0.7, erosionIterations: 40, snowLine: 0.55 },
  },
  {
    id: 'theme.archipelago',
    category: 'theme',
    name: '群岛',
    icon: '🏝️',
    description: '多岛屿、细碎海岸线',
    params: { seaLevel: 0.55, landmass: 0.25, plateCount: 12, octaves: 7, mountainFold: 0.25, erosionStrength: 1.4, erosionIterations: 70, coastDetail: 0.85, snowLine: 0.45 },
  },
  {
    id: 'theme.pangaea',
    category: 'theme',
    name: '盘古大陆',
    icon: '🌐',
    description: '单一超级大陆',
    params: { seaLevel: 0.3, landmass: 0.85, plateCount: 4, octaves: 4, mountainFold: 0.5, erosionStrength: 0.5, erosionIterations: 30, snowLine: 0.6 },
  },
  {
    id: 'theme.tundra',
    category: 'theme',
    name: '苔原',
    icon: '❄️',
    description: '寒冷低地、较低雪线',
    params: { seaLevel: 0.4, landmass: 0.5, plateCount: 8, octaves: 5, mountainFold: 0.35, erosionStrength: 0.6, erosionIterations: 35, snowLine: 0.25, tempOffset: -0.3 },
  },
  {
    id: 'theme.desert',
    category: 'theme',
    name: '沙漠',
    icon: '🏜️',
    description: '干燥、高温、低湿度',
    params: { seaLevel: 0.5, landmass: 0.55, plateCount: 7, octaves: 4, mountainFold: 0.4, erosionStrength: 0.3, erosionIterations: 20, snowLine: 0.7, tempOffset: 0.25, lakeDensity: 0.005 },
  },
];

const modes: Preset[] = [
  {
    id: 'mode.standard',
    category: 'mode',
    name: '标准',
    icon: '🎯',
    description: 'Perlin + 标准 FBM',
    params: { noiseType: 'perlin', fbmType: 'standard', lacunarity: 2.0, persistence: 0.5 },
  },
  {
    id: 'mode.simplex',
    category: 'mode',
    name: 'Simplex',
    icon: '🌀',
    description: 'Simplex 噪声，细节更自然',
    params: { noiseType: 'simplex', fbmType: 'standard', lacunarity: 2.1, persistence: 0.5 },
  },
  {
    id: 'mode.ridged',
    category: 'mode',
    name: '山脊',
    icon: '⛰️',
    description: '尖锐山脊地形',
    params: { noiseType: 'simplex', fbmType: 'ridged', lacunarity: 2.3, persistence: 0.45, mountainFold: 0.6 },
  },
  {
    id: 'mode.billowy',
    category: 'mode',
    name: '丘陵',
    icon: '⛅',
    description: '柔和起伏',
    params: { noiseType: 'perlin', fbmType: 'billowy', lacunarity: 1.9, persistence: 0.55, mountainFold: 0.2 },
  },
  {
    id: 'mode.warped',
    category: 'mode',
    name: '扭曲',
    icon: '🧬',
    description: '域扭曲有机感',
    params: { noiseType: 'simplex', fbmType: 'warped', lacunarity: 2.0, persistence: 0.5, octaves: 6 },
  },
  {
    id: 'mode.worley',
    category: 'mode',
    name: 'Worley',
    icon: '🔷',
    description: '细胞噪声，多边形感',
    params: { noiseType: 'worley', fbmType: 'standard', lacunarity: 2.0, persistence: 0.5, octaves: 4 },
  },
];

const types: Preset[] = [
  {
    id: 'type.terrain',
    category: 'type',
    name: '地形',
    icon: '🗺️',
    description: '默认地形图样式',
    params: { style: 0, showBoundaries: true, showRivers: true },
  },
  {
    id: 'type.biome',
    category: 'type',
    name: '生物群落',
    icon: '🌿',
    description: '生物群系着色',
    params: { style: 5, showBoundaries: false, showRivers: true, showClimate: true },
  },
  {
    id: 'type.azgaar',
    category: 'type',
    name: 'Azgaar 风格',
    icon: '🏰',
    description: '仿 FMG 风格',
    params: { style: 9, showBoundaries: true, showRivers: true, showContours: false },
  },
  {
    id: 'type.parchment',
    category: 'type',
    name: '羊皮纸',
    icon: '📜',
    description: '复古羊皮纸',
    params: { style: 2, showBoundaries: true, showRivers: true },
  },
  {
    id: 'type.contour',
    category: 'type',
    name: '等高线',
    icon: '📈',
    description: '工程等高线',
    params: { style: 7, showBoundaries: false, showRivers: true, showContours: true, contourInterval: 0.05 },
  },
  {
    id: 'type.relief',
    category: 'type',
    name: '浮雕',
    icon: '🗻',
    description: '浮雕阴影',
    params: { style: 8, showBoundaries: false, showRivers: false, lightAngle: 1.4 },
  },
];

export const PRESET_GROUPS: PresetGroup[] = [
  { category: 'theme', label: '主题', presets: themes },
  { category: 'mode', label: '噪声模式', presets: modes },
  { category: 'type', label: '类型', presets: types },
];

export function findPreset(id: PresetId): Preset | undefined {
  for (const g of PRESET_GROUPS) {
    const p = g.presets.find(p => p.id === id);
    if (p) return p;
  }
  return undefined;
}

export function defaultSelection(): Record<PresetCategory, PresetId> {
  return {
    theme: 'theme.default',
    mode: 'mode.standard',
    type: 'type.terrain',
  };
}
