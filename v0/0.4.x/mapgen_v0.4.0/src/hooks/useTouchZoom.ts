// 触控缩放/平移 Hook

import { useRef, useEffect, useCallback } from 'react';

interface TouchState {
  scale: number;
  offsetX: number;
  offsetY: number;
  lastDist: number;
  lastCenter: { x: number; y: number };
}

export function useTouchZoom(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const stateRef = useRef<TouchState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    lastDist: 0,
    lastCenter: { x: 0, y: 0 },
  });

  const getDistance = useCallback((t1: Touch, t2: Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const getCenter = useCallback((t1: Touch, t2: Touch) => {
    return {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    };
  }, []);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getDistance(e.touches[0], e.touches[1]);
      const center = getCenter(e.touches[0], e.touches[1]);
      stateRef.current.lastDist = dist;
      stateRef.current.lastCenter = center;
    }
  }, [getDistance, getCenter]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getDistance(e.touches[0], e.touches[1]);
      const center = getCenter(e.touches[0], e.touches[1]);
      const scale = stateRef.current.scale * (dist / stateRef.current.lastDist);
      stateRef.current.scale = Math.max(0.5, Math.min(5, scale));
      stateRef.current.offsetX += center.x - stateRef.current.lastCenter.x;
      stateRef.current.offsetY += center.y - stateRef.current.lastCenter.y;
      stateRef.current.lastDist = dist;
      stateRef.current.lastCenter = center;
    }
  }, [getDistance, getCenter]);

  const onTouchEnd = useCallback(() => {
    // 可以在这里添加惯性滚动
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [canvasRef, onTouchStart, onTouchMove, onTouchEnd]);

  return { touchState: stateRef };
}
