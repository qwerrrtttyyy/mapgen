/**
 * Map Generator Constants
 * Centralized configuration for magic numbers and default values
 */
export declare const EROSION_WEIGHTS: {
    /** Ridged noise weight for continental elevation */
    readonly RIDGED: 0.12;
    /** Detail noise weight for continental elevation */
    readonly DETAIL: 0.14;
    /** Detail noise weight for oceanic elevation */
    readonly OCEAN_DETAIL: 0.1;
};
export declare const EROSION_THRESHOLDS: {
    /** Coast detail activation threshold */
    readonly COAST_DETAIL: 0.12;
    /** Lake elevation threshold above sea level */
    readonly LAKE_ELEVATION: 0.1;
    /** Basin detection elevation threshold */
    readonly BASIN_ELEVATION: 0.12;
    /** Basin slope threshold */
    readonly BASIN_SLOPE: 0.02;
};
export declare const EROSION_PARAMS: {
    /** Default evaporation rate for hydraulic erosion */
    readonly EVAPORATION_RATE: 0.01;
    /** Sediment deposition factor */
    readonly SEDIMENT_DEPOSITION: 0.1;
    /** Carry capacity multiplier */
    readonly CARRY_CAPACITY_MULTIPLIER: 5;
    /** Maximum change threshold for erosion convergence */
    readonly MAX_CHANGE_THRESHOLD: 0.00001;
};
export declare const NOISE_FREQ: {
    /** Base frequency multiplier for terrain noise */
    readonly BASE: 5;
    /** Ridge noise frequency multiplier */
    readonly RIDGE: 8;
    /** Coast detail frequency multiplier */
    readonly COAST_DETAIL: 18;
    /** Mountain detail frequency multiplier */
    readonly MOUNTAIN_DETAIL: 30;
};
export declare const NOISE_OCTAVES: {
    /** Default octaves for terrain generation */
    readonly TERRAIN: 6;
    /** Octaves for ridge field */
    readonly RIDGE: 4;
    /** Octaves for coast detail */
    readonly COAST_DETAIL: 3;
    /** Octaves for mountain detail */
    readonly MOUNTAIN_DETAIL: 3;
};
export declare const TECTONIC_FORCE: {
    /** Convergent boundary force multiplier */
    readonly CONVERGENT: 0.8;
    /** Divergent boundary force multiplier */
    readonly DIVERGENT: 0.4;
    /** Transform boundary force multiplier */
    readonly TRANSFORM: 0.3;
    /** Ridge noise contribution to mountains */
    readonly RIDGE_CONTRIBUTION: 0.25;
};
export declare const PLATE_HEIGHT: {
    /** Continental base elevation */
    readonly CONTINENTAL_BASE: 0.35;
    /** Continental shelf drop */
    readonly CONTINENTAL_SHELF_DROP: 0.15;
    /** Oceanic base depth */
    readonly OCEANIC_BASE: -0.35;
    /** Oceanic abyssal plain depth */
    readonly OCEANIC_ABYSSAL: 0.25;
};
export declare const BOUNDARY_SMOOTH: {
    /** Radius for boundary band detection */
    readonly BAND_RADIUS: 2;
    /** Number of smoothing passes */
    readonly PASSES: 2;
    /** Neighborhood size for averaging (5x5) */
    readonly NEIGHBORHOOD_SIZE: 5;
};
export declare const CLIMATE_THRESHOLDS: {
    /** Tropical temperature threshold (30°C) */
    readonly TROPICAL: 0.6;
    /** Temperate temperature threshold (10°C) */
    readonly TEMPERATE: 0.1;
    /** Arid precipitation threshold curve base */
    readonly ARID_BASE: 0.1;
};
export declare const NAMING_BOUNDS: {
    /** Nameable plate/region bounding box margin (12% of dimension) */
    readonly BOUND_MARGIN: 0.12;
};
export declare const BIOME_COUNT: 32;
export declare const BIOME_BANDS: {
    readonly TROPICAL: "A";
    readonly ARID: "B";
    readonly TEMPERATE: "C";
    readonly CONTINENTAL: "D";
    readonly POLAR: "E";
    readonly ALPINE: "M";
    readonly SPECIAL: "X";
};
export declare const WATERSHED: {
    /** Maximum Strahler stream order */
    readonly MAX_STREAM_ORDER: 7;
    /** Minimum basin size for merging */
    readonly MIN_BASIN_SIZE: 100;
};
export declare const VOLCANISM: {
    /** Hotspot volcano probability threshold */
    readonly PROBABILITY_THRESHOLD: 0.5;
    /** Caldera mask threshold */
    readonly CALDERA_THRESHOLD: 0.8;
    /** Volcano site marker value */
    readonly SITE_MARKER: 1;
};
export declare const SEASON_COUNT: 4;
export declare const SEASONS: readonly ["spring", "summer", "autumn", "winter"];
export declare const DEFAULT_MAP: {
    /** Default map size */
    readonly SIZE: 512;
    /** Default aspect ratio */
    readonly ASPECT: "1:1";
    /** Default plate count */
    readonly PLATE_COUNT: 15;
    /** Default landmass ratio */
    readonly LANDMASS: 0.5;
    /** Default sea level */
    readonly SEA_LEVEL: 0;
    /** Default mountain fold */
    readonly MOUNTAIN_FOLD: 1;
    /** Default coast detail */
    readonly COAST_DETAIL: 0.5;
    /** Default erosion iterations */
    readonly EROSION_ITERATIONS: 20;
    /** Default erosion strength */
    readonly EROSION_STRENGTH: 0.05;
    /** Default lake density */
    readonly LAKE_DENSITY: 0.5;
    /** Default temperature offset */
    readonly TEMP_OFFSET: 0;
    /** Default snow line */
    readonly SNOW_LINE: 0.4;
};
export declare const ASPECT_MAP: Record<string, number>;
