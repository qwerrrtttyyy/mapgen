import ControlPanel from '@/components/ControlPanel';
import CanvasContainer from '@/components/CanvasContainer';
import Toast from '@/components/Toast';

export default function App() {
  return (
    <div className="w-screen h-screen flex overflow-hidden bg-slate-950">
      {/* 左侧控制面板 */}
      <div className="w-80 flex-shrink-0 h-full border-r border-white/10">
        <ControlPanel />
      </div>

      {/* 右侧画布区域 */}
      <div className="flex-1 h-full">
        <CanvasContainer />
      </div>

      {/* Toast 通知 */}
      <Toast />
    </div>
  );
}
