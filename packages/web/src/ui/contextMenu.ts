import { bus } from '../core/eventBus.js';

export class ContextMenu {
  private menu: HTMLElement | null = null;
  private unsub: (() => void)[] = [];

  bind(): void {
    this.unsub.push(
      bus.on('map.contextmenu', ({ x, y }: { x: number; y: number }) => this.show(x, y))
    );

    const close = () => this.hide();
    document.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    this.unsub.push(
      () => document.removeEventListener('click', close),
      () => document.removeEventListener('keydown', close)
    );
  }

  private show(x: number, y: number): void {
    this.hide();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    const items: [string, () => void][] = [
      ['仅重算河流', () => bus.emit('regenerate.phase', 'rivers')],
      ['仅重算气候', () => bus.emit('regenerate.phase', 'climate')],
      ['仅重算侵蚀', () => bus.emit('regenerate.phase', 'erosion')],
      ['保留板块重算高程', () => bus.emit('regenerate.phase', 'elevation')],
      ['清空选择', () => bus.emit('selection.clear')],
    ];

    for (const [label, action] of items) {
      const item = document.createElement('div');
      item.className = 'context-menu-item';
      item.textContent = label;
      item.addEventListener('click', (e) => {
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
