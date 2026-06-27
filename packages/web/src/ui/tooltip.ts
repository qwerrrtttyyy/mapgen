export class Tooltip {
  private el: HTMLElement;
  private pinned = false;

  constructor(container: HTMLElement = document.body) {
    this.el = document.createElement('div');
    this.el.className = 'map-tooltip';
    this.el.style.display = 'none';
    container.appendChild(this.el);
  }

  show(lines: string[], x: number, y: number): void {
    if (this.pinned) return;
    this.el.replaceChildren();
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) this.el.appendChild(document.createElement('br'));
      const span = document.createElement('span');
      span.textContent = lines[i];
      this.el.appendChild(span);
    }
    this.el.style.display = 'block';
    this.position(x, y);
  }

  move(x: number, y: number): void {
    if (this.pinned) return;
    this.position(x, y);
  }

  hide(): void {
    if (this.pinned) return;
    this.el.style.display = 'none';
  }

  pin(lines: string[], x: number, y: number): void {
    this.pinned = true;
    this.el.replaceChildren();
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) this.el.appendChild(document.createElement('br'));
      const span = document.createElement('span');
      span.textContent = lines[i];
      this.el.appendChild(span);
    }
    const hint = document.createElement('div');
    hint.className = 'map-tooltip-hint';
    hint.textContent = '再次点击取消固定';
    this.el.appendChild(hint);
    this.el.style.display = 'block';
    this.position(x, y);
  }

  unpin(): void {
    this.pinned = false;
    this.el.style.display = 'none';
  }

  togglePin(lines: string[], x: number, y: number): void {
    if (this.pinned) this.unpin();
    else this.pin(lines, x, y);
  }

  isPinned(): boolean {
    return this.pinned;
  }

  private position(x: number, y: number): void {
    const rect = this.el.getBoundingClientRect();
    const pad = 12;
    let left = x + pad;
    let top = y + pad;
    if (left + rect.width > window.innerWidth) left = x - rect.width - pad;
    if (top + rect.height > window.innerHeight) top = y - rect.height - pad;
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
  }

  destroy(): void {
    this.el.remove();
  }
}
