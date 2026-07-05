/**
 * Map Generator Constants
 * Centralized configuration for magic numbers and default values
 */
// ── Erosion Constants ──
export const EROSION_WEIGHTS = {
    /** Ridged noise weight for continental elevation */
    RIDGED: 0.12,
    /** Detail noise weight for continental elevation */
    DETAIL: 0.14,
    /** Detail noise weight for oceanic elevation */
    OCEAN_DETAIL: 0.10,
};
export const EROSION_THRESHOLDS = {
    /** Coast detail activation threshold */
    COAST_DETAIL: 0.12,
    /** Lake elevation threshold above sea level */
    LAKE_ELEVATION: 0.1,
    /** Basin detection elevation threshold */
    BASIN_ELEVATION: 0.12,
    /** Basin slope threshold */
    BASIN_SLOPE: 0.02,
};
export const EROSION_PARAMS = {
    /** Default evaporation rate for hydraulic erosion */
    EVAPORATION_RATE: 0.01,
    /** Sediment deposition factor */
    SEDIMENT_DEPOSITION: 0.1,
    /** Carry capacity multiplier */
    CARRY_CAPACITY_MULTIPLIER: 5,
    /** Maximum change threshold for erosion convergence */
    MAX_CHANGE_THRESHOLD: 1e-5,
};
// ── Noise Constants ──
export const NOISE_FREQ = {
    /** Base frequency multiplier for terrain noise */
    BASE: 5,
    /** Ridge noise frequency multiplier */
    RIDGE: 8,
    /** Coast detail frequency multiplier */
    COAST_DETAIL: 18,
    /** Mountain detail frequency multiplier */
    MOUNTAIN_DETAIL: 30,
};
export const NOISE_OCTAVES = {
    /** Default octaves for terrain generation */
    TERRAIN: 6,
    /** Octaves for ridge field */
    RIDGE: 4,
    /** Octaves for coast detail */
    COAST_DETAIL: 3,
    /** Octaves for mountain detail */
    MOUNTAIN_DETAIL: 3,
};
// ── Tectonic Constants ──
export const TECTONIC_FORCE = {
    /** Convergent boundary force multiplier */
    CONVERGENT: 0.8,
    /** Divergent boundary force multiplier */
    DIVERGENT: 0.4,
    /** Transform boundary force multiplier */
    TRANSFORM: 0.3,
    /** Ridge noise contribution to mountains */
    RIDGE_CONTRIBUTION: 0.25,
};
export const PLATE_HEIGHT = {
    /** Continental base elevation */
    CONTINENTAL_BASE: 0.35,
    /** Continental shelf drop */
    CONTINENTAL_SHELF_DROP: 0.15,
    /** Oceanic base depth */
    OCEANIC_BASE: -0.35,
    /** Oceanic abyssal plain depth */
    OCEANIC_ABYSSAL: 0.25,
};
// ── Boundary Smoothing Constants ──
export const BOUNDARY_SMOOTH = {
    /** Radius for boundary band detection */
    BAND_RADIUS: 2,
    /** Number of smoothing passes */
    PASSES: 2,
    /** Neighborhood size for averaging (5x5) */
    NEIGHBORHOOD_SIZE: 5,
};
// ── Climate Constants ──
export const CLIMATE_THRESHOLDS = {
    /** Tropical temperature threshold (30°C) */
    TROPICAL: 0.6,
    /** Temperate temperature threshold (10°C) */
    TEMPERATE: 0.10,
    /** Arid precipitation threshold curve base */
    ARID_BASE: 0.10,
};
// ── Naming Constants ──
export const NAMING_BOUNDS = {
    /** Nameable plate/region bounding box margin (12% of dimension) */
    BOUND_MARGIN: 0.12,
};
// ── Biome Constants ──
export const BIOME_COUNT = 32;
export const BIOME_BANDS = {
    TROPICAL: 'A',
    ARID: 'B',
    TEMPERATE: 'C',
    CONTINENTAL: 'D',
    POLAR: 'E',
    ALPINE: 'M',
    SPECIAL: 'X',
};
// ── Watershed Constants ──
export const WATERSHED = {
    /** Maximum Strahler stream order */
    MAX_STREAM_ORDER: 7,
    /** Minimum basin size for merging */
    MIN_BASIN_SIZE: 100,
};
// ── Volcanism Constants ──
export const VOLCANISM = {
    /** Hotspot volcano probability threshold */
    PROBABILITY_THRESHOLD: 0.5,
    /** Caldera mask threshold */
    CALDERA_THRESHOLD: 0.8,
    /** Volcano site marker value */
    SITE_MARKER: 1,
};
// ── Season Constants ──
export const SEASON_COUNT = 4;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
// ── Default Map Parameters ──
export const DEFAULT_MAP = {
    /** Default map size */
    SIZE: 512,
    /** Default aspect ratio */
    ASPECT: '1:1',
    /** Default plate count */
    PLATE_COUNT: 15,
    /** Default landmass ratio */
    LANDMASS: 0.5,
    /** Default sea level */
    SEA_LEVEL: 0,
    /** Default mountain fold */
    MOUNTAIN_FOLD: 1.0,
    /** Default coast detail */
    COAST_DETAIL: 0.5,
    /** Default erosion iterations */
    EROSION_ITERATIONS: 20,
    /** Default erosion strength */
    EROSION_STRENGTH: 0.05,
    /** Default lake density */
    LAKE_DENSITY: 0.5,
    /** Default temperature offset */
    TEMP_OFFSET: 0,
    /** Default snow line */
    SNOW_LINE: 0.4,
};
// ── Aspect Ratio Map ──
export const ASPECT_MAP = {
    '1:1': 1,
    '4:3': 4 / 3,
    '16:9': 16 / 9,
    '2:1': 2,
    '3:2': 3 / 2,
};
