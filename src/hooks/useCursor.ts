// 光标系统 Hook

import { useRef, useCallback, useEffect } from 'react';
import { useMapStore } from '@/store/useMapStore';

interface CursorState {
  x: number;
  y: number;
  visible: boolean;
  label: string;
}

export function useCursor(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const stateRef = useRef<CursorState>({
    x: 0.5,
    y: 0.5,
    visible: false,
    label: '',
  });
  const { mapState, mapData } = useMapStore();
  const cursorActive = mapState.cursorActive;

  const getCanvasPos = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }, [canvasRef]);

  const updateLabel = useCallback((x: number, y: number) => {
    if (!mapData) {
      stateRef.current.label = '';
      return;
    }
    const px = Math.floor(x * mapData.width);
    const py = Math.floor(y * mapData.height);
    const idx = py * mapData.width + px;
    if (idx < 0 || idx >= mapData.plateTex.length / 4) {
      stateRef.current.label = '';
      return;
    }
    const plateId = Math.floor(mapData.plateTex[idx * 4] * mapState.plateCount);
    const plate = mapData.plates[plateId];
    const elev = mapData.elevTex[idx * 4];
    const temp = mapData.moistTex[idx * 4 + 2];
    const moist = mapData.moistTex[idx * 4];
    stateRef.current.label = `${plate?.name || 'Unknown'} | 海拔:${(elev * 1000).toFixed(0)}m | 温度:${(temp * 30).toFixed(1)}°C | 湿度:${(moist * 100).toFixed(0)}%`;
  }, [mapData, mapState.plateCount]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!cursorActive) return;
    const pos = getCanvasPos(e);
    stateRef.current.x = pos.x;
    stateRef.current.y = pos.y;
    stateRef.current.visible = true;
    updateLabel(pos.x, pos.y);
  }, [cursorActive, getCanvasPos, updateLabel]);

  const onMouseLeave = useCallback(() => {
    stateRef.current.visible = false;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);

    return () => {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [canvasRef, onMouseMove, onMouseLeave]);

  return { cursorState: stateRef };
}
