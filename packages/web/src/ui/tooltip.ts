export class Tooltip {
  private el: HTMLElement;
  private pinned = false;

  constructor(container: HTMLElement = document.body) {
    this.el = document.createElement('div');
    this.el.className = 'map-tooltip';
    this.el.style.display = 'none';
    container.appendChild(this.el);
  }

  show(html: string, x: number, y: number): void {
    if (this.pinned) return;
    this.el.innerHTML = html;
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

  pin(html: string, x: number, y: number): void {
    this.pinned = true;
    this.el.innerHTML = html + '<div class="map-tooltip-hint">再次点击取消固定</div>';
    this.el.style.display = 'block';
    this.position(x, y);
  }

  unpin(): void {
    this.pinned = false;
    this.el.style.display = 'none';
  }

  togglePin(html: string, x: number, y: number): void {
    if (this.pinned) this.unpin();
    else this.pin(html, x, y);
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
