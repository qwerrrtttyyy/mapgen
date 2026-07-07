/**
 * 核心引擎常量
 *
 * 集中管理所有魔法数字，便于调参和维护。
 * @packageDocumentation
 */

// ── 高度场 ──────────────────────────────────────────────

/** 大陆板块基础高度（中心） */
export const CONTINENT_BASE_ELEVATION = 0.35;

/** 大陆边缘大陆架衰减 */
export const CONTINENT_SHELF_DROP = 0.15;

/** 大洋板块基础深度（中心） */
export const OCEAN_BASE_DEPTH = -0.35;

/** 大洋深渊额外深度 */
export const OCEAN_ABYSS_DROP = 0.25;

/** FBM 陆地 ridged 噪声权重 */
export const LAND_RIDGED_WEIGHT = 0.12;

/** FBM 陆地 standard 噪声权重 */
export const LAND_DETAIL_WEIGHT = 0.14;

/** FBM 海洋 standard 噪声权重 */
export const OCEAN_DETAIL_WEIGHT = 0.1;

/** 山脊场激活阈值（ridge > threshold 且 elev > seaLevel） */
export const RIDGE_ACTIVATION_THRESHOLD = 0.55;

/** 海岸细节抖动范围（距海平面 ± 范围内生效） */
export const COAST_DETAIL_RANGE = 0.12;

/** 海岸细节最大偏移 */
export const COAST_DETAIL_MAX_OFFSET = 0.06;

/** 边界平滑邻域半径 */
export const BOUNDARY_SMOOTH_RADIUS = 2;

/** 边界平滑 pass 数 */
export const BOUNDARY_SMOOTH_PASSES = 2;

/** 构造力汇聚→山脉缩放因子 */
export const CONVERGENT_MOUNTAIN_SCALE = 0.8;

/** 构造力汇聚→山脉噪声偏移 */
export const CONVERGENT_NOISE_OFFSET = 0.25;

/** 构造力离散→裂谷缩放因子 */
export const DIVERGENT_RIFT_SCALE = 0.4;

// ── 板块构造 ────────────────────────────────────────────

/** 板块角度扰动幅度 */
export const PLATE_ANGLE_JITTER = 0.5;

/** 板块距离范围最小值 */
export const PLATE_DIST_MIN = 0.2;

/** 板块距离范围最大值 */
export const PLATE_DIST_MAX = 0.3;

/** 板块速度缩放 */
export const PLATE_VELOCITY_SCALE = 0.02;

/** 边界类型判定阈值 */
export const BOUNDARY_TYPE_THRESHOLD = 0.003;

/** 汇聚边界强度缩放 */
export const CONVERGENT_INTENSITY_SCALE = 10;

/** 离散边界强度缩放 */
export const DIVERGENT_INTENSITY_SCALE = 10;

/** 走滑边界强度缩放 */
export const TRANSFORM_INTENSITY_SCALE = 5;

/** 边界可视化基础偏移 */
export const BOUNDARY_VIS_BASE = 0.5;

/** 边界可视化强度缩放 */
export const BOUNDARY_VIS_SCALE = 0.3;

// ── 侵蚀 ────────────────────────────────────────────────

/** 水力侵蚀初始水量增量 */
export const EROSION_WATER_INCREMENT = 0.01;

/** 水力侵蚀携带容量斜率因子 */
export const EROSION_SLOPE_CAPACITY_FACTOR = 5;

/** 水力侵蚀沉积/侵蚀步长 */
export const EROSION_STEP_FRACTION = 0.1;

/** 水力侵蚀水量转移比例 */
export const EROSION_WATER_TRANSFER = 0.5;

/** 水力侵蚀蒸发率 */
export const EROSION_DEFAULT_EVAPORATION = 0.01;

/** 水力侵蚀最大变化阈值（提前终止） */
export const EROSION_MAX_CHANGE_THRESHOLD = 1e-5;

// ── 湖泊 ────────────────────────────────────────────────

/** 湖泊检测邻域半径 */
export const LAKE_CHECK_RADIUS = 1;

/** 湖泊扩展邻域半径 */
export const LAKE_FILL_RADIUS = 1;

/** 湖泊高度范围上限（高于海平面） */
export const LAKE_MAX_ELEV_ABOVE_SEA = 0.1;

// ── 洋流 ────────────────────────────────────────────────

/** 洋流纹理归一化偏移（[-1,1] → [0,1]） */
export const CURRENT_TEX_OFFSET = 0.5;

/** 洋流速度归一化缩放 */
export const CURRENT_SPEED_SCALE = 4;

// ── 纹理打包 ────────────────────────────────────────────

/** 板块 ID 归一化除数（最大板块数） */
export const MAX_PLATE_COUNT = 256;

/** 生物群系 ID 归一化除数（32 类） */
export const BIOME_ID_NORMALIZE = 31;

/** 温度带归一化除数 */
export const TEMP_ZONE_NORMALIZE = 4;

/** Köppen 带归一化除数 */
export const KOPPEN_BAND_NORMALIZE = 7;

/** Strahler 河序归一化除数 */
export const STREAM_ORDER_NORMALIZE = 7;

/** 流域盆地 ID 归一化上限 */
export const BASIN_ID_MAX = 65535;

/** 破火山口掩码归一化 */
export const CALDERA_MASK_NORMALIZE = 0.5;

/** 热点强度归一化 */
export const HOTSPOT_STRENGTH_NORMALIZE = 0.5;

// ── 噪声 ────────────────────────────────────────────────

/** Worley 缓存最大条目数 */
export const WORLEY_CACHE_MAX = 10000;

/** 域形变默认强度 */
export const DEFAULT_WARP_STRENGTH = 0.35;

/** FBM 谱权重衰减系数 */
export const SPECTRAL_DECAY = 0.4;

// ── UI / 渲染 ───────────────────────────────────────────

/** 缩略图尺寸（像素） */
export const THUMBNAIL_SIZE = 64;

/** 检查点最大数量 */
export const MAX_CHECKPOINTS = 10;

/** 编辑器命令栈最大深度 */
export const MAX_COMMAND_STACK = 50;

/** 最小地图尺寸 */
export const MIN_MAP_SIZE = 64;

/** 最大地图尺寸 */
export const MAX_MAP_SIZE = 2048;

/** 小地图默认尺寸 */
export const MINIMAP_SIZE = 128;
