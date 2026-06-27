export class RenderLoop {
  private rafId: number | null = null;
  private running = false;
  private needsRender = false;

  constructor(private renderFn: () => void) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  requestRender(): void {
    this.needsRender = true;
    if (!this.running) this.start();
  }

  private tick = (): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);
    if (this.needsRender) {
      this.needsRender = false;
      this.renderFn();
    }
  };
}
