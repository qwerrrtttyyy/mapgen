// 冰雪系统：动态冰盖 + 海冰 + 冰川侵蚀（U 型谷）。
// 用途：
//   1. 极地高海拔陆地 → 冰盖扩张（沿坡向下流动，浅冰近似）
//   2. 极地海洋 → 海冰
//   3. 冰厚 > 阈值 → 冰川侵蚀（沿流向削平谷底、拓宽横截面，形成 U 型谷）
//   4. fs-map.frag 可视化（landIce / seaIce 通道）

export interface IceResult {
  /** 陆地冰厚 [0,1] */
  landIce: Float32Array;
  /** 海冰厚 [0,1] */
  seaIce: Float32Array;
  /** 冰川流向 x（用于侵蚀与可视化） */
  glacierVx: Float32Array;
  /** 冰川流向 y */
  glacierVy: Float32Array;
}

export interface IceInput {
  width: number;
  height: number;
  elevation: Float32Array; // 可被冰川侵蚀改写
  seaLevel: number;
  temperature: Float32Array;
  snowLine: number; // 0..1 温度阈值（低于此值且高海拔 → 冰）
  /** 极地纬度阈值（absLat > 此值 → 海冰可能） */
  polarLatThreshold?: number;
  seed: number;
}

/**
 * 计算冰盖场并就地应用冰川侵蚀。
 * 约定：y=0 南极（lat=-1）、y=H 北极（lat=+1）。
 */
export function computeIceSheet(input: IceInput): IceResult {
  const { width, height, elevation, seaLevel, temperature, snowLine, seed } = input;
  const polarLatThreshold = input.polarLatThreshold ?? 0.7;
  const size = width * height;
  const invH = 1 / height;

  const landIce = new Float32Array(size);
  const seaIce = new Float32Array(size);
  const glacierVx = new Float32Array(size);
  const glacierVy = new Float32Array(size);

  // ── 阶段 1：初始冰厚 ──
  // 陆地冰：温度 < snowLine 且海拔 > seaLevel+0.1 → 冰厚 ∝ (snowLine - temp) + (elev - snowLine)
  // 海冰：海洋 + 极地纬度 + 低温 → 海冰厚 ∝ (polarLat - absLat 阈值外)*(低温量)
  for (let y = 0; y < height; y++) {
    const lat = (y * invH - 0.5) * 2;
    const absLat = Math.abs(lat);
    const isPolar = absLat > polarLatThreshold;
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const elev = elevation[idx];
      const temp = temperature[idx];
      if (elev > seaLevel) {
        // 陆地冰：低温 + 高海拔
        if (temp < snowLine && elev > seaLevel + 0.1) {
          const coldness = Math.max(0, snowLine - temp);
          const altFactor = Math.max(0, elev - snowLine);
          landIce[idx] = Math.min(1, (coldness * 0.8 + altFactor * 0.6));
        }
      } else if (isPolar && temp < -0.2) {
        // 海冰：极地 + 低温
        const polarFactor = (absLat - polarLatThreshold) / (1 - polarLatThreshold);
        const coldFactor = Math.max(0, -0.5 - temp) / 0.5;
        seaIce[idx] = Math.min(1, polarFactor * coldFactor * 1.5);
      }
    }
  }

  // ── 阶段 2：冰流（浅冰近似简化版）──
  // 多次迭代：每个像素把冰按梯度分配给较低邻居
  const FLOW_STEPS = 20;
  const FLOW_RATE = 0.15;
  const iceWork = new Float32Array(landIce);
  for (let step = 0; step < FLOW_STEPS; step++) {
    const snapshot = new Float32Array(iceWork);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (elevation[idx] <= seaLevel) continue; // 仅陆地冰流动
        const h = snapshot[idx];
        if (h < 0.05) continue;
        // 找出低于本像素的邻居，按高度差分配冰
        const elevHere = elevation[idx];
        const ns = [idx - 1, idx + 1, idx - width, idx + width];
        let totalDrop = 0;
        const drops: number[] = [];
        for (const ni of ns) {
          if (elevation[ni] <= seaLevel) {
            // 流向海洋：海平面为基准
            const drop = elevHere - seaLevel;
            if (drop > 0) { drops.push(drop); totalDrop += drop; }
          } else {
            const drop = elevHere - elevation[ni];
            if (drop > 0) { drops.push(drop); totalDrop += drop; }
          }
        }
        if (totalDrop === 0) continue;
        // 流出的冰量 = min(h*FLOW_RATE, h*0.5)
        const outflow = Math.min(h * FLOW_RATE, h * 0.5);
        iceWork[idx] -= outflow;
        let i = 0;
        for (const ni of ns) {
          if (i >= drops.length) break;
          const drop = drops[i++];
          if (drop <= 0) continue;
          const share = (drop / totalDrop) * outflow;
          // 海洋接收 → 转为海冰（简化）
          if (elevation[ni] <= seaLevel) {
            seaIce[ni] = Math.min(1, seaIce[ni] + share * 0.5);
          } else {
            iceWork[ni] += share;
          }
        }
      }
    }
  }
  landIce.set(iceWork);

  // ── 阶段 3：冰川流向 + 侵蚀（U 型谷）──
  // 流向 = steepest descent（与水类似）；冰厚 > ERODE_THRESHOLD 时削低 elevation
  const ERODE_THRESHOLD = 0.25;
  const ERODE_RATE = 0.04;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (landIce[idx] < ERODE_THRESHOLD) continue;
      const elev = elevation[idx];
      // 8 邻接找最陡下降
      let minE = elev, minDx = 0, minDy = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const ni = idx + dy * width + dx;
          const ne = elevation[ni];
          if (ne < minE) { minE = ne; minDx = dx; minDy = dy; }
        }
      }
      glacierVx[idx] = minDx;
      glacierVy[idx] = minDy;
      // 沿流向削低（冰厚越大、坡度越大 → 侵蚀越强）
      const slope = elev - minE;
      const erode = landIce[idx] * slope * ERODE_RATE;
      elevation[idx] = Math.max(seaLevel - 0.1, elev - erode);
    }
  }

  // ── 阶段 4：U 型谷拓宽 ──
  // 冰川路径上的横截面削平：对每个有冰像素，将垂直于流向的两侧邻居 elevation 向中心拉平
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const idx = y * width + x;
      if (landIce[idx] < ERODE_THRESHOLD) continue;
      const gx = glacierVx[idx], gy = glacierVy[idx];
      if (gx === 0 && gy === 0) continue;
      // 垂直方向（旋 90°）：(-gy, gx)
      const px = -gy, py = gx;
      const n1 = idx + py * width + px;
      const n2 = idx - py * width - px;
      if (n1 < 0 || n1 >= size || n2 < 0 || n2 >= size) continue;
      if (elevation[n1] <= seaLevel || elevation[n2] <= seaLevel) continue;
      // 平均化（U 型谷特征：底部宽平）
      const avg = (elevation[idx] + elevation[n1] + elevation[n2]) / 3;
      const blend = landIce[idx] * 0.3;
      elevation[idx] = elevation[idx] * (1 - blend) + avg * blend;
      elevation[n1] = elevation[n1] * (1 - blend * 0.5) + avg * blend * 0.5;
      elevation[n2] = elevation[n2] * (1 - blend * 0.5) + avg * blend * 0.5;
    }
  }

  return { landIce, seaIce, glacierVx, glacierVy };
}
