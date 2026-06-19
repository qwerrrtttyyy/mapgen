// 地图生成 Hook

import { useCallback } from 'react';
import { useMapStore } from '@/store/useMapStore';
import { generateMap } from '@/engine';
import { GenerationParams } from '@/types';

export function useMapGeneration() {
  const { mapState, setMapData, setGenerating, setProgress, setToast } = useMapStore();

  const generate = useCallback(() => {
    const params: GenerationParams = {
      seedStr: mapState.seedStr,
      mapSize: mapState.mapSize,
      mapAspect: mapState.mapAspect,
      plateCount: mapState.plateCount,
      landmass: mapState.landmass,
      noiseType: mapState.noiseType,
      fbmType: mapState.fbmType,
      octaves: mapState.octaves,
      lacunarity: mapState.lacunarity,
      persistence: mapState.persistence,
      seaLevel: mapState.seaLevel,
      erosionStrength: mapState.erosionStrength,
      erosionIterations: mapState.erosionIterations,
      mountainFold: mapState.mountainFold,
      tempOffset: mapState.tempOffset,
      snowLine: mapState.snowLine,
      coastDetail: mapState.coastDetail,
      lakeDensity: mapState.lakeDensity,
    };

    setGenerating(true);
    setProgress(0);

    // 使用 setTimeout 让 UI 有机会更新
    setTimeout(() => {
      try {
        const start = performance.now();
        const data = generateMap(params);
        const elapsed = performance.now() - start;
        setMapData(data);
        setProgress(100);
        setToast({ message: `地图生成完成 (${elapsed.toFixed(0)}ms)`, type: 'success' });
      } catch (e) {
        setToast({ message: '生成失败: ' + String(e), type: 'error' });
      } finally {
        setGenerating(false);
      }
    }, 50);
  }, [mapState, setMapData, setGenerating, setProgress, setToast]);

  return { generate };
}
