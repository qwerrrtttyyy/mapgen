import { useRef, useEffect, useState } from 'react';
import { useWebGL } from '@/hooks/useWebGL';
import { useLaser } from '@/hooks/useLaser';
import { useCursor } from '@/hooks/useCursor';
import { useTouchZoom } from '@/hooks/useTouchZoom';
import { useMapStore } from '@/store/useMapStore';

export default function CanvasContainer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { mapData, isGenerating, generationProgress, mapState } = useMapStore();
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  const { rendererRef } = useWebGL(canvasRef);
  const { laserState } = useLaser(canvasRef);
  const { cursorState } = useCursor(canvasRef);
  const { touchState } = useTouchZoom(canvasRef);

  // 响应式尺寸调整
  useEffect(() => {
    const updateSize = () => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setCanvasSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // 调整 canvas 尺寸并通知渲染器
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    canvas.style.width = canvasSize.width + 'px';
    canvas.style.height = canvasSize.height + 'px';
    if (rendererRef.current) {
      rendererRef.current.resize(canvasSize.width, canvasSize.height);
    }
  }, [canvasSize, rendererRef]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-950 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ imageRendering: 'auto' }}
      />

      {/* 光标标签 */}
      {mapState.cursorActive && cursorState.current.visible && (
        <div
          className="absolute pointer-events-none z-20 px-2 py-1 rounded bg-black/70 text-white text-xs whitespace-nowrap"
          style={{
            left: `${cursorState.current.x * 100}%`,
            top: `${cursorState.current.y * 100}%`,
            transform: 'translate(-50%, -150%)',
          }}
        >
          {cursorState.current.label}
        </div>
      )}

      {/* 生成进度遮罩 */}
      {isGenerating && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10">
          <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300"
              style={{ width: `${generationProgress}%` }}
            />
          </div>
          <p className="text-white/80 text-sm mt-3">生成中... {Math.round(generationProgress)}%</p>
        </div>
      )}

      {/* 空状态提示 */}
      {!mapData && !isGenerating && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40">
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/20 animate-spin mb-4" style={{ animationDuration: '8s' }} />
          <p className="text-sm">点击左侧「生成地图」按钮开始</p>
        </div>
      )}

      {/* 地图信息 */}
      {mapData && (
        <div className="absolute bottom-4 left-4 text-white/50 text-xs space-y-0.5 pointer-events-none">
          <p>{mapData.width} x {mapData.height}</p>
          <p>板块: {mapData.plates.length} | 地形区: {mapData.regions.length} | 河流: {mapData.rivers.length}</p>
        </div>
      )}
    </div>
  );
}
