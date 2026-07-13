import { Colleague } from '../core/mediator.js';
import { bus } from '../core/eventBus.js';
import { clearSelection, setParam } from '../core/actions.js';

export class Shortcuts extends Colleague {
  private unsub: (() => void)[] = [];

  constructor() {
    super('shortcuts');
  }

  bind(): void {
    const handler = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      )
        return;

      switch (e.key.toLowerCase()) {
        case 'g':
          e.preventDefault();
          this.emit('generate.request');
          break;
        case 'r':
          if (e.ctrlKey || e.metaKey) return;
          e.preventDefault();
          this.emit('randomSeed.request');
          break;
        case 's':
          if (e.ctrlKey || e.metaKey) return;
          e.preventDefault();
          this.emit('checkpoint.save.request');
          break;
        case 'e':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.emit('export.dialog.open');
          } else {
            e.preventDefault();
            this.emit('export.request');
          }
          break;
        case 'l':
          e.preventDefault();
          this.emit('laser.toggle');
          break;
        case 'f3':
          e.preventDefault();
          this.emit('debug.toggle');
          break;
        case 'escape':
          e.preventDefault();
          clearSelection();
          this.closeDrawer();
          break;
      }

      if (e.key >= '1' && e.key <= '9') {
        const style = parseInt(e.key, 10) - 1;
        setParam('style', style);
        const el = document.getElementById('style') as HTMLSelectElement | null;
        if (el) el.value = String(style);
        this.emit('render.request');
      }
    };

    document.addEventListener('keydown', handler);
    this.unsub.push(() => document.removeEventListener('keydown', handler));
  }

  private emit(event: string, payload?: unknown): void {
    if (this.mediator) {
      this.send(event as never, payload as never);
    } else {
      bus.emit(event, payload);
    }
  }

  private closeDrawer(): void {
    const panel = document.getElementById('panel');
    panel?.classList.remove('panel-open');
    panel?.classList.add('panel-closed');
  }

  destroy(): void {
    this.unsub.forEach(u => u());
    this.unsub = [];
  }
}
