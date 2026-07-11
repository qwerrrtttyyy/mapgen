/**
 * 预设卡片网格
 */
import { state, patchParams, type UIParams } from '../core/appState.js';
import { PRESET_GROUPS, findPreset } from '../launcher/presets.js';
import { createSvgIcon } from '../core/svgIcon.js';

type SyncUIFn = () => void;
type GenerateFn = () => void;

let _syncUI: SyncUIFn;
let _generate: GenerateFn;

export function initPresetGrid(syncUI: SyncUIFn, generate: GenerateFn): void {
  _syncUI = syncUI;
  _generate = generate;
}

export function buildPresetGrid(): void {
  const grid = document.getElementById('preset-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const themeGroup = PRESET_GROUPS.find(g => g.category === 'theme');
  if (!themeGroup) return;

  themeGroup.presets.forEach(preset => {
    const card = document.createElement('button');
    card.className = 'preset-card' + (state.currentPreset === preset.id ? ' active' : '');
    const iconWrap = document.createElement('span');
    iconWrap.className = 'preset-icon';
    iconWrap.appendChild(createSvgIcon(preset.icon, 24));
    const nameEl = document.createElement('span');
    nameEl.className = 'preset-name';
    nameEl.textContent = preset.name;
    const descEl = document.createElement('span');
    descEl.className = 'preset-desc';
    descEl.textContent = preset.description;
    card.appendChild(iconWrap);
    card.appendChild(nameEl);
    card.appendChild(descEl);
    card.addEventListener('click', () => applyPreset(preset.id));
    grid.appendChild(card);
  });
}

export function applyPreset(presetId: string): void {
  const preset = findPreset(presetId);
  if (!preset) return;
  state.currentPreset = presetId;
  const updates: Partial<UIParams> = {};
  for (const [k, v] of Object.entries(preset.params)) {
    if (k === 'noiseType' || k === 'fbmType') {
      (updates as Record<string, unknown>)[k] = v;
    } else if (typeof v === 'number') {
      (updates as Record<string, number>)[k] = v;
    } else if (typeof v === 'boolean') {
      (updates as Record<string, boolean>)[k] = v;
    }
  }
  patchParams(updates);
  _syncUI();
  buildPresetGrid();
  _generate();
}
