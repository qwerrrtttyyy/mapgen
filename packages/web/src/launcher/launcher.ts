import type { UIParams } from '../core/appState.js';
import { patchParams, state } from '../core/appState.js';
import { bus } from '../core/eventBus.js';
import { findPreset, defaultSelection, PRESET_GROUPS, type PresetCategory, type PresetId } from './presets.js';

const SKIP_KEY = 'mapgen:skipLauncher';
const SELECTION_KEY = 'mapgen:launcherSelection';

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
    this.root.innerHTML = `
      <div class="launcher-content launcher-interactive">
        <div class="launcher-header">
          <div class="launcher-logo">
            <div class="launcher-icon">🗺️</div>
            <h1 class="launcher-title">${options.title ?? 'Material Map Generator'}</h1>
            <div class="launcher-version">${options.version ?? ''}</div>
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
    return false;
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
        tile.innerHTML = `
          <div class="launcher-preset-icon">${preset.icon}</div>
          <div class="launcher-preset-name">${preset.name}</div>
          <div class="launcher-preset-desc">${preset.description}</div>
        `;
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
    root.innerHTML = `
      <div class="launcher-options-title">基础设置</div>
      <div class="md-field">
        <label>地图大小</label>
        <select id="launcher-mapSize">
          <option value="128">128</option>
          <option value="192">192</option>
          <option value="256" selected>256</option>
          <option value="384">384</option>
          <option value="512">512</option>
        </select>
      </div>
      <div class="md-field">
        <label>宽高比</label>
        <select id="launcher-mapAspect">
          <option value="1:1" selected>1:1</option>
          <option value="4:3">4:3</option>
          <option value="16:9">16:9</option>
          <option value="2:1">2:1</option>
          <option value="3:2">3:2</option>
        </select>
      </div>
      <div class="md-field">
        <label>种子</label>
        <div class="btn-row">
          <input type="text" id="launcher-seed" placeholder="留空则随机" />
          <button class="btn btn-secondary" id="launcher-random-seed" type="button">随机</button>
        </div>
      </div>
    `;

    const seed = root.querySelector('#launcher-seed') as HTMLInputElement;
    seed.value = state.params.seedStr;
    seed.addEventListener('input', () => {
      const v = seed.value.trim();
      if (v) patchParams({ seedStr: v });
    });

    // const mapSize = root.querySelector('#launcher-mapSize') as HTMLSelectElement;
    // mapSize.value = String(state.params.mapWidth);
    // mapSize.addEventListener('change', () => {
    //   patchParams({ mapWidth: parseInt(mapSize.value, 10), mapHeight: parseInt(mapSize.value, 10) });
    // });

    // const mapAspect = root.querySelector('#launcher-mapAspect') as HTMLSelectElement;
    // mapAspect.value = '1:1';
    // mapAspect.addEventListener('change', () => {
    // });

    const randomBtn = root.querySelector('#launcher-random-seed') as HTMLButtonElement;
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
