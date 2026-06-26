const SKIP_KEY = 'mapgen:skipLauncher';

export interface LauncherOptions {
  title?: string;
  version?: string;
  onSkipChange?: (skip: boolean) => void;
}

export class Launcher {
  private root: HTMLElement;
  private progressBar: HTMLElement;
  private progressText: HTMLElement;
  private skipBox: HTMLInputElement;
  private content: HTMLElement;
  private resolveHide: (() => void) | null = null;
  private hidden = false;

  constructor(container: HTMLElement, private options: LauncherOptions = {}) {
    this.root = document.createElement('div');
    this.root.id = 'launcher-overlay';
    this.root.className = 'launcher-overlay';
    this.root.innerHTML = `
      <div class="launcher-content">
        <div class="launcher-logo">
          <div class="launcher-icon">🗺️</div>
          <h1 class="launcher-title">${options.title ?? 'Material Map Generator'}</h1>
          <div class="launcher-version">${options.version ?? ''}</div>
        </div>
        <div class="launcher-progress-area">
          <div class="launcher-progress-ring">
            <svg viewBox="0 0 40 40">
              <circle class="launcher-progress-track" cx="20" cy="20" r="16"></circle>
              <circle class="launcher-progress-indicator" cx="20" cy="20" r="16"></circle>
            </svg>
          </div>
          <div class="launcher-progress-text">初始化...</div>
          <div class="launcher-progress-bar-track">
            <div class="launcher-progress-bar"></div>
          </div>
        </div>
        <label class="launcher-skip">
          <input type="checkbox" id="launcher-skip">
          <span>下次不再显示启动画面</span>
        </label>
      </div>
    `;
    container.insertBefore(this.root, container.firstChild);

    this.content = this.root.querySelector('.launcher-content') as HTMLElement;
    this.progressBar = this.root.querySelector('.launcher-progress-bar') as HTMLElement;
    this.progressText = this.root.querySelector('.launcher-progress-text') as HTMLElement;
    this.skipBox = this.root.querySelector('#launcher-skip') as HTMLInputElement;

    this.skipBox.addEventListener('change', () => {
      localStorage.setItem(SKIP_KEY, this.skipBox.checked ? '1' : '0');
      options.onSkipChange?.(this.skipBox.checked);
    });
  }

  static shouldShow(): boolean {
    return localStorage.getItem(SKIP_KEY) !== '1';
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

  async show(duration = 600): Promise<void> {
    this.root.classList.add('launcher-visible');
    this.content.classList.add('launcher-enter');
    await new Promise(r => setTimeout(r, duration));
    this.content.classList.remove('launcher-enter');
  }

  async hide(duration = 500): Promise<void> {
    if (this.hidden) return;
    this.hidden = true;
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

  destroy(): void {
    this.root.remove();
  }
}
