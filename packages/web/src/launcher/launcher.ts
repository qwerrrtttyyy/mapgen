import type { UIParams } from '../core/appState.js';
import { patchParams, state } from '../core/appState.js';
import { bus } from '../core/eventBus.js';
import { findPreset, defaultSelection, PRESET_GROUPS, type PresetCategory, type PresetId } from './presets.js';

const SKIP_KEY = 'mapgen:skipLauncher';
const SELECTION_KEY = 'mapgen:launcherSelection';
const RECENT_SEEDS_KEY = 'mapgen:recentSeeds';
const MAX_RECENT_SEEDS = 5;

export interface LauncherOptions {
  title?: string;
  version?: string;
  onSkipChange?: (skip: boolean) => void;
}

export interface LaunchResult {
  params: UIParams;
  selection: Record<PresetCategory, PresetId>;
  start: () => void;
}

export class Launcher {
  private root: HTMLElement;
  private progressBar: HTMLElement;
  private progressText: HTMLElement;
  private skipBox: HTMLInputElement;
  private content: HTMLElement;
  private startBtn: HTMLButtonElement;
  private resolveHide: (() => void) | null = null;
  private resolveLaunch: ((result: LaunchResult) => void) | null = null;
  private hidden = false;
  private selection: Record<PresetCategory, PresetId> = this.loadSelection();

  constructor(container: HTMLElement, private options: LauncherOptions = {}) {
    this.root = document.createElement('div');
    this.root.id = 'launcher-overlay';
    this.root.className = 'launcher-overlay';
    // 此处为受信任的静态内容：title/version 是调用方传入的代码常量，
    // 不含用户输入。动态文案均通过 textContent 单独设置，避免 innerHTML 注入。
    this.root.innerHTML = `
      <div class="launcher-content launcher-interactive">
        <div class="launcher-header">
          <div class="launcher-logo">
            <div class="launcher-icon">🗺️</div>
            <h1 class="launcher-title"></h1>
            <div class="launcher-version"></div>
          </div>
        </div>

        <div class="launcher-body">
          <div class="launcher-presets" id="launcher-presets"></div>
          <div class="launcher-side">
            <div class="launcher-options" id="launcher-options"></div>
          </div>
        </div>

        <div class="launcher-footer">
          <div class="launcher-progress-area">
            <div class="launcher-progress-ring">
              <svg viewBox="0 0 40 40">
                <circle class="launcher-progress-track" cx="20" cy="20" r="16"></circle>
                <circle class="launcher-progress-indicator" cx="20" cy="20" r="16"></circle>
              </svg>
            </div>
            <div class="launcher-progress-text">准备启动…</div>
            <div class="launcher-progress-bar-track">
              <div class="launcher-progress-bar"></div>
            </div>
          </div>
          <div class="launcher-actions">
            <label class="launcher-skip">
              <input type="checkbox" id="launcher-skip">
              <span>不再显示启动器</span>
            </label>
            <button class="btn btn-primary launcher-start" id="launcher-start" type="button">启动</button>
          </div>
        </div>
      </div>
    `;
    container.insertBefore(this.root, container.firstChild);

    // 受信任文案通过 textContent 设置（XSS 安全），不参与 innerHTML 拼接。
    (this.root.querySelector('.launcher-title') as HTMLElement).textContent =
      options.title ?? 'Material Map Generator';
    (this.root.querySelector('.launcher-version') as HTMLElement).textContent =
      options.version ?? '';

    this.content = this.root.querySelector('.launcher-content') as HTMLElement;
    this.progressBar = this.root.querySelector('.launcher-progress-bar') as HTMLElement;
    this.progressText = this.root.querySelector('.launcher-progress-text') as HTMLElement;
    this.skipBox = this.root.querySelector('#launcher-skip') as HTMLInputElement;
    this.startBtn = this.root.querySelector('#launcher-start') as HTMLButtonElement;

    this.skipBox.addEventListener('change', () => {
      localStorage.setItem(SKIP_KEY, this.skipBox.checked ? '1' : '0');
      options.onSkipChange?.(this.skipBox.checked);
    });

    this.renderPresets();
    this.renderOptions();

    this.startBtn.addEventListener('click', () => this.launch());
  }

  static shouldShow(): boolean {
    return localStorage.getItem(SKIP_KEY) !== '1';
  }

  static setSkip(skip: boolean): void {
    localStorage.setItem(SKIP_KEY, skip ? '1' : '0');
  }

  private loadSelection(): Record<PresetCategory, PresetId> {
    const fallback = defaultSelection();
    try {
      const raw = localStorage.getItem(SELECTION_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as Record<string, string>;
      return {
        theme: findPreset(parsed.theme ?? '') ? parsed.theme! : fallback.theme,
        mode: findPreset(parsed.mode ?? '') ? parsed.mode! : fallback.mode,
        type: findPreset(parsed.type ?? '') ? parsed.type! : fallback.type,
      };
    } catch {
      return fallback;
    }
  }

  private saveSelection(): void {
    try {
      localStorage.setItem(SELECTION_KEY, JSON.stringify(this.selection));
    } catch {
      /* ignore quota errors */
    }
  }

  private renderPresets(): void {
    const root = this.root.querySelector('#launcher-presets') as HTMLElement;
    root.innerHTML = '';
    for (const group of PRESET_GROUPS) {
      const section = document.createElement('div');
      section.className = 'launcher-preset-group';
      const title = document.createElement('div');
      title.className = 'launcher-preset-title';
      title.textContent = group.label;
      section.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'launcher-preset-grid';
      for (const preset of group.presets) {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'launcher-preset-tile';
        tile.dataset.presetId = preset.id;
        tile.dataset.category = preset.category;
        tile.title = preset.description;
        if (this.selection[preset.category] === preset.id) tile.classList.add('active');
        tile.replaceChildren();
        const icon = document.createElement('div');
        icon.className = 'launcher-preset-icon';
        icon.textContent = preset.icon;
        const name = document.createElement('div');
        name.className = 'launcher-preset-name';
        name.textContent = preset.name;
        const desc = document.createElement('div');
        desc.className = 'launcher-preset-desc';
        desc.textContent = preset.description;
        tile.append(icon, name, desc);
        tile.addEventListener('click', () => {
          this.selection[preset.category] = preset.id;
          this.saveSelection();
          this.renderPresets();
          this.applySelection();
        });
        grid.appendChild(tile);
      }
      section.appendChild(grid);
      root.appendChild(section);
    }
  }

  private renderOptions(): void {
    const root = this.root.querySelector('#launcher-options') as HTMLElement;
    root.replaceChildren();

    const title = document.createElement('div');
    title.className = 'launcher-options-title';
    title.textContent = '基础设置';
    root.appendChild(title);

    // 地图大小
    const mapSizeField = document.createElement('div');
    mapSizeField.className = 'md-field';
    const mapSizeLabel = document.createElement('label');
    mapSizeLabel.textContent = '地图大小';
    const mapSize = document.createElement('select');
    mapSize.id = 'launcher-mapSize';
    for (const v of ['128', '192', '256', '384', '512']) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      if (v === '256') opt.selected = true;
      mapSize.appendChild(opt);
    }
    mapSizeField.append(mapSizeLabel, mapSize);

    // 宽高比
    const mapAspectField = document.createElement('div');
    mapAspectField.className = 'md-field';
    const mapAspectLabel = document.createElement('label');
    mapAspectLabel.textContent = '宽高比';
    const mapAspect = document.createElement('select');
    mapAspect.id = 'launcher-mapAspect';
    for (const v of ['1:1', '4:3', '16:9', '2:1', '3:2']) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      if (v === '1:1') opt.selected = true;
      mapAspect.appendChild(opt);
    }
    mapAspectField.append(mapAspectLabel, mapAspect);

    // 种子
    const seedField = document.createElement('div');
    seedField.className = 'md-field';
    const seedLabel = document.createElement('label');
    seedLabel.textContent = '种子';
    const btnRow = document.createElement('div');
    btnRow.className = 'btn-row';
    const seed = document.createElement('input');
    seed.type = 'text';
    seed.id = 'launcher-seed';
    seed.placeholder = '留空则随机';
    const randomBtn = document.createElement('button');
    randomBtn.type = 'button';
    randomBtn.className = 'btn btn-secondary';
    randomBtn.id = 'launcher-random-seed';
    randomBtn.textContent = '随机';
    btnRow.append(seed, randomBtn);
    seedField.append(seedLabel, btnRow);

    root.append(mapSizeField, mapAspectField, seedField);

    // 最近种子
    const recent = loadRecentSeeds();
    if (recent.length > 0) {
      const recentWrap = document.createElement('div');
      recentWrap.className = 'launcher-recent-seeds';
      const recentLabel = document.createElement('div');
      recentLabel.className = 'launcher-recent-label';
      recentLabel.textContent = '最近种子';
      const recentList = document.createElement('div');
      recentList.className = 'launcher-recent-list';
      for (const s of recent) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-secondary launcher-recent-seed';
        btn.textContent = s;
        btn.addEventListener('click', () => {
          seed.value = s;
          patchParams({ seedStr: s });
        });
        recentList.appendChild(btn);
      }
      recentWrap.append(recentLabel, recentList);
      root.appendChild(recentWrap);
    }

    seed.value = state.params.seedStr;
    seed.addEventListener('input', () => {
      const v = seed.value.trim();
      if (v) patchParams({ seedStr: v });
    });

    mapSize.value = String(state.params.mapSize);
    mapSize.addEventListener('change', () => {
      patchParams({ mapSize: parseInt(mapSize.value, 10) });
    });

    mapAspect.value = state.params.mapAspect;
    mapAspect.addEventListener('change', () => {
      patchParams({ mapAspect: mapAspect.value });
    });

    randomBtn.addEventListener('click', () => {
      const newSeed = String(Math.floor(Math.random() * 99999));
      seed.value = newSeed;
      patchParams({ seedStr: newSeed });
    });
  }

  private applySelection(): void {
    for (const cat of Object.keys(this.selection) as PresetCategory[]) {
      const p = findPreset(this.selection[cat]);
      if (!p) continue;
      for (const [k, v] of Object.entries(p.params)) {
        if (k in state.params) {
          patchParams({ [k]: v } as Partial<UIParams>);
        }
      }
    }
    bus.emit('render.request');
  }

  setProgress(value: number, text?: string): void {
    const pct = Math.max(0, Math.min(1, value));
    this.progressBar.style.width = `${pct * 100}%`;
    const indicator = this.root.querySelector('.launcher-progress-indicator') as SVGCircleElement | null;
    if (indicator) {
      const circumference = 2 * Math.PI * 16;
      indicator.style.strokeDasharray = `${circumference}`;
      indicator.style.strokeDashoffset = `${circumference * (1 - pct)}`;
    }
    if (text) this.progressText.textContent = text;
  }

  setText(text: string): void {
    this.progressText.textContent = text;
  }

  async show(duration = 400): Promise<void> {
    this.root.classList.add('launcher-visible');
    this.content.classList.add('launcher-enter');
    await new Promise(r => setTimeout(r, duration));
    // 锁定动画终态：移除动画类后用 inline style 保持 opacity:1 / transform:none，
    // 否则 .launcher-content 默认 opacity:0 会导致内容重新不可见（黑屏）
    this.content.classList.remove('launcher-enter');
    this.content.style.opacity = '1';
    this.content.style.transform = 'none';
  }

  async hide(duration = 400): Promise<void> {
    if (this.hidden) return;
    this.hidden = true;
    // 清除 show() 锁定的 inline style，让退出动画的 opacity:0 生效
    this.content.style.opacity = '';
    this.content.style.transform = '';
    this.content.classList.add('launcher-exit');
    await new Promise(r => setTimeout(r, duration * 0.6));
    this.root.classList.add('launcher-fade-out');
    await new Promise(r => setTimeout(r, duration * 0.4));
    this.root.style.display = 'none';
    this.resolveHide?.();
  }

  waitForHide(): Promise<void> {
    if (this.hidden) return Promise.resolve();
    return new Promise(r => { this.resolveHide = r; });
  }

  waitForLaunch(): Promise<LaunchResult> {
    if (this.resolveLaunch) {
      return new Promise((_, reject) => reject(new Error('Launcher already running')));
    }
    return new Promise(r => { this.resolveLaunch = r; });
  }

  private launch(): void {
    this.applySelection();
    this.saveSelection();
    saveRecentSeed(state.params.seedStr);
    this.startBtn.disabled = true;
    this.startBtn.textContent = '启动中…';
    const result: LaunchResult = {
      params: { ...state.params },
      selection: { ...this.selection },
      start: () => bus.emit('generate.request'),
    };
    this.resolveLaunch?.(result);
    this.resolveLaunch = null;
  }

  destroy(): void {
    this.root.remove();
  }
}

// 最近种子辅助函数（独立导出以便单元测试）。

export function loadRecentSeeds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEEDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s): s is string => typeof s === 'string')
      .slice(0, MAX_RECENT_SEEDS);
  } catch {
    return [];
  }
}

export function saveRecentSeed(seed: string): void {
  if (!seed) return;
  try {
    const current = loadRecentSeeds();
    const filtered = current.filter(s => s !== seed);
    filtered.unshift(seed);
    const trimmed = filtered.slice(0, MAX_RECENT_SEEDS);
    localStorage.setItem(RECENT_SEEDS_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore quota errors */
  }
}
