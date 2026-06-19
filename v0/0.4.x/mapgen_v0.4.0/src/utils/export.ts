// 导出功能

import { MapData } from '@/types';

export function exportPNG(canvas: HTMLCanvasElement, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export function exportJPEG(canvas: HTMLCanvasElement, filename: string, quality = 0.92) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/jpeg', quality);
  link.click();
}

export function exportWebP(canvas: HTMLCanvasElement, filename: string, quality = 0.92) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/webp', quality);
  link.click();
}

export function exportElevationJSON(data: MapData, filename: string) {
  const elevationArray: number[][] = [];
  for (let y = 0; y < data.height; y++) {
    const row: number[] = [];
    for (let x = 0; x < data.width; x++) {
      row.push(data.elevTex[(y * data.width + x) * 4]);
    }
    elevationArray.push(row);
  }
  const blob = new Blob([JSON.stringify(elevationArray)], { type: 'application/json' });
  const link = document.createElement('a');
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  link.click();
}

export function exportFullJSON(data: MapData, filename: string) {
  const exportData = {
    width: data.width,
    height: data.height,
    seed: data.seed,
    plates: data.plates.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
      elevation: p.elevation,
      moisture: p.moisture,
      temperature: p.temperature,
      color: p.color,
    })),
    regions: data.regions.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type,
      area: r.area,
      centerX: r.centerX,
      centerY: r.centerY,
      avgElevation: r.avgElevation,
      avgMoisture: r.avgMoisture,
      avgTemperature: r.avgTemperature,
    })),
    rivers: data.rivers.map(r => ({
      id: r.id,
      length: r.length,
      sourceX: r.sourceX,
      sourceY: r.sourceY,
      mouthX: r.mouthX,
      mouthY: r.mouthY,
    })),
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  link.click();
}
