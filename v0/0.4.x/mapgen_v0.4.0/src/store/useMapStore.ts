// Zustand 状态管理

import { create } from 'zustand';
import { MapState, MapData, Theme, Lang } from '@/types';

const defaultState: Omit<MapState, '_needsRegen' | '_isGenerating'> = {
  seedStr: 'MaterialMap2025',
  mapSize: 1024,
  mapAspect: '1:1',
  plateCount: 8,
  landmass: 0.5,
  noiseType: 'simplex',
  fbmType: 'standard',
  octaves: 6,
  lacunarity: 2.0,
  persistence: 0.5,
  seaLevel: 0.0,
  erosionStrength: 0.5,
  erosionIterations: 3,
  mountainFold: 0.5,
  tempOffset: 0.0,
  snowLine: 0.2,
  coastDetail: 0.5,
  lakeDensity: 0.3,

  detailRiverWidth: 0.5,
  detailRiverCurve: 0.5,
  detailCoastJagged: 0.5,
  detailRidgeDensity: 0.5,
  detailRainfallOffset: 0.5,
  detailTempGradient: 0.5,
  detailBiomeBlend: 0.5,

  style: 0,
  showBoundaries: true,
  boundaryWidth: 2,
  boundaryColor: [1, 1, 1],
  showNames: true,
  showRivers: true,
  showContours: false,
  contourInterval: 0.1,
  showTerrain: true,
  showSelection: true,
  showClimate: false,
  showGrid: false,
  showElevScale: false,
  showRegionNames: false,
  geoLabels: false,
  lightAngle: 45,
  pointLightEnabled: false,
  pointLightPos: [0.5, 0.5],
  pointLightIntensity: 1.0,
  pointLightColor: [1, 0.9, 0.7],
  glowEnabled: false,

  laserActive: false,
  trailEnabled: true,
  laserSmooth: true,
  cursorActive: false,

  customPlateNames: {},
  customRegionNames: {},

  perfEnabled: false,
};

interface StoreState {
  mapState: MapState;
  mapData: MapData | null;
  theme: Theme;
  lang: Lang;
  selectedPlates: Set<number>;
  selectedRegions: Set<number>;
  isGenerating: boolean;
  generationProgress: number;
  toast: { message: string; type: 'info' | 'success' | 'error' } | null;

  setParam: <K extends keyof MapState>(key: K, value: MapState[K]) => void;
  setMapData: (data: MapData | null) => void;
  setTheme: (theme: Theme) => void;
  setLang: (lang: Lang) => void;
  setGenerating: (v: boolean) => void;
  setProgress: (v: number) => void;
  togglePlateSelection: (id: number) => void;
  toggleRegionSelection: (id: number) => void;
  setToast: (toast: { message: string; type: 'info' | 'success' | 'error' } | null) => void;
  resetParams: () => void;
}

export const useMapStore = create<StoreState>((set) => ({
  mapState: { ...defaultState, _needsRegen: true, _isGenerating: false },
  mapData: null,
  theme: 'modern',
  lang: 'zh',
  selectedPlates: new Set(),
  selectedRegions: new Set(),
  isGenerating: false,
  generationProgress: 0,
  toast: null,

  setParam: (key, value) =>
    set((state) => ({
      mapState: { ...state.mapState, [key]: value, _needsRegen: true },
    })),

  setMapData: (data) => set({ mapData: data }),
  setTheme: (theme) => set({ theme }),
  setLang: (lang) => set({ lang }),
  setGenerating: (v) => set({ isGenerating: v }),
  setProgress: (v) => set({ generationProgress: v }),

  togglePlateSelection: (id) =>
    set((state) => {
      const s = new Set(state.selectedPlates);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return { selectedPlates: s };
    }),

  toggleRegionSelection: (id) =>
    set((state) => {
      const s = new Set(state.selectedRegions);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return { selectedRegions: s };
    }),

  setToast: (toast) => set({ toast }),

  resetParams: () =>
    set({
      mapState: { ...defaultState, _needsRegen: true, _isGenerating: false },
      selectedPlates: new Set(),
      selectedRegions: new Set(),
    }),
}));
