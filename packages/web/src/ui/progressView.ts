import { bus } from '../core/eventBus.js';

export class ProgressView {
  private container: HTMLElement | null;
  private bar: HTMLElement | null;
  private text: HTMLElement | null;
  private unsub: (() => void)[] = [];

  constructor() {
    this.container = document.getElementById('progress-container');
    this.bar = document.getElementById('progress-bar');
    this.text = document.getElementById('progress-text');
  }

  bind(): void {
    this.unsub.push(
      bus.on('generating.started', () => this.show('初始化...')),
      bus.on('generating.completed', () => this.hide()),
      bus.on('generating.failed', (msg: string) => this.show('生成失败: ' + msg)),
      bus.on('progress', ({ fraction, label }: { fraction: number; label: string }) => {
        this.set(fraction, label);
      })
    );
  }

  destroy(): void {
    this.unsub.forEach(u => u());
    this.unsub = [];
  }

  private show(text = ''): void {
    if (this.container) this.container.style.display = 'block';
    if (this.bar) {
      this.bar.style.width = '0%';
      this.bar.classList.add('indeterminate');
      this.bar.classList.remove('pulse');
    }
    if (this.text && text) this.text.textContent = text;
  }

  private hide(): void {
    if (this.bar) {
      this.bar.classList.remove('indeterminate');
      this.bar.classList.add('pulse');
      window.setTimeout(() => this.bar?.classList.remove('pulse'), 500);
    }
    if (this.container) {
      window.setTimeout(() => {
        if (this.container) this.container.style.display = 'none';
      }, 200);
    }
  }

  private set(fraction: number, label: string): void {
    if (this.bar) {
      this.bar.classList.remove('indeterminate');
      this.bar.style.width = `${fraction * 100}%`;
    }
    if (this.text) this.text.textContent = label;
  }
}
