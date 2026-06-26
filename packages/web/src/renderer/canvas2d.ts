import type { MapData } from '@mapgen/core';

export class Canvas2DRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private mapData: MapData | null = null;
  private imageData: ImageData | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
    this.canvas = canvas;
  }

  uploadMapData(data: MapData): void {
    this.mapData = data;
    this._renderToImageData(data);
  }

  private _renderToImageData(data: MapData): void {
    const { width, height, elevTex, moistTex, riverTex, tempTex } = data;
    const imgData = this.ctx.createImageData(width, height);
    const pixels = imgData.data;
    const seaLevel = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const i4 = idx * 4;
        const elevation = elevTex[i4];
        const ridgeMask = elevTex[i4 + 3];
        const moisture = moistTex[i4];
        const temperature = moistTex[i4 + 2];
        const riverMask = riverTex[i4];
        const lakeMask = riverTex[i4 + 3];
        
        let r: number, g: number, b: number;
        
        if (elevation <= seaLevel) {
          const t = Math.max(0, elevation / (seaLevel || 0.001));
          r = (0.05 + t * 0.1) * 255;
          g = (0.15 + t * 0.2) * 255;
          b = (0.35 + t * 0.2) * 255;
        } else {
          const land = (elevation - seaLevel) / (1.0 - seaLevel);
          if (land < 0.05) { r = 191; g = 178; b = 127; }
          else if (temperature < 0.15) { r = 191; g = 216; b = 216; }
          else if (moisture < 0.2 && temperature > 0.5) { r = 216; g = 191; b = 114; }
          else if (elevation > 0.7) { r = 140; g = 127; b = 114; }
          else if (moisture > 0.6) { r = 63; g = 114; b = 63; }
          else { r = 89; g = 153; b = 63; }
        }
        
        if (riverMask > 0) { r = r * 0.3 + 63; g = g * 0.3 + 114; b = b * 0.3 + 165; }
        if (lakeMask > 0) { r = r * 0.4 + 76; g = g * 0.4 + 127; b = b * 0.4 + 178; }
        if (ridgeMask > 0.5) { r = r * 0.5 + 70; g = g * 0.5 + 63.5; b = b * 0.5 + 57; }
        
        pixels[i4] = Math.min(255, Math.max(0, r));
        pixels[i4 + 1] = Math.min(255, Math.max(0, g));
        pixels[i4 + 2] = Math.min(255, Math.max(0, b));
        pixels[i4 + 3] = 255;
      }
    }
    
    this.imageData = imgData;
  }

  render(): void {
    if (!this.imageData || !this.mapData) return;
    
    const canvas = this.ctx.canvas;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const mapW = this.mapData.width;
    const mapH = this.mapData.height;
    const cW = canvas.width;
    const cH = canvas.height;
    const scale = Math.min(cW / mapW, cH / mapH);
    const dW = mapW * scale;
    const dH = mapH * scale;
    const ox = (cW - dW) / 2;
    const oy = (cH - dH) / 2;
    
    const tmp = document.createElement('canvas');
    tmp.width = mapW;
    tmp.height = mapH;
    const tCtx = tmp.getContext('2d');
    if (!tCtx) return;
    
    tCtx.putImageData(this.imageData, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(tmp, ox, oy, dW, dH);
  }

  resize(w: number, h: number): void {
    this.canvas.width = w;
    this.canvas.height = h;
  }
}
