export interface PointLike { x: number; y: number; }

export class SpatialGrid<T extends PointLike> {
  private cells: T[][] = [];
  private cols: number;
  private rows: number;

  constructor(private width: number, private height: number, private cellSize: number) {
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    this.cells = Array.from({ length: this.cols * this.rows }, () => []);
  }

  insert(item: T): void {
    const idx = this.index(item.x, item.y);
    if (idx >= 0) this.cells[idx].push(item);
  }

  queryRadius(x: number, y: number, r: number): T[] {
    const result: T[] = [];
    const minX = Math.max(0, Math.floor((x - r) / this.cellSize));
    const maxX = Math.min(this.cols - 1, Math.floor((x + r) / this.cellSize));
    const minY = Math.max(0, Math.floor((y - r) / this.cellSize));
    const maxY = Math.min(this.rows - 1, Math.floor((y + r) / this.cellSize));
    const r2 = r * r;
    for (let cy = minY; cy <= maxY; cy++) {
      for (let cx = minX; cx <= maxX; cx++) {
        for (const item of this.cells[cy * this.cols + cx]) {
          const dx = item.x - x, dy = item.y - y;
          if (dx * dx + dy * dy <= r2) result.push(item);
        }
      }
    }
    return result;
  }

  private index(x: number, y: number): number {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) return -1;
    return cy * this.cols + cx;
  }
}
