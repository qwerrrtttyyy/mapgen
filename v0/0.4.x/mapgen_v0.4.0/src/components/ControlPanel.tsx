import { useMapStore } from '@/store/useMapStore';
import { t } from '@/i18n';
import { useMapGeneration } from '@/hooks/useMapGeneration';
import { saveMap, loadMaps, deleteMap, SavedMap } from '@/utils/storage';
import { exportPNG, exportJPEG, exportWebP, exportElevationJSON, exportFullJSON } from '@/utils/export';
import { Settings, RotateCcw, Download, Save, FolderOpen, Sun, Moon, Languages } from 'lucide-react';
import { useState } from 'react';

export default function ControlPanel() {
  const store = useMapStore();
  const { mapState, setParam, theme, setTheme, lang, setLang, isGenerating, resetParams, mapData, setToast } = store;
  const { generate } = useMapGeneration();
  const [activeTab, setActiveTab] = useState<'generate' | 'render' | 'light' | 'detail'>('generate');
  const [showExport, setShowExport] = useState(false);
  const [savedMaps, setSavedMaps] = useState<SavedMap[]>([]);
  const [showSaved, setShowSaved] = useState(false);

  const T = (key: string) => t(lang, key);

  const noiseTypes = ['simplex', 'perlin', 'value', 'worley'];
  const fbmTypes = ['standard', 'ridged', 'billowy', 'warped'];
  const aspects = ['1:1', '4:3', '16:9', '2:1', '3:2'];
  const styles = [
    'styleLowPoly', 'styleElevation', 'stylePlate', 'styleParchment',
    'styleSatellite', 'styleTerrainDetail', 'styleBiome', 'styleContour',
    'styleRelief', 'styleAzgaar'
  ];

  const slider = (label: string, key: keyof typeof mapState, min: number, max: number, step: number) => (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1 opacity-80">
        <span>{label}</span>
        <span>{(mapState[key] as number).toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={mapState[key] as number}
        onChange={(e) => setParam(key, parseFloat(e.target.value) as any)}
        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-white/10 accent-violet-400"
      />
    </div>
  );

  return (
    <div className={`h-full flex flex-col ${theme === 'modern' ? 'bg-slate-900/80 text-slate-100' : 'bg-gray-900 text-gray-100'} overflow-hidden`}>
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <h1 className="text-lg font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
          {T('appName')}
        </h1>
        <p className="text-xs opacity-60 mt-1">{T('tagline')}</p>
      </div>

      {/* Tabs */}
      <div className="flex text-xs border-b border-white/10">
        {(['generate', 'render', 'light', 'detail'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-center transition-colors ${
              activeTab === tab ? 'bg-white/10 text-violet-300' : 'opacity-60 hover:opacity-100'
            }`}
          >
            {tab === 'generate' && '生成'}
            {tab === 'render' && '渲染'}
            {tab === 'light' && '光照'}
            {tab === 'detail' && '细节'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'generate' && (
          <>
            <div className="mb-3">
              <label className="text-xs opacity-80 block mb-1">{T('seed')}</label>
              <input
                type="text"
                value={mapState.seedStr}
                onChange={(e) => setParam('seedStr', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-violet-400"
                placeholder={T('seedHint')}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs opacity-80 block mb-1">{T('mapSize')}</label>
                <select
                  value={mapState.mapSize}
                  onChange={(e) => setParam('mapSize', parseInt(e.target.value))}
                  className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm"
                >
                  <option value={512}>512</option>
                  <option value={1024}>1024</option>
                  <option value={2048}>2048</option>
                </select>
              </div>
              <div>
                <label className="text-xs opacity-80 block mb-1">{T('mapAspect')}</label>
                <select
                  value={mapState.mapAspect}
                  onChange={(e) => setParam('mapAspect', e.target.value as any)}
                  className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm"
                >
                  {aspects.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>

            {slider(T('plateCount'), 'plateCount', 4, 32, 1)}
            {slider(T('landmass'), 'landmass', 0.1, 0.9, 0.05)}

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs opacity-80 block mb-1">{T('noiseType')}</label>
                <select
                  value={mapState.noiseType}
                  onChange={(e) => setParam('noiseType', e.target.value as any)}
                  className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm"
                >
                  {noiseTypes.map((n) => (
                    <option key={n} value={n}>{T(n)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs opacity-80 block mb-1">{T('fbmType')}</label>
                <select
                  value={mapState.fbmType}
                  onChange={(e) => setParam('fbmType', e.target.value as any)}
                  className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm"
                >
                  {fbmTypes.map((f) => (
                    <option key={f} value={f}>{T(f)}</option>
                  ))}
                </select>
              </div>
            </div>

            {slider(T('octaves'), 'octaves', 1, 10, 1)}
            {slider(T('lacunarity'), 'lacunarity', 1.5, 3, 0.1)}
            {slider(T('persistence'), 'persistence', 0.1, 0.9, 0.05)}
            {slider(T('seaLevel'), 'seaLevel', -0.5, 0.5, 0.05)}
            {slider(T('erosionStrength'), 'erosionStrength', 0, 1, 0.05)}
            {slider(T('erosionIterations'), 'erosionIterations', 0, 10, 1)}
            {slider(T('mountainFold'), 'mountainFold', 0, 1, 0.05)}
            {slider(T('tempOffset'), 'tempOffset', -0.5, 0.5, 0.05)}
            {slider(T('snowLine'), 'snowLine', 0, 0.5, 0.05)}
            {slider(T('coastDetail'), 'coastDetail', 0, 1, 0.05)}
            {slider(T('lakeDensity'), 'lakeDensity', 0, 1, 0.05)}
          </>
        )}

        {activeTab === 'render' && (
          <>
            <div className="mb-3">
              <label className="text-xs opacity-80 block mb-1">{T('style')}</label>
              <select
                value={mapState.style}
                onChange={(e) => setParam('style', parseInt(e.target.value))}
                className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm"
              >
                {styles.map((s, i) => (
                  <option key={i} value={i}>{T(s)}</option>
                ))}
              </select>
            </div>

            {[
              ['showBoundaries', 'showBoundaries'],
              ['showNames', 'showNames'],
              ['showRivers', 'showRivers'],
              ['showContours', 'showContours'],
              ['showTerrain', 'showTerrain'],
              ['showSelection', 'showSelection'],
              ['showClimate', 'showClimate'],
              ['showGrid', 'showGrid'],
              ['showElevScale', 'showElevScale'],
              ['showRegionNames', 'showRegionNames'],
              ['geoLabels', 'geoLabels'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mapState[key as keyof typeof mapState] as boolean}
                  onChange={(e) => setParam(key as any, e.target.checked)}
                  className="w-4 h-4 rounded accent-violet-400"
                />
                <span className="text-sm">{T(label)}</span>
              </label>
            ))}

            {mapState.showContours && slider(T('contourInterval'), 'contourInterval', 0.02, 0.2, 0.01)}
            {slider(T('boundaryWidth'), 'boundaryWidth', 0.5, 5, 0.5)}
          </>
        )}

        {activeTab === 'light' && (
          <>
            {slider(T('lightAngle'), 'lightAngle', 0, 360, 1)}
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={mapState.pointLightEnabled}
                onChange={(e) => setParam('pointLightEnabled', e.target.checked)}
                className="w-4 h-4 rounded accent-violet-400"
              />
              <span className="text-sm">{T('pointLight')}</span>
            </label>
            {mapState.pointLightEnabled && (
              <>
                {slider(T('pointLightIntensity'), 'pointLightIntensity', 0, 3, 0.1)}
                {slider('X', 'pointLightPos', 0, 1, 0.05)}
                {slider('Y', 'pointLightPos', 0, 1, 0.05)}
              </>
            )}
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={mapState.glowEnabled}
                onChange={(e) => setParam('glowEnabled', e.target.checked)}
                className="w-4 h-4 rounded accent-violet-400"
              />
              <span className="text-sm">{T('glow')}</span>
            </label>
          </>
        )}

        {activeTab === 'detail' && (
          <>
            {slider('河流宽度', 'detailRiverWidth', 0, 1, 0.05)}
            {slider('河流曲率', 'detailRiverCurve', 0, 1, 0.05)}
            {slider('海岸锯齿', 'detailCoastJagged', 0, 1, 0.05)}
            {slider('山脊密度', 'detailRidgeDensity', 0, 1, 0.05)}
            {slider('降雨偏移', 'detailRainfallOffset', 0, 1, 0.05)}
            {slider('温度梯度', 'detailTempGradient', 0, 1, 0.05)}
            {slider('生物群落混合', 'detailBiomeBlend', 0, 1, 0.05)}
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-white/10 space-y-2">
        <button
          onClick={generate}
          disabled={isGenerating}
          className="w-full py-2.5 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isGenerating ? T('generating') : T('generate')}
        </button>

        <div className="flex gap-2">
          <button
            onClick={resetParams}
            className="flex-1 py-2 rounded-lg bg-white/5 text-sm hover:bg-white/10 transition-colors flex items-center justify-center gap-1"
          >
            <RotateCcw size={14} />
            {T('reset')}
          </button>
          <button
            onClick={() => setShowExport(!showExport)}
            className="flex-1 py-2 rounded-lg bg-white/5 text-sm hover:bg-white/10 transition-colors flex items-center justify-center gap-1"
          >
            <Download size={14} />
            {T('export')}
          </button>
        </div>

        {showExport && (
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button onClick={() => { const c = document.querySelector('canvas'); if (c) exportPNG(c as HTMLCanvasElement, `map_${Date.now()}.png`); }} className="py-1.5 rounded bg-white/5 text-xs hover:bg-white/10">{T('exportPNG')}</button>
            <button onClick={() => { const c = document.querySelector('canvas'); if (c) exportJPEG(c as HTMLCanvasElement, `map_${Date.now()}.jpg`); }} className="py-1.5 rounded bg-white/5 text-xs hover:bg-white/10">{T('exportJPEG')}</button>
            <button onClick={() => { const c = document.querySelector('canvas'); if (c) exportWebP(c as HTMLCanvasElement, `map_${Date.now()}.webp`); }} className="py-1.5 rounded bg-white/5 text-xs hover:bg-white/10">{T('exportWebP')}</button>
            <button onClick={() => { if (mapData) exportFullJSON(mapData, `map_${Date.now()}.json`); }} className="py-1.5 rounded bg-white/5 text-xs hover:bg-white/10">{T('exportJSON')}</button>
          </div>
        )}

        {/* 保存/加载 */}
        <div className="flex gap-2">
          <button
            onClick={async () => {
              if (!mapData) return;
              try {
                const id = await saveMap({
                  name: mapState.seedStr,
                  timestamp: Date.now(),
                  params: { ...mapState },
                });
                setToast({ message: `已保存 (ID: ${id})`, type: 'success' });
              } catch (e) {
                setToast({ message: '保存失败', type: 'error' });
              }
            }}
            className="flex-1 py-2 rounded-lg bg-white/5 text-sm hover:bg-white/10 transition-colors flex items-center justify-center gap-1"
          >
            <Save size={14} />
            {T('save')}
          </button>
          <button
            onClick={async () => {
              try {
                const maps = await loadMaps();
                setSavedMaps(maps);
                setShowSaved(!showSaved);
              } catch (e) {
                setToast({ message: '加载失败', type: 'error' });
              }
            }}
            className="flex-1 py-2 rounded-lg bg-white/5 text-sm hover:bg-white/10 transition-colors flex items-center justify-center gap-1"
          >
            <FolderOpen size={14} />
            {T('load')}
          </button>
        </div>

        {showSaved && savedMaps.length > 0 && (
          <div className="max-h-32 overflow-y-auto space-y-1 pt-2">
            {savedMaps.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-2 py-1 rounded bg-white/5 text-xs">
                <span className="truncate flex-1">{m.name}</span>
                <button
                  onClick={async () => {
                    if (m.id === undefined) return;
                    await deleteMap(m.id);
                    setSavedMaps(savedMaps.filter((s) => s.id !== m.id));
                  }}
                  className="text-red-400 hover:text-red-300 ml-2"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => setTheme(theme === 'modern' ? 'classic' : 'modern')}
            className="flex-1 py-2 rounded-lg bg-white/5 text-xs hover:bg-white/10 transition-colors flex items-center justify-center gap-1"
          >
            {theme === 'modern' ? <Sun size={14} /> : <Moon size={14} />}
            {theme === 'modern' ? 'Classic' : 'Modern'}
          </button>
          <button
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            className="flex-1 py-2 rounded-lg bg-white/5 text-xs hover:bg-white/10 transition-colors flex items-center justify-center gap-1"
          >
            <Languages size={14} />
            {lang === 'zh' ? 'EN' : '中文'}
          </button>
        </div>
      </div>
    </div>
  );
}
