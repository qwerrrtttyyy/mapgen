import { Colleague } from '../core/mediator.js';
import { bus } from '../core/eventBus.js';

export class ContextMenu extends Colleague {
  private menu: HTMLElement | null = null;
  private unsub: (() => void)[] = [];
  private clickHandler!: () => void;
  private keyHandler!: (e: KeyboardEvent) => void;

  constructor() {
    super('contextMenu');
  }

  bind(): void {
    if (this.mediator) {
      this.unsub.push(
        this.subscribe('map.contextmenu', ({ x, y }: { x: number; y: number }) => this.show(x, y))
      );
    } else {
      this.unsub.push(
        bus.on('map.contextmenu', ({ x, y }: { x: number; y: number }) => this.show(x, y))
      );
    }

    this.clickHandler = () => this.hide();
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.hide();
    };
    document.addEventListener('click', this.clickHandler);
    document.addEventListener('keydown', this.keyHandler);
    this.unsub.push(
      () => document.removeEventListener('click', this.clickHandler),
      () => document.removeEventListener('keydown', this.keyHandler)
    );
  }

  private show(x: number, y: number): void {
    this.hide();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const emit = (event: string, payload?: unknown): void => {
      if (this.mediator) {
        this.send(event as never, payload as never);
      } else {
        bus.emit(event, payload);
      }
    };

    const items: [string, () => void][] = [
      ['仅重算河流', () => emit('regenerate.phase', 'rivers')],
      ['仅重算气候', () => emit('regenerate.phase', 'climate')],
      ['仅重算侵蚀', () => emit('regenerate.phase', 'erosion')],
      ['保留板块重算高程', () => emit('regenerate.phase', 'elevation')],
      ['清空选择', () => emit('selection.clear')],
    ];

    for (const [label, action] of items) {
      const item = document.createElement('div');
      item.className = 'context-menu-item';
      item.textContent = label;
      item.addEventListener('click', e => {
        e.stopPropagation();
        action();
        this.hide();
      });
      menu.appendChild(item);
    }

    document.body.appendChild(menu);
    this.menu = menu;

    const rect = menu.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) menu.style.left = `${x - rect.width}px`;
    if (y + rect.height > window.innerHeight) menu.style.top = `${y - rect.height}px`;
  }

  private hide(): void {
    if (this.menu) {
      this.menu.remove();
      this.menu = null;
    }
  }

  destroy(): void {
    this.hide();
    this.unsub.forEach(u => u());
    this.unsub = [];
  }
}
