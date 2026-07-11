/**
 * UI ↔ 参数同步
 */
import { state, type UIParams } from '../core/appState.js';
import { setParam } from '../core/actions.js';
import { RENDER_STYLES } from '../launcher/presets.js';
import { createSvgIcon } from '../core/svgIcon.js';
import { RENDER_ONLY_KEYS } from './renderHelper.js';

type RenderFn = () => void;
type EditorControllerLike = { canUndo: boolean; canRedo: boolean } | null;

let _scheduleRender: RenderFn;
let _editor: EditorControllerLike;

export function initUiSync(scheduleRender: RenderFn, editor: EditorControllerLike): void {
  _scheduleRender = scheduleRender;
  _editor = editor;
}

function $<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function formatNum(n: number): string {
  return n.toLocaleString('zh-CN');
}

export function updateSizeInfo(): void {
  const w = state.params.mapWidth;
  const h = state.params.mapHeight;
  const info = $('size-info');
  if (info) info.textContent = `${w}×${h} · ${formatNum(w * h)} 像素`;
  const wiSize = $('wi-size');
  if (wiSize) wiSize.textContent = `${w}×${h}`;
}

export function setSliderVal(id: string, rawVal: number): void {
  const el = $<HTMLInputElement>(id);
  if (el) el.value = String(rawVal);
}

export function setDispVal(id: string, text: string): void {
  const el = $(id);
  if (el) el.textContent = text;
}

export function syncUIFromParams(): void {
  const p = state.params;
  const seedInput = $<HTMLInputElement>('seedStr');
  if (seedInput) seedInput.value = p.seedStr;
  const wInput = $<HTMLInputElement>('mapWidth');
  const hInput = $<HTMLInputElement>('mapHeight');
  if (wInput) wInput.value = String(p.mapWidth);
  if (hInput) hInput.value = String(p.mapHeight);
  updateSizeInfo();

  const noiseSel = $<HTMLSelectElement>('noiseType');
  if (noiseSel) noiseSel.value = p.noiseType;
  const fbmSel = $<HTMLSelectElement>('fbmType');
  if (fbmSel) fbmSel.value = p.fbmType;
  const styleSel = $<HTMLSelectElement>('style');
  if (styleSel) styleSel.value = String(p.style);

  setSliderVal('octaves', p.octaves);
  setDispVal('octaves-val', String(p.octaves));
  setSliderVal('lacunarity', p.lacunarity);
  setDispVal('lacunarity-val', p.lacunarity.toFixed(1));
  setSliderVal('persistence', p.persistence);
  setDispVal('persistence-val', p.persistence.toFixed(2));
  setSliderVal('plateCount', p.plateCount);
  setDispVal('plateCount-val', String(p.plateCount));
  setSliderVal('landmass', Math.round(p.landmass * 100));
  setDispVal('landmass-val', Math.round(p.landmass * 100) + '%');
  setSliderVal('mountainFold', Math.round(p.mountainFold * 100));
  setDispVal('mountainFold-val', p.mountainFold.toFixed(2));
  setSliderVal('coastDetail', Math.round(p.coastDetail * 100));
  setDispVal('coastDetail-val', p.coastDetail.toFixed(2));

  const setCheck = (id: string, val: boolean): void => {
    const el = $<HTMLInputElement>(id);
    if (el) el.checked = val;
  };
  setCheck('enableOceanCurrents', p.enableOceanCurrents);
  setCheck('enableIceSheet', p.enableIceSheet);
  setCheck('enableMonsoon', p.enableMonsoon);
  setCheck('enableContinentality', p.enableContinentality);
  setCheck('enableHadleyEnhancement', p.enableHadleyEnhancement);

  setSliderVal('seaLevel', Math.round(p.seaLevel * 100));
  setDispVal('seaLevel-val', p.seaLevel.toFixed(2));
  setSliderVal('erosionStrength', Math.round(p.erosionStrength * 100));
  setDispVal('erosionStrength-val', p.erosionStrength.toFixed(1));
  setSliderVal('erosionIterations', p.erosionIterations);
  setDispVal('erosionIterations-val', String(p.erosionIterations));
  setSliderVal('lakeDensity', Math.round(p.lakeDensity * 1000));
  setDispVal('lakeDensity-val', p.lakeDensity.toFixed(3));
  setSliderVal('tempOffset', Math.round(p.tempOffset * 100));
  setDispVal('tempOffset-val', p.tempOffset.toFixed(2));
  setSliderVal('snowLine', Math.round(p.snowLine * 100));
  setDispVal('snowLine-val', p.snowLine.toFixed(2));
  setSliderVal('rainStrength', Math.round(p.rainStrength * 100));
  setDispVal('rainStrength-val', p.rainStrength.toFixed(1));
  setSliderVal('windDirX', Math.round(p.windDirX * 100));
  setDispVal('windDirX-val', p.windDirX.toFixed(1));
  setSliderVal('windDirY', Math.round(p.windDirY * 100));
  setDispVal('windDirY-val', p.windDirY.toFixed(1));
  updateWindArrow();
  setSliderVal('riverCount', p.riverCount);
  setDispVal('riverCount-val', String(p.riverCount));

  setCheck('showBoundaries', p.showBoundaries);
  setSliderVal('boundaryWidth', Math.round(p.boundaryWidth * 10));
  setDispVal('boundaryWidth-val', p.boundaryWidth.toFixed(1));
  setCheck('showRivers', p.showRivers);
  setCheck('showContours', p.showContours);
  setCheck('showTerrain', p.showTerrain);
  setCheck('showSelection', p.showSelection);
  setCheck('showClimate', p.showClimate);

  setSliderVal('lightAngle', Math.round(p.lightAngle * 100));
  setDispVal('lightAngle-val', p.lightAngle.toFixed(2));
  setCheck('pointLightEnabled', p.pointLightEnabled);
  setCheck('glowEnabled', p.glowEnabled);
  setCheck('laserActive', p.laserActive);
  setCheck('laserSelection', p.laserSelection);
  setSliderVal('laserWidth', Math.round(p.laserWidth * 1000));
  setDispVal('laserWidth-val', p.laserWidth.toFixed(3));
  setCheck('cursorActive', p.cursorActive);
  setCheck('trailEnabled', p.trailEnabled);

  setSliderVal('brushRadius', 14);
  setDispVal('brushRadius-val', '14');
  setSliderVal('brushStrength', 30);
  setDispVal('brushStrength-val', '0.3');

  const wiSeed = $('wi-seed');
  if (wiSeed) wiSeed.textContent = p.seedStr;

  updateStyleDots();
  updateUndoRedo();
}

export function updateWindArrow(): void {
  const arrow = $('wind-arrow');
  if (!arrow) return;
  const dx = state.params.windDirX;
  const dy = state.params.windDirY;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
  arrow.style.transform = `translate(-50%, -100%) rotate(${angle}deg)`;
}

export function updateStyleDots(): void {
  const container = $('style-dots');
  if (!container) return;
  container.innerHTML = '';
  const styles = RENDER_STYLES.slice(0, 6);
  styles.forEach(s => {
    const dot = document.createElement('button');
    dot.className = 'sd' + (s.style === state.params.style ? ' active' : '');
    dot.appendChild(createSvgIcon(s.icon, 16));
    dot.title = s.name;
    dot.addEventListener('click', () => {
      setParam('style', s.style);
      const sel = $<HTMLSelectElement>('style');
      if (sel) sel.value = String(s.style);
      updateStyleDots();
      _scheduleRender();
    });
    container.appendChild(dot);
  });
}

export function updateUndoRedo(): void {
  const undoBtn = $<HTMLButtonElement>('btn-undo');
  const redoBtn = $<HTMLButtonElement>('btn-redo');
  if (undoBtn) undoBtn.disabled = !(_editor?.canUndo ?? false);
  if (redoBtn) redoBtn.disabled = !(_editor?.canRedo ?? false);
}

export function applyZoom(): void {
  _scheduleRender();
}

export function isRenderOnlyParam(paramKey: string): boolean {
  return RENDER_ONLY_KEYS.has(paramKey);
}
