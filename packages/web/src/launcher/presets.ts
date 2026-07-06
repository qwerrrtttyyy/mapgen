export type PresetCategory = 'theme' | 'mode' | 'type';
export type PresetId = string;

export interface Preset {
  id: PresetId;
  category: PresetCategory;
  name: string;
  /** SVG path data（24x24 viewBox，线条风格）— 由 createSvgIcon 渲染 */
  icon: string;
  description: string;
  params: Record<string, number | boolean | string>;
}

export interface PresetGroup {
  category: PresetCategory;
  label: string;
  presets: Preset[];
}

// 所有图标使用 Lucide/Feather 风格的 24x24 viewBox path data，
// 通过 createSvgIcon() 渲染为 SVG，避免 emoji 在不同字体下显示为方框。

const themes: Preset[] = [
  {
    id: 'theme.default',
    category: 'theme',
    name: '标准',
    icon: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0 0v-20M2 12h20',
    description: '平衡地形',
    params: {
      seaLevel: 0.45,
      landmass: 0.4,
      plateCount: 8,
      octaves: 5,
      mountainFold: 0.3,
      erosionStrength: 1.0,
      erosionIterations: 50,
      snowLine: 0.5,
      tempOffset: 0,
      lakeDensity: 0.02,
    },
  },
  {
    id: 'theme.continent',
    category: 'theme',
    name: '大陆',
    icon: 'm8 3 4 8 5-5 5 15H2L8 3z',
    description: '广阔陆地',
    params: {
      seaLevel: 0.35,
      landmass: 0.65,
      plateCount: 10,
      octaves: 6,
      mountainFold: 0.4,
      erosionStrength: 0.7,
      erosionIterations: 40,
      snowLine: 0.55,
      tempOffset: 0,
      lakeDensity: 0.03,
    },
  },
  {
    id: 'theme.archipelago',
    category: 'theme',
    name: '群岛',
    icon: 'M12 22V8M5 8c0-3 3-6 7-6s7 3 7 6c0 0-3 2-7 2s-7-2-7-2zM3 22h18',
    description: '碎岛散布',
    params: {
      seaLevel: 0.58,
      landmass: 0.22,
      plateCount: 14,
      octaves: 7,
      mountainFold: 0.25,
      erosionStrength: 1.4,
      erosionIterations: 70,
      coastDetail: 0.85,
      snowLine: 0.45,
      lakeDensity: 0.01,
    },
  },
  {
    id: 'theme.pangaea',
    category: 'theme',
    name: '盘古',
    icon: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
    description: '超级大陆',
    params: {
      seaLevel: 0.3,
      landmass: 0.85,
      plateCount: 4,
      octaves: 4,
      mountainFold: 0.5,
      erosionStrength: 0.5,
      erosionIterations: 30,
      snowLine: 0.6,
      lakeDensity: 0.04,
    },
  },
  {
    id: 'theme.tundra',
    category: 'theme',
    name: '苔原',
    icon: 'M12 2v20M4 6l16 12M20 6L4 18M2 12h20',
    description: '寒冷低地',
    params: {
      seaLevel: 0.4,
      landmass: 0.5,
      plateCount: 8,
      octaves: 5,
      mountainFold: 0.35,
      erosionStrength: 0.6,
      erosionIterations: 35,
      snowLine: 0.2,
      tempOffset: -0.35,
      rainStrength: 0.6,
      lakeDensity: 0.05,
    },
  },
  {
    id: 'theme.desert',
    category: 'theme',
    name: '沙漠',
    icon: 'M12 4V2M12 22v-2M5 7L4 6M20 18l-1-1M5 17l-1 1M20 6l-1 1M2 12h2M20 12h2M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    description: '干旱高温',
    params: {
      seaLevel: 0.48,
      landmass: 0.55,
      plateCount: 7,
      octaves: 4,
      mountainFold: 0.4,
      erosionStrength: 0.3,
      erosionIterations: 20,
      snowLine: 0.75,
      tempOffset: 0.3,
      rainStrength: 0.2,
      lakeDensity: 0.002,
      enableMonsoon: false,
    },
  },
  {
    id: 'theme.volcanic',
    category: 'theme',
    name: '火山',
    icon: 'M12 3l9 16H3zM12 8l-2 3h4l-2-3M10 14h4',
    description: '熔岩地貌',
    params: {
      seaLevel: 0.42,
      landmass: 0.5,
      plateCount: 16,
      octaves: 6,
      mountainFold: 0.7,
      erosionStrength: 0.2,
      erosionIterations: 15,
      snowLine: 0.8,
      tempOffset: 0.2,
      coastDetail: 0.3,
      lakeDensity: 0.01,
    },
  },
  {
    id: 'theme.wetlands',
    category: 'theme',
    name: '湿地',
    icon: 'M4 20c0-8 6-14 16-14 0 10-6 16-16 14zM4 20l8-8',
    description: '水网密布',
    params: {
      seaLevel: 0.52,
      landmass: 0.35,
      plateCount: 6,
      octaves: 5,
      mountainFold: 0.15,
      erosionStrength: 1.8,
      erosionIterations: 80,
      snowLine: 0.55,
      tempOffset: 0.1,
      rainStrength: 1.8,
      lakeDensity: 0.08,
      riverCount: 60,
    },
  },
  {
    id: 'theme.fjord',
    category: 'theme',
    name: '峡湾',
    icon: 'M3 20l4-8 4 4 3-6 4 5 3-3M2 20h20',
    description: '冰川海岸',
    params: {
      seaLevel: 0.4,
      landmass: 0.55,
      plateCount: 12,
      octaves: 6,
      mountainFold: 0.6,
      erosionStrength: 1.6,
      erosionIterations: 100,
      snowLine: 0.3,
      tempOffset: -0.2,
      coastDetail: 0.9,
      lakeDensity: 0.06,
    },
  },
  {
    id: 'theme.canyon',
    category: 'theme',
    name: '峡谷',
    icon: 'M3 20l3-12 5 4 3-8 4 12z',
    description: '深切侵蚀',
    params: {
      seaLevel: 0.5,
      landmass: 0.4,
      plateCount: 9,
      octaves: 5,
      mountainFold: 0.55,
      erosionStrength: 2.5,
      erosionIterations: 150,
      snowLine: 0.65,
      tempOffset: 0.05,
      lakeDensity: 0.005,
    },
  },
  {
    id: 'theme.alien',
    category: 'theme',
    name: '外星',
    icon: 'M12 2a8 8 0 0 0-8 8c0 3 2 5 2 7 0 1 1 3 2 4 1 1 2 1 4 1s3 0 4-1 2-3 2-4c0-2 2-4 2-7a8 8 0 0 0-8-8zm-2 8a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm6 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z',
    description: '奇异地貌',
    params: {
      seaLevel: 0.35,
      landmass: 0.6,
      plateCount: 18,
      octaves: 8,
      noiseType: 'worley',
      fbmType: 'warped',
      mountainFold: 0.8,
      erosionStrength: 0.4,
      erosionIterations: 25,
      snowLine: 0.4,
      tempOffset: 0.15,
      lakeDensity: 0.03,
      enableIceSheet: false,
      enableOceanCurrents: false,
    },
  },
  {
    id: 'theme.moon',
    category: 'theme',
    name: '月球',
    icon: 'M12 3a9 9 0 1 0 9 9c-4 2-9-1-9-9z',
    description: '陨石坑',
    params: {
      seaLevel: 0,
      landmass: 1,
      plateCount: 3,
      octaves: 3,
      noiseType: 'worley',
      fbmType: 'standard',
      mountainFold: 0.1,
      erosionStrength: 0,
      erosionIterations: 0,
      snowLine: 1,
      tempOffset: -0.5,
      lakeDensity: 0,
      riverCount: 0,
      enableOceanCurrents: false,
      enableIceSheet: false,
      enableMonsoon: false,
      enableContinentality: false,
      enableHadleyEnhancement: false,
    },
  },
];

const modes: Preset[] = [
  {
    id: 'mode.standard',
    category: 'mode',
    name: '标准',
    icon: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-4a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0-4a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    description: 'Perlin+FBM',
    params: { noiseType: 'perlin', fbmType: 'standard', lacunarity: 2.0, persistence: 0.5 },
  },
  {
    id: 'mode.simplex',
    category: 'mode',
    name: 'Simplex',
    icon: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-4a6 6 0 1 1 0-12 6 6 0 0 1 0 12zm0-4a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    description: '自然细节',
    params: { noiseType: 'simplex', fbmType: 'standard', lacunarity: 2.1, persistence: 0.5 },
  },
  {
    id: 'mode.ridged',
    category: 'mode',
    name: '山脊',
    icon: 'M3 20l5-10 4 6 3-4 6 8z',
    description: '尖锐峰岭',
    params: {
      noiseType: 'simplex',
      fbmType: 'ridged',
      lacunarity: 2.3,
      persistence: 0.45,
      mountainFold: 0.6,
    },
  },
  {
    id: 'mode.billowy',
    category: 'mode',
    name: '丘陵',
    icon: 'M6 18a4 4 0 0 1 0-8 5 5 0 0 1 9.5-1.5A4 4 0 0 1 17 18z',
    description: '柔和起伏',
    params: {
      noiseType: 'perlin',
      fbmType: 'billowy',
      lacunarity: 1.9,
      persistence: 0.55,
      mountainFold: 0.2,
    },
  },
  {
    id: 'mode.warped',
    category: 'mode',
    name: '扭曲',
    icon: 'M4 4c4 0 8 4 8 8s-4 8-8 8M20 4c-4 0-8 4-8 8s4 8 8 8M4 4h16M4 20h16M8 12h8',
    description: '有机域扭曲',
    params: {
      noiseType: 'simplex',
      fbmType: 'warped',
      lacunarity: 2.0,
      persistence: 0.5,
      octaves: 6,
    },
  },
  {
    id: 'mode.worley',
    category: 'mode',
    name: 'Worley',
    icon: 'M12 2l9 5v10l-9 5-9-5V7z',
    description: '细胞多边形',
    params: {
      noiseType: 'worley',
      fbmType: 'standard',
      lacunarity: 2.0,
      persistence: 0.5,
      octaves: 4,
    },
  },
];

const renderStyles: { id: string; name: string; icon: string; style: number }[] = [
  {
    id: 'style.terrain',
    name: '地形',
    icon: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15',
    style: 0,
  },
  {
    id: 'style.biome',
    name: '群系',
    icon: 'M4 20c0-8 6-14 16-14 0 10-6 16-16 14zM4 20l8-8',
    style: 6,
  },
  {
    id: 'style.azgaar',
    name: 'Azgaar',
    icon: 'M3 21V9l2-1V4h2v2l3-1V4h4v1l3 1V4h2v4l2 1v12z',
    style: 9,
  },
  {
    id: 'style.satellite',
    name: '卫星',
    icon: 'M5 12l4-4 3 3 4-4 3 3M5 5l4-1 3 2 4-1 3 2v6l-4 1-3-2-4 1-3-2z',
    style: 3,
  },
  {
    id: 'style.plates',
    name: '板块',
    icon: 'M3 7h4a2 2 0 1 0 4 0h6v4a2 2 0 1 0 0 4v6h-6a2 2 0 1 0-4 0H3z',
    style: 1,
  },
  {
    id: 'style.parchment',
    name: '羊皮纸',
    icon: 'M4 4h12a3 3 0 0 1 3 3v10a3 3 0 0 0 3 3M4 4v14a3 3 0 0 0 3 3h10M4 4a3 3 0 0 0 0 6',
    style: 2,
  },
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
