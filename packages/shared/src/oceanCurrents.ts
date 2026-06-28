// 洋流系统：风驱动表面流 + Ekman 漂移 + 西边界强化（Stommel 简化）。
// 输出：currentVx/Vy（流速）、currentTempDelta（暖流+/寒流-）、currentSpeed。
// 用途：沿岸温度修正（暖流增温、寒流降温）—— regions.ts；可视化—— fs-map.frag。
//
// 物理简化：
//   1. 表面流速 ≈ 3% 风速，方向 = 风向
//   2. Ekman 漂移：北半球流向偏右 45°、南半球偏左 45°（表面层近似）
//   3. 西边界强化：大陆西岸（迎风侧）洋流加速 2-3 倍（β 效应简化）
//   4. 暖流：向极流动（携带低纬热量）→ tempDelta +
//      寒流：向赤道流动 → tempDelta -
//   5. 仅在 |coastDist| < 沿岸宽度时对陆地温度有影响（远海只影响海洋温度）

export interface OceanCurrentResult {
  /** 流速 x 分量（像素/单位时间，向右为正） */
  vx: Float32Array;
  /** 流速 y 分量（向下为正；本库约定 y=0 南极、y=H 北极） */
  vy: Float32Array;
  /** 暖流+/寒流- 温度增量，仅沿岸有效 */
  tempDelta: Float32Array;
  /** 流速模长 */
  speed: Float32Array;
}

export interface OceanCurrentInput {
  width: number;
  height: number;
  elevation: Float32Array;
  seaLevel: number;
  /** 海岸距离场（陆地正、海洋负）—— 来自 coastline.ts */
  coastDist: Float32Array;
  /** 全局风场偏置（叠加到三环风带上） */
  windDirX: number;
  windDirY: number;
  /** 风场强度系数（默认 1） */
  rainStrength?: number;
  seed: number;
}

/**
 * 计算洋流场。
 * 约定：y=0 为南极（lat=-1）、y=H 为北极（lat=+1）—— 与 regions.ts 一致。
 */
export function computeOceanCurrents(input: OceanCurrentInput): OceanCurrentResult {
  const { width, height, elevation, seaLevel, coastDist, windDirX, windDirY, seed } = input;
  const rainStrength = input.rainStrength ?? 1;
  const size = width * height;
  const invH = 1 / height;

  const vx = new Float32Array(size);
  const vy = new Float32Array(size);

  // ── 阶段 1：风带模型（与 regions.ts 三环环流一致）──
  // 信风带（|lat|<0.33）：x=-1（向西）；西风带（0.33~0.66）：x=+1（向东）；极地东风（>0.66）：x=-1。
  // y 分量：信风向赤道辐合、西风带向极地、极地东风向极地。
  // 基础风速 1.0（无量纲），表面流 = 3% 风速 = 0.03
  const SURFACE_FACTOR = 0.03;
  const WIND_STRENGTH = 1.0 * rainStrength;

  for (let y = 0; y < height; y++) {
    const lat = (y * invH - 0.5) * 2; // -1 南极 → +1 北极
    const absLat = Math.abs(lat);
    let wbx: number, wby: number;
    if (absLat < 0.33) {
      // 信风带：向西（x=-1），向赤道辐合
      wbx = -1;
      wby = lat > 0 ? -1 : 1; // 北半球向南（y 减小？不对——本库 y=0 南极，故"向赤道"=向 y=H/2，北半球 lat>0 → y 减小 → wby=-1）
    } else if (absLat < 0.66) {
      // 西风带：向东（x=+1），向极地
      wbx = 1;
      wby = lat > 0 ? 1 : -1; // 北半球向北（y 增大）
    } else {
      // 极地东风：向西（x=-1），向极地
      wbx = -1;
      wby = lat > 0 ? 1 : -1;
    }
    // 叠加用户全局偏置后归一化
    const totalWx = wbx * WIND_STRENGTH + windDirX * 0.3;
    const totalWy = wby * WIND_STRENGTH + windDirY * 0.3;
    const wlen = Math.sqrt(totalWx * totalWx + totalWy * totalWy) || 1;
    const wxN = totalWx / wlen;
    const wyN = totalWy / wlen;

    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (elevation[idx] > seaLevel) continue; // 仅海洋
      // 表面流速 = 3% 风速
      let cvx = wxN * SURFACE_FACTOR;
      let cvy = wyN * SURFACE_FACTOR;
      // Ekman 漂移：北半球（lat>0）右偏 45°，南半球左偏 45°
      // 旋转矩阵：θ=+45°(NH) → (x',y') = (x cosθ - y sinθ, x sinθ + y cosθ)
      const ekmanAngle = lat > 0 ? Math.PI / 4 : -Math.PI / 4;
      const cosA = Math.cos(ekmanAngle);
      const sinA = Math.sin(ekmanAngle);
      const rx = cvx * cosA - cvy * sinA;
      const ry = cvx * sinA + cvy * cosA;
      cvx = rx; cvy = ry;
      vx[idx] = cvx;
      vy[idx] = cvy;
    }
  }

  // ── 阶段 2：西边界强化 ──
  // 简化 Stommel 模型：大陆西岸（陆地在其左侧，海洋在其右侧）的向极流加速。
  // 检测：海洋像素，其左邻居为陆地（x>0 且 elev[idx-1]>seaLevel），且当前在向极流动
  //        （NH vy>0、SH vy<0）→ 加速 2.5x
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (elevation[idx] > seaLevel) continue;
      const westIsLand = elevation[idx - 1] > seaLevel;
      if (!westIsLand) continue;
      const lat = (y * invH - 0.5) * 2;
      const poleward = (lat > 0 && vy[idx] > 0) || (lat < 0 && vy[idx] < 0);
      if (!poleward) continue;
      vx[idx] *= 2.5;
      vy[idx] *= 2.5;
    }
  }

  // ── 阶段 3：侧向混合平滑（2 pass 邻域平均，仅海洋）──
  for (let pass = 0; pass < 2; pass++) {
    const srcX = pass === 0 ? vx : vx; // in-place 简化（精度可接受）
    const srcY = pass === 0 ? vy : vy;
    const tmpX = new Float32Array(srcX);
    const tmpY = new Float32Array(srcY);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (elevation[idx] > seaLevel) continue;
        let sx = 0, sy = 0, cnt = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const ni = idx + dy * width + dx;
            if (elevation[ni] > seaLevel) continue;
            sx += srcX[ni]; sy += srcY[ni]; cnt++;
          }
        }
        if (cnt > 0) {
          vx[idx] = sx / cnt;
          vy[idx] = sy / cnt;
        }
      }
    }
    void tmpX; void tmpY;
  }

  // ── 阶段 4：流速模长 + 温度增量 ──
  const speed = new Float32Array(size);
  const tempDelta = new Float32Array(size);
  const COASTAL_RANGE = 20; // 沿岸影响宽度（像素）

  for (let i = 0; i < size; i++) {
    const sp = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
    speed[i] = sp;
    if (elevation[i] > seaLevel) continue; // 陆地 tempDelta 由沿岸海洋传递
    const y = (i / width) | 0;
    const lat = (y * invH - 0.5) * 2;
    // 暖流：向极流动（NH vy>0 / SH vy<0）；寒流：向赤道流动
    const poleward = (lat > 0 && vy[i] > 0) || (lat < 0 && vy[i] < 0);
    // 温度增量幅度 ∝ 流速 × 热带热量（赤道源 > 极地源）
    const tropicalHeat = 1 - Math.abs(lat) * 0.5; // 赤道 1，极地 0.5
    const magnitude = sp * 8 * tropicalHeat; // 缩放到温度单位
    tempDelta[i] = poleward ? magnitude : -magnitude;
  }

  // 将海洋 tempDelta 扩散到沿岸陆地（BFS 1-2 跳，仅 |coastDist| < COASTAL_RANGE）
  const landTempDelta = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    if (elevation[i] <= seaLevel) continue; // 陆地
    if (coastDist[i] <= 0 || coastDist[i] > COASTAL_RANGE) continue;
    // 取该陆地像素最近的海洋邻居的 tempDelta 平均
    const x = i % width, y = (i / width) | 0;
    let sum = 0, cnt = 0;
    const r = 3;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const ni = ny * width + nx;
        if (elevation[ni] > seaLevel) continue;
        sum += tempDelta[ni];
        cnt++;
      }
    }
    if (cnt > 0) landTempDelta[i] = (sum / cnt) * (1 - coastDist[i] / COASTAL_RANGE);
  }

  // 合并：陆地为扩散值，海洋为原始值
  for (let i = 0; i < size; i++) {
    if (elevation[i] > seaLevel) tempDelta[i] = landTempDelta[i];
  }

  return { vx, vy, tempDelta, speed };
}
