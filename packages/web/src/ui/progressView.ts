import { Colleague } from '../core/mediator.js';
import { bus } from '../core/eventBus.js';

export class ProgressView extends Colleague {
  private container: HTMLElement | null;
  private bar: HTMLElement | null;
  private text: HTMLElement | null;
  private unsub: (() => void)[] = [];
  private errorTimer: number | null = null;

  constructor() {
    super('progressView');
    this.container = document.getElementById('progress-container');
    this.bar = document.getElementById('progress-bar');
    this.text = document.getElementById('progress-text');
  }

  bind(): void {
    if (this.mediator) {
      this.bindWithMediator();
    } else {
      this.bindWithBus();
    }
  }

  private bindWithMediator(): void {
    this.unsub.push(
      this.subscribe('generating.started', () => {
        this.clearErrorTimer();
        this.show('初始化...');
      }),
      this.subscribe('generating.completed', () => {
        this.clearErrorTimer();
        this.hide();
      }),
      this.subscribe('generating.failed', (msg: string) => {
        this.show('生成失败: ' + msg);
        this.clearErrorTimer();
        this.errorTimer = window.setTimeout(() => this.hide(), 5000);
      }),
      this.subscribe('progress', ({ fraction, label }) => {
        this.set(fraction, label);
      }),
      this.subscribe('generate.request', () => this.clearErrorTimer())
    );
  }

  private bindWithBus(): void {
    this.unsub.push(
      bus.on('generating.started', () => {
        this.clearErrorTimer();
        this.show('初始化...');
      }),
      bus.on('generating.completed', () => {
        this.clearErrorTimer();
        this.hide();
      }),
      bus.on('generating.failed', (msg: string) => {
        this.show('生成失败: ' + msg);
        this.clearErrorTimer();
        this.errorTimer = window.setTimeout(() => this.hide(), 5000);
      }),
      bus.on('progress', ({ fraction, label }: { fraction: number; label: string }) => {
        this.set(fraction, label);
      }),
      bus.on('generate.request', () => this.clearErrorTimer())
    );
  }

  destroy(): void {
    this.clearErrorTimer();
    this.unsub.forEach(u => u());
    this.unsub = [];
  }

  private clearErrorTimer(): void {
    if (this.errorTimer !== null) {
      window.clearTimeout(this.errorTimer);
      this.errorTimer = null;
    }
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
