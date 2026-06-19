// 激光指针交互 Hook

import { useRef, useCallback, useEffect } from 'react';
import { useMapStore } from '@/store/useMapStore';

interface LaserState {
  isDragging: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  trail: { x: number; y: number; time: number }[];
}

export function useLaser(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const stateRef = useRef<LaserState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    trail: [],
  });
  const { mapState, togglePlateSelection, mapData } = useMapStore();
  const laserActive = mapState.laserActive;

  const getCanvasPos = useCallback((e: MouseEvent | Touch) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }, [canvasRef]);

  const onMouseDown = useCallback((e: MouseEvent) => {
    if (!laserActive) return;
    const pos = getCanvasPos(e);
    stateRef.current.isDragging = true;
    stateRef.current.startX = pos.x;
    stateRef.current.startY = pos.y;
    stateRef.current.currentX = pos.x;
    stateRef.current.currentY = pos.y;
  }, [laserActive, getCanvasPos]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!laserActive || !stateRef.current.isDragging) return;
    const pos = getCanvasPos(e);
    stateRef.current.currentX = pos.x;
    stateRef.current.currentY = pos.y;

    if (mapState.trailEnabled) {
      stateRef.current.trail.push({ x: pos.x, y: pos.y, time: performance.now() });
      // 清理旧轨迹
      const cutoff = performance.now() - 2000;
      stateRef.current.trail = stateRef.current.trail.filter(p => p.time > cutoff);
    }
  }, [laserActive, getCanvasPos, mapState.trailEnabled]);

  const onMouseUp = useCallback(() => {
    if (!stateRef.current.isDragging) return;
    stateRef.current.isDragging = false;

    // 简单的点选逻辑：如果移动距离很小，视为点击
    const dx = stateRef.current.currentX - stateRef.current.startX;
    const dy = stateRef.current.currentY - stateRef.current.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.02 && mapData) {
      // 查找点击位置的板块
      const x = Math.floor(stateRef.current.currentX * mapData.width);
      const y = Math.floor(stateRef.current.currentY * mapData.height);
      const idx = y * mapData.width + x;
      if (idx >= 0 && idx < mapData.plateTex.length / 4) {
        const plateId = Math.floor(mapData.plateTex[idx * 4] * mapState.plateCount);
        togglePlateSelection(plateId);
      }
    }
  }, [mapData, mapState.plateCount, togglePlateSelection]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseUp);
    };
  }, [canvasRef, onMouseDown, onMouseMove, onMouseUp]);

  return { laserState: stateRef };
}
