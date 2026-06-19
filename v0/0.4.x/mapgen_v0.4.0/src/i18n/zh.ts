export default {
  appName: 'Material Map Generator',
  tagline: '基于程序化噪声与板块构造模拟的地图生成工具',
  generate: '生成地图',
  generating: '生成中...',
  reset: '重置',
  export: '导出',
  save: '保存',
  load: '加载',
  settings: '设置',
  help: '帮助',
  about: '关于',

  // 生成参数
  seed: '种子',
  mapSize: '地图尺寸',
  mapAspect: '宽高比',
  plateCount: '板块数量',
  landmass: '陆地比例',
  noiseType: '噪声类型',
  fbmType: 'FBM类型',
  octaves: '倍频',
  lacunarity: '间隙度',
  persistence: '持续度',
  seaLevel: '海平面',
  erosionStrength: '侵蚀强度',
  erosionIterations: '侵蚀迭代',
  mountainFold: '山脉褶皱',
  tempOffset: '温度偏移',
  snowLine: '雪线',
  coastDetail: '海岸线细节',
  lakeDensity: '湖泊密度',

  // 噪声类型
  simplex: 'Simplex',
  perlin: 'Perlin',
  value: 'Value',
  worley: 'Worley',

  // FBM类型
  standard: '标准',
  ridged: '脊状',
  billowy: '蓬松',
  warped: '扭曲',

  // 渲染风格
  style: '渲染风格',
  styleLowPoly: '低多边形',
  styleElevation: '地形高程',
  stylePlate: '板块着色',
  styleParchment: '羊皮卷',
  styleSatellite: '卫星视图',
  styleTerrainDetail: '地形详情',
  styleBiome: '生物群落',
  styleContour: '等高线',
  styleRelief: '地形浮雕',
  styleAzgaar: 'Azgaar风格',

  // 图层控制
  showBoundaries: '板块边界',
  showNames: '板块名称',
  showRivers: '河流水系',
  showContours: '等高线',
  showTerrain: '地形底图',
  showSelection: '选中高亮',
  showClimate: '气候分区',
  showGrid: '比例网格',
  showElevScale: '海拔尺',
  showRegionNames: '地形区标注',
  geoLabels: '地理标注',

  // 光照
  lightAngle: '光照角度',
  pointLight: '点光源',
  pointLightIntensity: '点光源强度',
  glow: '大气光晕',

  // 交互
  laserPointer: '激光指针',
  trail: '流光轨迹',
  laserSmooth: '防抖平滑',
  cursor: '光标系统',

  // 导出
  exportPNG: '导出 PNG',
  exportJPEG: '导出 JPEG',
  exportWebP: '导出 WebP',
  exportJSON: '导出 JSON',

  // 性能
  fps: 'FPS',
  renderTime: '渲染耗时',
  genTime: '生成耗时',
  memory: '内存',

  // 提示
  seedHint: '输入任意字符串作为随机种子',
  generateHint: '点击生成新的地图',
};
