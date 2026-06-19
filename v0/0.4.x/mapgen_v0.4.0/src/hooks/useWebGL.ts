// WebGL 初始化与渲染 Hook

import { useRef, useEffect, useCallback } from 'react';
import { WebGLRenderer } from '@/renderer/webgl';
import { Canvas2DRenderer } from '@/renderer/canvas2d';
import { useMapStore } from '@/store/useMapStore';

export function useWebGL(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const rendererRef = useRef<WebGLRenderer | Canvas2DRenderer | null>(null);
  const rafRef = useRef<number>(0);
  const { mapState, mapData } = useMapStore();

  // 初始化渲染器
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      // 尝试 WebGL2
      rendererRef.current = new WebGLRenderer(canvas);
      console.log('Using WebGL2 renderer');
    } catch (e: any) {
      console.warn('WebGL2 not available, falling back to Canvas2D:', e?.message || e);
      try {
        rendererRef.current = new Canvas2DRenderer(canvas);
        console.log('Using Canvas2D renderer');
      } catch (e2: any) {
        console.error('Canvas2D also failed:', e2?.message || e2);
      }
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [canvasRef]);

  // 上传地图数据
  useEffect(() => {
    if (mapData && rendererRef.current) {
      rendererRef.current.uploadMapData(mapData);
    }
  }, [mapData]);

  // 渲染循环
  const render = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    if (renderer instanceof WebGLRenderer) {
      const params: Record<string, number | number[] | boolean> = {
        u_style: mapState.style,
        u_seaLevel: mapState.seaLevel,
        u_lightAngle: mapState.lightAngle,
        u_showBoundaries: mapState.showBoundaries,
        u_boundaryWidth: mapState.boundaryWidth,
        u_boundaryColor: mapState.boundaryColor,
        u_showRivers: mapState.showRivers,
        u_showContours: mapState.showContours,
        u_contourInterval: mapState.contourInterval,
        u_showTerrain: mapState.showTerrain,
        u_showSelection: mapState.showSelection,
        u_showClimate: mapState.showClimate,
        u_showGrid: mapState.showGrid,
        u_showElevScale: mapState.showElevScale,
        u_glowEnabled: mapState.glowEnabled,
        u_pointLightEnabled: mapState.pointLightEnabled,
        u_pointLightPos: mapState.pointLightPos,
        u_pointLightIntensity: mapState.pointLightIntensity,
        u_pointLightColor: mapState.pointLightColor,
      };
      renderer.render(params);
    } else if (renderer instanceof Canvas2DRenderer) {
      renderer.render();
    }
  }, [mapState]);

  useEffect(() => {
    const loop = () => {
      render();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [render]);

  return { rendererRef };
}
