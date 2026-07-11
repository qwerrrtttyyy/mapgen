/**
 * 渲染参数映射与渲染调度
 */
import type { RenderParams } from '../renderer/renderParams.js';
import type { UIParams } from '../core/appState.js';
import { state } from '../core/appState.js';

/** UI 参数名 → WebGL uniform 名映射 */
export const RENDER_PARAM_MAP: Record<string, string> = {
  style: 'u_style',
  seaLevel: 'u_seaLevel',
  lightAngle: 'u_lightAngle',
  showBoundaries: 'u_showBoundaries',
  boundaryWidth: 'u_boundaryWidth',
  boundaryColor: 'u_boundaryColor',
  showRivers: 'u_showRivers',
  showContours: 'u_showContours',
  contourInterval: 'u_contourInterval',
  showTerrain: 'u_showTerrain',
  showSelection: 'u_showSelection',
  showClimate: 'u_showClimate',
  pointLightEnabled: 'u_pointLightEnabled',
  pointLightPos: 'u_pointLightPos',
  pointLightIntensity: 'u_pointLightIntensity',
  pointLightColor: 'u_pointLightColor',
  glowEnabled: 'u_glowEnabled',
  laserActive: 'u_laserActive',
  laserStart: 'u_laserStart',
  laserEnd: 'u_laserEnd',
  laserWidth: 'u_laserWidth',
  laserSelection: 'u_laserSelection',
  laserColor: 'u_laserColor',
  trailEnabled: 'u_hasTrail',
  cursorActive: 'u_cursorActive',
  cursorPos: 'u_cursorPos',
  cursorSize: 'u_cursorSize',
  snowLine: 'u_snowLine',
  erosionStrength: 'u_erosionStrength',
  octaves: 'u_fbmOctaves',
  lacunarity: 'u_fbmLacunarity',
  persistence: 'u_fbmPersistence',
  plateCount: 'u_plateTotal',
};

/** 仅触发渲染、不触发重新生成的参数 key */
export const RENDER_ONLY_KEYS = new Set([
  'style',
  'showBoundaries',
  'boundaryWidth',
  'showRivers',
  'showContours',
  'showTerrain',
  'showSelection',
  'showClimate',
  'lightAngle',
  'pointLightEnabled',
  'glowEnabled',
  'cursorSize',
]);

export function buildRenderParams(): RenderParams {
  const rp: RenderParams = {};
  for (const [jsKey, uname] of Object.entries(RENDER_PARAM_MAP)) {
    const key = jsKey as keyof UIParams;
    const val = state.params[key];
    if (typeof val === 'number' || typeof val === 'boolean' || Array.isArray(val)) {
      (rp as Record<string, number | boolean | number[]>)[uname] = val;
    }
  }
  rp.u_zoom = state.zoom;
  rp.u_pan = [state.panX, state.panY];
  return rp;
}
