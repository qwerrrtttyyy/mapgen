/**
 * Internationalization (i18n) Module for MapGen Studio
 * Provides translations for UI text content in multiple languages
 */

export type Locale = 'zh-CN' | 'en-US' | 'ja-JP';

export interface TranslationTree {
  [key: string]: string | TranslationTree;
}

export const translations: Record<Locale, TranslationTree> = {
  'zh-CN': {
    // App Title & Header
    app: {
      title: 'MapGen Studio — 程序化世界生成器',
      logo: 'MapGen <em>Studio</em>',
    },

    // Top Bar
    toolbar: {
      generate: '生成',
      generateTitle: '生成地图 (Space)',
      random: '随机',
      randomTitle: '随机种子并生成 (R)',
      undo: '撤销',
      undoTitle: '撤销 (Ctrl+Z)',
      redo: '重做',
      redoTitle: '重做 (Ctrl+Y)',
      export: '导出',
      exportTitle: '导出 PNG',
      statusReady: '就绪',
      togglePanel: '切换面板 (Tab)',
      sizeHandle: '拖拽调整地图尺寸',
    },

    // Panel Tabs
    tabs: {
      world: '世界',
      terrain: '地形',
      climate: '气候',
      water: '水文',
      render: '渲染',
    },

    // World Settings
    world: {
      presets: '世界预设',
      seed: '种子',
      seedPlaceholder: '输入种子...',
      randomSeed: '随机种子',
      mapSize: '地图尺寸',
      width: '宽',
      height: '高',
      sizeInfo: '{width}×{height} · {pixels} 像素',
      noiseEngine: '噪声引擎',
      octaves: '八度',
      lacunarity: '细节层',
      persistence: '衰减',
      tectonics: '构造',
      plateCount: '板块数',
      landmass: '陆地比例',
      mountainFold: '山脉褶皱',
      coastDetail: '海岸细节',
      simulation: '世界模拟',
      oceanCurrents: '洋流系统',
      iceSheet: '动态冰盖 & 冰川侵蚀',
      monsoon: '季风环流',
      continentality: '大陆度修正',
      hadleyEnhancement: 'Hadley 环流强化',
    },

    // Terrain Settings
    terrain: {
      basics: '地形基础',
      seaLevel: '海平面',
      erosionStrength: '侵蚀强度',
      erosionIterations: '侵蚀迭代',
      lakeDensity: '湖泊密度',
    },

    // Climate Settings
    climate: {
      parameters: '气候参数',
      tempOffset: '温度偏移',
      snowLine: '雪线高度',
      rainStrength: '降雨强度',
      windDirection: '风向',
      windX: 'X',
      windY: 'Y',
    },

    // Water Settings
    water: {
      rivers: '河流',
      riverCount: '河流数量',
    },

    // Render Settings
    render: {
      style: '渲染风格',
      overlays: '叠层',
      lighting: '光影',
      laser: '激光指针 (L)',

      // Render styles
      styles: {
        terrain: '地形',
        plates: '板块',
        parchment: '羊皮纸',
        satellite: '卫星',
        lowPoly: '低多边形',
        terrainDetail: '地形详情',
        biomes: '生物群落',
        contours: '等高线',
        relief: '浮雕',
        azgaar: 'Azgaar',
        elevation: '高程图',
        slope: '坡度图',
        moisture: '湿度图',
        temperature: '温度图',
        plateMap: '板块图',
        biomeMap: '生物群系图',
        ridgeMap: '山脊图',
        oceanCurrentMap: '洋流图',
        iceSheetMap: '冰盖图',
      },

      // Overlay options
      boundaries: '板块边界',
      boundaryWidth: '宽度',
      rivers: '河流',
      contourLines: '等高线',
      terrainBase: '地形底图',
      selectionHighlight: '选中高亮',
      climateZones: '气候分区',
      grid: '网格',

      // Lighting options
      lightAngle: '光照角度',
      pointLight: '点光源',
      glowEffect: '辉光效果',

      // Laser options
      enableLaser: '启用激光',
      laserSelection: '激光选区模式',
      laserWidth: '宽度',
      cursorFollow: '光标跟随',
      mouseTrail: '鼠标轨迹',
    },

    // World Info Panel
    worldInfo: {
      seed: '种子',
      size: '尺寸',
      stats: '统计',
    },

    // Editor Tools
    editor: {
      view: '查看',
      viewTitle: '查看 (V)',
      brush: '画笔',
      brushTitle: '画笔 (B)',
      mountain: '山脉',
      mountainTitle: '山脉线 (M)',
      terrain: '地形',
      terrainTitle: '地形面 (P)',
      plate: '板块',
      plateTitle: '拖拽板块 (D)',
      annotate: '标注',
      annotateTitle: '标注 (A)',

      // Brush settings
      radius: '半径',
      strength: '强度',

      // Brush operations
      raise: '抬升',
      lower: '沉降',
      land: '成陆',
      sea: '成海',
      platePaint: '涂板块',

      // Tool buttons
      toggleNames: '切换名称显示',
      clearSelection: '清空选择 (Esc)',
    },

    // Zoom Controls
    zoom: {
      resetTitle: '重置视图',
    },

    // Progress View
    progress: {
      initializing: '初始化...',
    },

    // Checkpoint Panel
    checkpoint: {
      title: '检查点',
      save: '+ 保存',
    },

    // Noise types
    noiseTypes: {
      perlin: 'Perlin',
      simplex: 'Simplex',
      value: 'Value',
      worley: 'Worley',
    },

    // FBM types
    fbmTypes: {
      standard: '标准 FBM',
      ridged: '山脊',
      billowy: '丘陵',
      warped: '扭曲',
    },

    // Size presets
    sizePresets: {
      '256²': '256²',
      '512²': '512²',
      '768×512': '768×512',
      '1024²': '1024²',
    },
  },

  'en-US': {
    // App Title & Header
    app: {
      title: 'MapGen Studio — Procedural World Generator',
      logo: 'MapGen <em>Studio</em>',
    },

    // Top Bar
    toolbar: {
      generate: 'Generate',
      generateTitle: 'Generate Map (Space)',
      random: 'Random',
      randomTitle: 'Randomize Seed & Generate (R)',
      undo: 'Undo',
      undoTitle: 'Undo (Ctrl+Z)',
      redo: 'Redo',
      redoTitle: 'Redo (Ctrl+Y)',
      export: 'Export',
      exportTitle: 'Export PNG',
      statusReady: 'Ready',
      togglePanel: 'Toggle Panel (Tab)',
      sizeHandle: 'Drag to Resize Map',
    },

    // Panel Tabs
    tabs: {
      world: 'World',
      terrain: 'Terrain',
      climate: 'Climate',
      water: 'Water',
      render: 'Render',
    },

    // World Settings
    world: {
      presets: 'World Presets',
      seed: 'Seed',
      seedPlaceholder: 'Enter seed...',
      randomSeed: 'Random Seed',
      mapSize: 'Map Size',
      width: 'Width',
      height: 'Height',
      sizeInfo: '{width}×{height} · {pixels} pixels',
      noiseEngine: 'Noise Engine',
      octaves: 'Octaves',
      lacunarity: 'Lacunarity',
      persistence: 'Persistence',
      tectonics: 'Tectonics',
      plateCount: 'Plate Count',
      landmass: 'Landmass',
      mountainFold: 'Mountain Fold',
      coastDetail: 'Coast Detail',
      simulation: 'World Simulation',
      oceanCurrents: 'Ocean Currents',
      iceSheet: 'Dynamic Ice Sheets & Glacial Erosion',
      monsoon: 'Monsoon Circulation',
      continentality: 'Continentality Correction',
      hadleyEnhancement: 'Hadley Cell Enhancement',
    },

    // Terrain Settings
    terrain: {
      basics: 'Terrain Basics',
      seaLevel: 'Sea Level',
      erosionStrength: 'Erosion Strength',
      erosionIterations: 'Erosion Iterations',
      lakeDensity: 'Lake Density',
    },

    // Climate Settings
    climate: {
      parameters: 'Climate Parameters',
      tempOffset: 'Temperature Offset',
      snowLine: 'Snow Line',
      rainStrength: 'Rainfall Strength',
      windDirection: 'Wind Direction',
      windX: 'X',
      windY: 'Y',
    },

    // Water Settings
    water: {
      rivers: 'Rivers',
      riverCount: 'River Count',
    },

    // Render Settings
    render: {
      style: 'Render Style',
      overlays: 'Overlays',
      lighting: 'Lighting',
      laser: 'Laser Pointer (L)',

      // Render styles
      styles: {
        terrain: 'Terrain',
        plates: 'Plates',
        parchment: 'Parchment',
        satellite: 'Satellite',
        lowPoly: 'Low Poly',
        terrainDetail: 'Terrain Detail',
        biomes: 'Biomes',
        contours: 'Contours',
        relief: 'Relief',
        azgaar: 'Azgaar',
        elevation: 'Elevation Map',
        slope: 'Slope Map',
        moisture: 'Moisture Map',
        temperature: 'Temperature Map',
        plateMap: 'Plate Map',
        biomeMap: 'Biome Map',
        ridgeMap: 'Ridge Map',
        oceanCurrentMap: 'Ocean Current Map',
        iceSheetMap: 'Ice Sheet Map',
      },

      // Overlay options
      boundaries: 'Plate Boundaries',
      boundaryWidth: 'Width',
      rivers: 'Rivers',
      contourLines: 'Contour Lines',
      terrainBase: 'Terrain Base',
      selectionHighlight: 'Selection Highlight',
      climateZones: 'Climate Zones',
      grid: 'Grid',

      // Lighting options
      lightAngle: 'Light Angle',
      pointLight: 'Point Light',
      glowEffect: 'Glow Effect',

      // Laser options
      enableLaser: 'Enable Laser',
      laserSelection: 'Laser Selection Mode',
      laserWidth: 'Width',
      cursorFollow: 'Cursor Follow',
      mouseTrail: 'Mouse Trail',
    },

    // World Info Panel
    worldInfo: {
      seed: 'Seed',
      size: 'Size',
      stats: 'Stats',
    },

    // Editor Tools
    editor: {
      view: 'View',
      viewTitle: 'View (V)',
      brush: 'Brush',
      brushTitle: 'Brush (B)',
      mountain: 'Mountain',
      mountainTitle: 'Mountain Line (M)',
      terrain: 'Terrain',
      terrainTitle: 'Terrain Face (P)',
      plate: 'Plate',
      plateTitle: 'Drag Plate (D)',
      annotate: 'Annotate',
      annotateTitle: 'Annotate (A)',

      // Brush settings
      radius: 'Radius',
      strength: 'Strength',

      // Brush operations
      raise: 'Raise',
      lower: 'Lower',
      land: 'Make Land',
      sea: 'Make Sea',
      platePaint: 'Plate Paint',

      // Tool buttons
      toggleNames: 'Toggle Name Display',
      clearSelection: 'Clear Selection (Esc)',
    },

    // Zoom Controls
    zoom: {
      resetTitle: 'Reset View',
    },

    // Progress View
    progress: {
      initializing: 'Initializing...',
    },

    // Checkpoint Panel
    checkpoint: {
      title: 'Checkpoint',
      save: '+ Save',
    },

    // Noise types
    noiseTypes: {
      perlin: 'Perlin',
      simplex: 'Simplex',
      value: 'Value',
      worley: 'Worley',
    },

    // FBM types
    fbmTypes: {
      standard: 'Standard FBM',
      ridged: 'Ridged',
      billowy: 'Billowy',
      warped: 'Warped',
    },

    // Size presets
    sizePresets: {
      '256²': '256²',
      '512²': '512²',
      '768×512': '768×512',
      '1024²': '1024²',
    },
  },

  'ja-JP': {
    // App Title & Header
    app: {
      title: 'MapGen Studio — プロシージャルワールドジェネレーター',
      logo: 'MapGen <em>Studio</em>',
    },

    // Top Bar
    toolbar: {
      generate: '生成',
      generateTitle: 'マップを生成 (Space)',
      random: 'ランダム',
      randomTitle: 'シードをランダム化して生成 (R)',
      undo: '元に戻す',
      undoTitle: '元に戻す (Ctrl+Z)',
      redo: 'やり直し',
      redoTitle: 'やり直し (Ctrl+Y)',
      export: 'エクスポート',
      exportTitle: 'PNG でエクスポート',
      statusReady: '準備完了',
      togglePanel: 'パネルを切り替え (Tab)',
      sizeHandle: 'ドラッグしてマップサイズを変更',
    },

    // Panel Tabs
    tabs: {
      world: 'ワールド',
      terrain: '地形',
      climate: '気候',
      water: '水文',
      render: 'レンダリング',
    },

    // World Settings
    world: {
      presets: 'ワールドプリセット',
      seed: 'シード',
      seedPlaceholder: 'シードを入力...',
      randomSeed: 'ランダムシード',
      mapSize: 'マップサイズ',
      width: '幅',
      height: '高さ',
      sizeInfo: '{width}×{height} · {pixels} ピクセル',
      noiseEngine: 'ノイズエンジン',
      octaves: 'オクターブ',
      lacunarity: 'ラキュナリティ',
      persistence: 'パーシステンス',
      tectonics: 'テクトニクス',
      plateCount: 'プレート数',
      landmass: '陸地率',
      mountainFold: '山の折りたたみ',
      coastDetail: '海岸の詳細',
      simulation: 'ワールドシミュレーション',
      oceanCurrents: '海流システム',
      iceSheet: '動的氷床 & 氷河侵食',
      monsoon: 'モンスーン循環',
      continentality: '大陸度補正',
      hadleyEnhancement: 'ハドレー循環強化',
    },

    // Terrain Settings
    terrain: {
      basics: '地形の基本',
      seaLevel: '海面',
      erosionStrength: '侵食強度',
      erosionIterations: '侵食反復回数',
      lakeDensity: '湖の密度',
    },

    // Climate Settings
    climate: {
      parameters: '気候パラメータ',
      tempOffset: '温度オフセット',
      snowLine: '雪線高度',
      rainStrength: '降雨強度',
      windDirection: '風向',
      windX: 'X',
      windY: 'Y',
    },

    // Water Settings
    water: {
      rivers: '河川',
      riverCount: '河川数',
    },

    // Render Settings
    render: {
      style: 'レンダリングスタイル',
      overlays: 'オーバーレイ',
      lighting: '照明',
      laser: 'レーザーポインタ (L)',

      // Render styles
      styles: {
        terrain: '地形',
        plates: 'プレート',
        parchment: '羊皮紙',
        satellite: '衛星',
        lowPoly: 'ローポリゴン',
        terrainDetail: '地形詳細',
        biomes: 'バイオーム',
        contours: '等高線',
        relief: 'レリーフ',
        azgaar: 'Azgaar',
        elevation: '標高図',
        slope: '傾斜図',
        moisture: '湿度図',
        temperature: '温度図',
        plateMap: 'プレート図',
        biomeMap: 'バイオーム図',
        ridgeMap: '山脊図',
        oceanCurrentMap: '海流図',
        iceSheetMap: '氷床図',
      },

      // Overlay options
      boundaries: 'プレート境界',
      boundaryWidth: '幅',
      rivers: '河川',
      contourLines: '等高線',
      terrainBase: '地形ベース',
      selectionHighlight: '選択ハイライト',
      climateZones: '気候帯',
      grid: 'グリッド',

      // Lighting options
      lightAngle: '照明角度',
      pointLight: 'ポイントライト',
      glowEffect: 'グロー効果',

      // Laser options
      enableLaser: 'レーザーを有効化',
      laserSelection: 'レーザー選択モード',
      laserWidth: '幅',
      cursorFollow: 'カーソル追従',
      mouseTrail: 'マウストレイル',
    },

    // World Info Panel
    worldInfo: {
      seed: 'シード',
      size: 'サイズ',
      stats: '統計',
    },

    // Editor Tools
    editor: {
      view: '表示',
      viewTitle: '表示 (V)',
      brush: 'ブラシ',
      brushTitle: 'ブラシ (B)',
      mountain: '山脈',
      mountainTitle: '山脈線 (M)',
      terrain: '地形',
      terrainTitle: '地形面 (P)',
      plate: 'プレート',
      plateTitle: 'プレートをドラッグ (D)',
      annotate: '注釈',
      annotateTitle: '注釈 (A)',

      // Brush settings
      radius: '半径',
      strength: '強度',

      // Brush operations
      raise: '隆起',
      lower: '沈降',
      land: '陸地化',
      sea: '海洋化',
      platePaint: 'プレートペイント',

      // Tool buttons
      toggleNames: '名前表示を切り替え',
      clearSelection: '選択をクリア (Esc)',
    },

    // Zoom Controls
    zoom: {
      resetTitle: 'ビューをリセット',
    },

    // Progress View
    progress: {
      initializing: '初期化中...',
    },

    // Checkpoint Panel
    checkpoint: {
      title: 'チェックポイント',
      save: '+ 保存',
    },

    // Noise types
    noiseTypes: {
      perlin: 'Perlin',
      simplex: 'Simplex',
      value: 'Value',
      worley: 'Worley',
    },

    // FBM types
    fbmTypes: {
      standard: '標準 FBM',
      ridged: 'リッジ',
      billowy: 'ビロウ',
      warped: 'ワープ',
    },

    // Size presets
    sizePresets: {
      '256²': '256²',
      '512²': '512²',
      '768×512': '768×512',
      '1024²': '1024²',
    },
  },
};

/**
 * Get a translation value by key path
 * @param locale - The locale to use
 * @param keyPath - Dot-separated key path (e.g., 'toolbar.generate')
 * @param params - Optional parameters for template substitution
 * @returns The translated string or the key path if not found
 */
export function t(
  locale: Locale,
  keyPath: string,
  params?: Record<string, string | number>
): string {
  const keys = keyPath.split('.');
  let value: string | TranslationTree | undefined = translations[locale];

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      // Fallback to English if translation not found
      if (locale !== 'en-US') {
        return t('en-US', keyPath, params);
      }
      return keyPath; // Return key path as last resort
    }
  }

  if (typeof value === 'string') {
    // Substitute parameters if provided
    if (params) {
      return value.replace(/\{(\w+)\}/g, (match, key: string) => {
        const param = params[key];
        return param !== undefined ? String(param) : match;
      });
    }
    return value;
  }

  return keyPath;
}

/**
 * Get the current locale from browser settings or default to zh-CN
 */
export function getPreferredLocale(): Locale {
  // eslint-disable-next-line no-restricted-globals
  if (typeof navigator !== 'undefined') {
    // eslint-disable-next-line no-restricted-globals
    const lang = navigator.language || navigator.languages[0] || 'zh-CN';
    if (lang.startsWith('en')) return 'en-US';
    if (lang.startsWith('ja')) return 'ja-JP';
  }
  return 'zh-CN';
}

/**
 * Create a bound translator function for a specific locale
 * @param locale - The locale to bind to
 * @returns A function that translates key paths
 */
export function createTranslator(
  locale: Locale
): (keyPath: string, params?: Record<string, string | number>) => string {
  return (keyPath: string, params?: Record<string, string | number>) => t(locale, keyPath, params);
}

export default {
  translations,
  t,
  getPreferredLocale,
  createTranslator,
};
