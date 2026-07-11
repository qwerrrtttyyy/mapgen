// p5.js 渲染器 — 替代 Canvas2D 回退，提供交互式可视化
import type { MapData } from '@mapgen/core';
import type p5 from 'p5';
import { state } from '../core/appState.js';
import { bus } from '../core/eventBus.js';

/** p5.js 实例扩展属性（p5.js 未暴露的内部状态） */
interface P5WithImages extends p5 {
  _mapImage?: p5.Graphics;
  _thumbImage?: p5.Graphics;
}

interface P5Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: [number, number, number];
}

export class P5Renderer {
  private canvas: HTMLCanvasElement;
  private p5Instance: p5 | null = null;
  private mapData: MapData | null = null;
  private imageData: ImageData | null = null;
  private particles: P5Particle[] = [];
  private transitionProgress = 1.0;
  private animFrameId: number | null = null;
  private showParticles = false;
  private lastFrameTime = 0;
  private _ready = false;
  private _readyResolve: (() => void) | null = null;
  private _readyPromise: Promise<void>;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this._readyPromise = new Promise(resolve => {
      this._readyResolve = resolve;
    });
  }

  get ready(): Promise<void> {
    return this._readyPromise;
  }

  async init(): Promise<void> {
    const p5Module = await import('p5');
    const P5 = p5Module.default;
    const canvas = this.canvas;

    const sketch = (p: p5) => {
      p.setup = () => {
        p.createCanvas(canvas.width, canvas.height);
        p.pixelDensity(1);
        p.noStroke();
        p.frameRate(30);
        this._ready = true;
        this._readyResolve?.();
        this._readyResolve = null;
      };

      p.draw = () => {
        this._draw(p);
      };

      p.mouseMoved = () => {
        if (!this.mapData) return;
        const rect = canvas.getBoundingClientRect();
        const mx = p.mouseX - rect.width / 2;
        const my = p.mouseY - rect.height / 2;
        const mapW = this.mapData.width;
        const mapH = this.mapData.height;
        const scale = Math.min(rect.width / mapW, rect.height / mapH);
        const nx = (mx / scale + mapW / 2) / mapW;
        const ny = (my / scale + mapH / 2) / mapH;
        if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) {
          state.params.cursorPos = [nx, ny];
          state.params.cursorActive = true;
          bus.emit('render.request');
        } else {
          state.params.cursorActive = false;
        }
      };

      p.mouseClicked = () => {
        if (!this.mapData || !state.params.cursorActive) return;
        const rect = canvas.getBoundingClientRect();
        const mapW = this.mapData.width;
        const mapH = this.mapData.height;
        const scale = Math.min(rect.width / mapW, rect.height / mapH);
        const mx = p.mouseX - rect.width / 2;
        const my = p.mouseY - rect.height / 2;
        const px = Math.floor(mx / scale + mapW / 2);
        const py = Math.floor(my / scale + mapH / 2);
        if (px >= 0 && px < mapW && py >= 0 && py < mapH) {
          const idx = py * mapW + px;
          const pid = Math.round(this.mapData.plateTex[idx * 4] * state.params.plateCount);
          const elev = this.mapData.elevTex[idx * 4];
          const temp = this.mapData.moistTex[idx * 4 + 2];
          const moist = this.mapData.moistTex[idx * 4];
          bus.emit('picker.update', {
            px,
            py,
            plateId: pid,
            elevation: elev,
            temperature: temp,
            moisture: moist,
          });
        }
      };
    };

    this.p5Instance = new P5(sketch, canvas);
    return this._readyPromise;
  }

  private _draw(p: p5): void {
    const now = performance.now();
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = now;

    p.background(18, 18, 24);

    if (!this.mapData || !this.imageData) {
      this._drawLoading(p, now);
      return;
    }

    // 绘制地图
    this._drawMap(p);

    // 粒子效果
    if (this.showParticles) {
      this._updateParticles(p, dt);
      this._drawParticles(p);
    }

    // 缩略图装饰
    this._drawDecorations(p);
  }

  private _drawMap(p: p5): void {
    if (!this.mapData || !this.imageData) return;

    const mapW = this.mapData.width;
    const mapH = this.mapData.height;
    const cW = p.width;
    const cH = p.height;
    const baseScale = Math.min(cW / mapW, cH / mapH);
    const dW = Math.floor(mapW * baseScale);
    const dH = Math.floor(mapH * baseScale);

    // 过渡动画：缩放 + 淡入
    let tScale = 1.0;
    let tAlpha = 255;
    if (this.transitionProgress < 1.0) {
      this.transitionProgress = Math.min(1.0, this.transitionProgress + 0.02);
      tScale = 0.85 + 0.15 * this._easeOutCubic(this.transitionProgress);
      tAlpha = Math.floor(255 * this._easeOutCubic(this.transitionProgress));
    }

    const viewZoom = state.zoom * tScale;
    const drawW = dW * viewZoom;
    const drawH = dH * viewZoom;
    const sx = (cW - drawW) / 2 + state.panX * drawW;
    const sy = (cH - drawH) / 2 + state.panY * drawH;

    p.push();
    p.tint(255, tAlpha);

    // 使用 p5.js image 绘制
    const img = (p as P5WithImages)._mapImage;
    if (img) {
      p.image(img, sx, sy, drawW, drawH);
    } else {
      // 回退到直接绘制
      p.fill(40, 40, 50);
      p.rect(sx, sy, drawW, drawH);
    }
    p.pop();
  }

  private _drawLoading(p: p5, now: number): void {
    const cx = p.width / 2;
    const cy = p.height / 2;
    const r = 30;
    const angle = (now * 0.002) % (Math.PI * 2);

    p.push();
    p.translate(cx, cy);
    p.noFill();
    p.strokeWeight(3);

    for (let i = 0; i < 8; i++) {
      const a = angle + (i * Math.PI * 2) / 8;
      const alpha = 30 + i * 25;
      p.stroke(100, 160, 255, alpha);
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      p.circle(px, py, 6);
    }
    p.pop();
  }

  private _updateParticles(p: p5, dt: number): void {
    if (!this.mapData) return;

    // 从河流、火山口、海岸线生成新粒子
    if (this.particles.length < 200 && Math.random() < 0.3) {
      this._spawnParticle(p);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;

      // 边界回弹
      if (pt.x < 0 || pt.x > p.width) pt.vx *= -0.5;
      if (pt.y < 0 || pt.y > p.height) pt.vy *= -0.5;
    }
  }

  private _spawnParticle(_p: p5): void {
    if (!this.mapData) return;
    const mapW = this.mapData.width;
    const mapH = this.mapData.height;
    const cW = this.canvas.width;
    const cH = this.canvas.height;
    const scale = Math.min(cW / mapW, cH / mapH);

    // 随机生成位置倾向海岸线
    for (let attempt = 0; attempt < 10; attempt++) {
      const mx = Math.floor(Math.random() * mapW);
      const my = Math.floor(Math.random() * mapH);
      const idx = my * mapW + mx;
      const elev = this.mapData.elevTex[idx * 4];
      const river = this.mapData.riverTex[idx * 4];

      if (Math.abs(elev - state.params.seaLevel) < 0.05 || river > 0) {
        this.particles.push({
          x: mx * scale + (this.canvas.width - mapW * scale) / 2 + (Math.random() - 0.5) * 10,
          y: my * scale + (this.canvas.height - mapH * scale) / 2 + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * 30,
          vy: (Math.random() - 0.5) * 30 - 10,
          life: 1.5 + Math.random() * 2,
          maxLife: 1.5 + Math.random() * 2,
          size: 1 + Math.random() * 3,
          color: river > 0 ? [80, 140, 220] : [200, 200, 180],
        });
        return;
      }
    }
  }

  private _drawParticles(p: p5): void {
    p.noStroke();
    for (const pt of this.particles) {
      const alpha = Math.max(0, pt.life / pt.maxLife) * 180;
      const [r, g, b] = pt.color;
      p.fill(r, g, b, alpha);
      p.circle(pt.x, pt.y, pt.size * (pt.life / pt.maxLife));
    }
  }

  private _drawDecorations(p: p5): void {
    if (!this.mapData) return;

    // 绘制微缩图
    const thumbSize = 80;
    const thumbX = p.width - thumbSize - 16;
    const thumbY = p.height - thumbSize - 16;

    p.push();
    p.stroke(255, 255, 255, 40);
    p.strokeWeight(1);
    p.noFill();
    p.rect(thumbX, thumbY, thumbSize, thumbSize, 4);

    // 绘制微缩图内容
    if (this.imageData) {
      const thumbImg = (p as P5WithImages)._thumbImage;
      if (thumbImg) {
        p.image(thumbImg, thumbX, thumbY, thumbSize, thumbSize);
      }
    }
    p.pop();

    // 图例
    this._drawLegend(p);
  }

  private _drawLegend(p: p5): void {
    const lx = 16;
    const ly = p.height - 180;
    const items = [
      { label: '积雪', color: [240, 240, 250] },
      { label: '山地', color: [140, 130, 120] },
      { label: '森林', color: [34, 139, 34] },
      { label: '草原', color: [140, 180, 60] },
      { label: '沙漠', color: [210, 180, 100] },
      { label: '水域', color: [40, 100, 180] },
    ];

    p.push();
    p.textSize(11);
    p.textFont('monospace');

    for (let i = 0; i < items.length; i++) {
      const y = ly + i * 20;
      const [r, g, b] = items[i].color;
      p.fill(r, g, b, 200);
      p.noStroke();
      p.rect(lx, y, 12, 12, 2);
      p.fill(200, 200, 210, 180);
      p.text(items[i].label, lx + 18, y + 10);
    }
    p.pop();
  }

  uploadMapData(data: MapData): void {
    this.mapData = data;
    this._renderToImageData(data);
    this.transitionProgress = 0.0;
    this._createP5Image();
  }

  private _renderToImageData(data: MapData): void {
    const { width, height, elevTex, moistTex, riverTex } = data;
    const imgData = new ImageData(width, height);
    const pixels = imgData.data;
    const seaLevel = state.params.seaLevel;
    const snowLine = state.params.snowLine;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const i4 = idx * 4;
        const elevation = elevTex[i4];
        const slope = elevTex[i4 + 1];
        const ridgeMask = elevTex[i4 + 3];
        const moisture = moistTex[i4];
        const temperature = moistTex[i4 + 2];
        const riverMask = riverTex[i4];
        const lakeMask = riverTex[i4 + 3];

        let r: number, g: number, b: number;

        if (elevation <= seaLevel) {
          // 水域：根据深度渐变色
          const depth = Math.max(0, (seaLevel - elevation) / (seaLevel + 0.5));
          const shallow = 1 - Math.min(1, depth * 3);
          r = 20 + shallow * 40;
          g = 60 + shallow * 80;
          b = 120 + shallow * 60 + depth * 40;
        } else {
          const sl = Math.min(1, slope * 3);
          const shade = 1 - sl * 0.3;

          if (temperature < snowLine && elevation > 0.6) {
            // 雪/冰
            r = 230 * shade;
            g = 235 * shade;
            b = 245 * shade;
          } else if (elevation > 0.7) {
            // 岩石
            r = 130 * shade;
            g = 120 * shade;
            b = 110 * shade;
          } else if (moisture < 0.15 && temperature > 0.4) {
            // 沙漠
            r = 200 * shade;
            g = 175 * shade;
            b = 110 * shade;
          } else if (moisture > 0.55) {
            // 森林
            r = 40 * shade;
            g = 100 * shade;
            b = 40 * shade;
          } else if (moisture > 0.3) {
            // 草原
            r = 110 * shade;
            g = 150 * shade;
            b = 50 * shade;
          } else {
            // 灌木
            r = 140 * shade;
            g = 130 * shade;
            b = 70 * shade;
          }
        }

        // 河流
        if (riverMask > 0) {
          const blend = riverMask * 0.7;
          r = r * (1 - blend) + 50 * blend;
          g = g * (1 - blend) + 100 * blend;
          b = b * (1 - blend) + 180 * blend;
        }
        // 湖泊
        if (lakeMask > 0) {
          const blend = lakeMask * 0.8;
          r = r * (1 - blend) + 40 * blend;
          g = g * (1 - blend) + 80 * blend;
          b = b * (1 - blend) + 160 * blend;
        }
        // 山脊
        if (ridgeMask > 0.5) {
          const blend = ridgeMask * 0.4;
          r = r * (1 - blend) + 80 * blend;
          g = g * (1 - blend) + 75 * blend;
          b = b * (1 - blend) + 60 * blend;
        }

        pixels[i4] = Math.min(255, Math.max(0, Math.round(r)));
        pixels[i4 + 1] = Math.min(255, Math.max(0, Math.round(g)));
        pixels[i4 + 2] = Math.min(255, Math.max(0, Math.round(b)));
        pixels[i4 + 3] = 255;
      }
    }

    this.imageData = imgData;
  }

  private _createP5Image(): void {
    if (!this.p5Instance || !this.imageData || !this.mapData) return;
    const p = this.p5Instance;

    // 创建 p5.js Image 用于高效绘制
    const gfx = p.createGraphics(this.mapData.width, this.mapData.height);
    gfx.pixelDensity(1);
    gfx.loadPixels();
    const src = this.imageData.data;
    const dst = gfx.pixels;
    for (let i = 0; i < src.length; i++) {
      dst[i] = src[i];
    }
    gfx.updatePixels();
    (p as P5WithImages)._mapImage = gfx;

    // 创建缩略图
    const thumb = p.createGraphics(80, 80);
    thumb.pixelDensity(1);
    thumb.image(gfx, 0, 0, 80, 80);
    (p as P5WithImages)._thumbImage = thumb;
  }

  render(): void {
    // p5.js 自动渲染，通过 requestAnimationFrame 驱动
    if (this.animFrameId === null) {
      this.animFrameId = requestAnimationFrame(() => {
        this.animFrameId = null;
      });
    }
  }

  resize(w: number, h: number): void {
    this.canvas.width = w;
    this.canvas.height = h;
    if (this.p5Instance) {
      this.p5Instance.resizeCanvas(w, h);
    }
  }

  toggleParticles(enabled: boolean): void {
    this.showParticles = enabled;
  }

  setParticleCount(_count: number): void {
    // 粒子生成由 _updateParticles 自动管理
  }

  destroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.p5Instance) {
      this.p5Instance.remove();
      this.p5Instance = null;
    }
  }

  private _easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }
}
