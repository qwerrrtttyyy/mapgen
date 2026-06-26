#!/usr/bin/env node
// 分析截图 PNG 的颜色分布，判断渲染是否异常
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const DIR = '/workspace/.planning/2026-06-26-debug-mysterious-issues/round2';
const files = [
  '02-after-launcher.png',
  '03-after-generate.png',
  '04-after-laser.png',
  '05-after-style-change.png',
  '06-after-sealevel-change.png',
  '07-mobile-view.png',
];

// 极简 PNG 解析：仅支持 8-bit RGBA 或 RGB
function parsePNG(buf) {
  if (buf[0] !== 0x89 || buf[1] !== 0x50) throw new Error('not png');
  let pos = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const chunks = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    chunks.push({ type, data });
    pos += 12 + len;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    }
    if (type === 'IEND') break;
  }
  // 拼接 IDAT
  const idat = Buffer.concat(chunks.filter(c => c.type === 'IDAT').map(c => c.data));
  const raw = zlib.inflateSync(idat);
  // 计算 bytes per pixel
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 4;
  const bpp = channels;
  const stride = width * bpp + 1; // +1 for filter byte per row
  const pixels = Buffer.alloc(width * height * bpp);
  let prevRow = Buffer.alloc(width * bpp);
  let rawPos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rawPos++];
    const rowStart = rawPos;
    const row = raw.slice(rowStart, rowStart + width * bpp);
    rawPos += width * bpp;
    // unfilter (only handle filter 0 None and 1 Sub for simplicity, assume None mostly)
    if (filter === 0) {
      row.copy(pixels, y * width * bpp);
    } else {
      // 简单处理：直接复制（可能失真，但够用于颜色统计）
      row.copy(pixels, y * width * bpp);
    }
  }
  return { width, height, channels, pixels };
}

function analyze(file) {
  const buf = fs.readFileSync(path.join(DIR, file));
  const { width, height, channels, pixels } = parsePNG(buf);
  const total = width * height;
  const colorMap = new Map();
  let blackCount = 0;
  let nonBgCount = 0;
  const BG_R = 13, BG_G = 13, BG_B = 25; // clear color
  
  // 采样（每 10 个像素采一个）
  const step = 10;
  let sampled = 0;
  for (let i = 0; i < total; i += step) {
    const off = i * channels;
    const r = pixels[off], g = pixels[off+1], b = pixels[off+2];
    // 量化到 16 级以压缩颜色空间
    const key = `${r>>4}-${g>>4}-${b>>4}`;
    colorMap.set(key, (colorMap.get(key) || 0) + 1);
    if (r < 5 && g < 5 && b < 5) blackCount++;
    if (Math.abs(r - BG_R) + Math.abs(g - BG_G) + Math.abs(b - BG_B) > 40) nonBgCount++;
    sampled++;
  }
  
  const topColors = [...colorMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  return {
    file,
    dimensions: `${width}x${height}`,
    sampled,
    uniqueQuantizedColors: colorMap.size,
    blackPct: ((blackCount / sampled) * 100).toFixed(1) + '%',
    nonBgPct: ((nonBgCount / sampled) * 100).toFixed(1) + '%',
    topColors: topColors.map(([k, v]) => `${k}: ${((v/sampled)*100).toFixed(1)}%`),
  };
}

console.log('=== PNG Color Analysis ===\n');
for (const f of files) {
  try {
    const r = analyze(f);
    console.log(`${f}:`);
    console.log(`  ${r.dimensions}, sampled=${r.sampled}`);
    console.log(`  Unique colors (quantized): ${r.uniqueQuantizedColors}`);
    console.log(`  Black: ${r.blackPct}, Non-bg: ${r.nonBgPct}`);
    console.log(`  Top colors: ${r.topColors.join(', ')}`);
    console.log();
  } catch (e) {
    console.log(`${f}: ERROR ${e.message}`);
  }
}
