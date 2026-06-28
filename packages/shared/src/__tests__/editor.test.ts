import { describe, it, expect } from 'vitest';
import { detectTerrainRegions, type DetectedRegion } from '../editor.js';
import { CommandStack, type Command, applyBrushStroke, applyVectorMountain, applyVectorPolygon, movePlate, recomputePlateGeometry } from '../editor.js';
import type { Plate } from '../tectonic.js';

describe('地形区检测 (AC-8.2)', () => {
  const W = 50, H = 50;
  const seaLevel = 0;

  it('识别山脉连通域', () => {
    // 中央一块高地+高坡度 = 山脉；周围平原
    const elevation = new Float32Array(W * H).fill(0.2);
    const slope = new Float32Array(W * H).fill(0.02);
    const moisture = new Float32Array(W * H).fill(0.5);
    // 山脉块 x∈[20,29] y∈[20,29]
    for (let y = 20; y < 30; y++) {
      for (let x = 20; x < 30; x++) {
        const idx = y * W + x;
        elevation[idx] = 0.75;
        slope[idx] = 0.4;
      }
    }
    const regions = detectTerrainRegions(W, H, elevation, slope, moisture, seaLevel, 0.5);
    const mountains = regions.filter(r => r.type === 'mountain');
    expect(mountains.length).toBeGreaterThanOrEqual(1);
    // 山脉面积应接近 10×10=100（允许边缘分类差异）
    const totalMtnArea = mountains.reduce((s, r) => s + r.area, 0);
    expect(totalMtnArea).toBeGreaterThanOrEqual(60);
    // 山脉质心应在中央块附近
    const m = mountains[0];
    expect(m.centroid[0]).toBeGreaterThan(15);
    expect(m.centroid[0]).toBeLessThan(35);
    expect(m.centroid[1]).toBeGreaterThan(15);
    expect(m.centroid[1]).toBeLessThan(35);
  });

  it('识别沙漠与森林（按湿度分离）', () => {
    const elevation = new Float32Array(W * H).fill(0.3);
    const slope = new Float32Array(W * H).fill(0.02);
    const moisture = new Float32Array(W * H).fill(0.5);
    // 左半沙漠（湿度 0.1），右半森林（湿度 0.8）
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        if (x < W / 2) moisture[idx] = 0.1;
        else moisture[idx] = 0.8;
      }
    }
    const regions = detectTerrainRegions(W, H, elevation, slope, moisture, seaLevel, 0.5);
    const types = new Set(regions.map(r => r.type));
    expect(types.has('desert')).toBe(true);
    expect(types.has('forest')).toBe(true);
  });

  it('过滤小碎片（面积 < minArea）', () => {
    const elevation = new Float32Array(W * H).fill(0.2);
    const slope = new Float32Array(W * H).fill(0.02);
    const moisture = new Float32Array(W * H).fill(0.5);
    // 一个 2×2 的小山脉碎片
    for (let y = 20; y < 22; y++) {
      for (let x = 20; x < 22; x++) {
        const idx = y * W + x;
        elevation[idx] = 0.75;
        slope[idx] = 0.4;
      }
    }
    const minArea = 10;
    const regions = detectTerrainRegions(W, H, elevation, slope, moisture, seaLevel, 0.5, minArea);
    const mountains = regions.filter(r => r.type === 'mountain');
    expect(mountains.length).toBe(0);
  });

  it('每个区域有唯一 key', () => {
    const elevation = new Float32Array(W * H).fill(0.3);
    const slope = new Float32Array(W * H).fill(0.02);
    const moisture = new Float32Array(W * H).fill(0.5);
    for (let y = 10; y < 20; y++) {
      for (let x = 10; x < 20; x++) {
        elevation[y * W + x] = 0.75;
        slope[y * W + x] = 0.4;
      }
    }
    for (let y = 30; y < 40; y++) {
      for (let x = 30; x < 40; x++) {
        elevation[y * W + x] = 0.75;
        slope[y * W + x] = 0.4;
      }
    }
    const regions = detectTerrainRegions(W, H, elevation, slope, moisture, seaLevel, 0.5);
    const keys = regions.map(r => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ── 命令栈 (AC-9.1, AC-9.2, BR-3) ──
describe('命令栈 (AC-9.1, AC-9.2, BR-3)', () => {
  function makeCmd(log: string[], tag: string): Command {
    return {
      kind: 'mock',
      undo: () => log.push(`undo:${tag}`),
      redo: () => log.push(`redo:${tag}`),
    };
  }

  it('AC-9.1 push 后 undo 恢复', () => {
    const stack = new CommandStack();
    const log: string[] = [];
    stack.push(makeCmd(log, 'a'));
    expect(stack.canUndo).toBe(true);
    expect(stack.undo()).toBe(true);
    expect(log).toEqual(['undo:a']);
    expect(stack.canUndo).toBe(false);
  });

  it('AC-9.2 redo 恢复已撤销操作', () => {
    const stack = new CommandStack();
    const log: string[] = [];
    stack.push(makeCmd(log, 'a'));
    stack.undo();
    expect(stack.canRedo).toBe(true);
    expect(stack.redo()).toBe(true);
    expect(log).toEqual(['undo:a', 'redo:a']);
  });

  it('BR-3 撤销栈上限 50，超出丢弃最早', () => {
    const stack = new CommandStack(50);
    const log: string[] = [];
    for (let i = 0; i < 55; i++) stack.push(makeCmd(log, `c${i}`));
    // 只能撤销 50 次
    let undoCount = 0;
    while (stack.undo()) undoCount++;
    expect(undoCount).toBe(50);
    // 最早 5 个已被丢弃，undo 顺序应为 c54→c5
    expect(log[0]).toBe('undo:c54');
    expect(log[49]).toBe('undo:c5');
  });

  it('新编辑清空 redo 栈', () => {
    const stack = new CommandStack();
    const log: string[] = [];
    stack.push(makeCmd(log, 'a'));
    stack.undo();
    expect(stack.canRedo).toBe(true);
    stack.push(makeCmd(log, 'b')); // 新编辑
    expect(stack.canRedo).toBe(false);
  });
});

// ── 画笔 (AC-5.1, AC-5.2, C-1) ──
describe('画笔涂刷 (AC-5.1, AC-5.2)', () => {
  const W = 30, H = 30;

  it('AC-5.1 抬升画笔在半径内抬升高程，中心强边缘弱', () => {
    const elev = new Float32Array(W * H).fill(0.2);
    const cmd = applyBrushStroke(W, H, elev, 15, 15, 5, 0.3, 'raise');
    cmd.redo();
    const center = elev[15 * W + 15];
    const edge = elev[15 * W + 19]; // 距中心 4px（半径内边缘）
    const outside = elev[15 * W + 21]; // 距中心 6px（半径外）
    expect(center).toBeGreaterThan(0.2);
    expect(center).toBeGreaterThan(edge);
    expect(outside).toBeCloseTo(0.2, 5);
  });

  it('undo 恢复抬升前高程', () => {
    const elev = new Float32Array(W * H).fill(0.2);
    const cmd = applyBrushStroke(W, H, elev, 15, 15, 5, 0.3, 'raise');
    cmd.redo();
    const after = elev[15 * W + 15];
    expect(after).toBeGreaterThan(0.2);
    cmd.undo();
    expect(elev[15 * W + 15]).toBeCloseTo(0.2, 5);
  });

  it('AC-5.2 板块涂刷切换 plateId', () => {
    const plateId = new Float32Array(W * H); // 全 0
    const cmd = applyBrushStroke(W, H, plateId, 15, 15, 5, 1, 'plate-paint', { targetPlateId: 3 });
    cmd.redo();
    expect(plateId[15 * W + 15]).toBe(3);
    expect(plateId[15 * W + 21]).toBe(0); // 半径外不变
    cmd.undo();
    expect(plateId[15 * W + 15]).toBe(0);
  });

  it('海陆画笔：sea 设为 -0.3，land 设为 0.2', () => {
    const elev = new Float32Array(W * H).fill(0.2);
    const cmd = applyBrushStroke(W, H, elev, 15, 15, 4, 1, 'sea');
    cmd.redo();
    expect(elev[15 * W + 15]).toBeLessThanOrEqual(0);
  });
});

// ── 矢量工具 (AC-6.1, AC-6.2) ──
describe('矢量工具 (AC-6.1, AC-6.2)', () => {
  const W = 40, H = 40;

  it('AC-6.1 矢量线生成山脉', () => {
    const elev = new Float32Array(W * H).fill(0.2);
    const line = [[5, 20], [35, 20]]; // 水平线
    const cmd = applyVectorMountain(W, H, elev, line, 3, 0.6);
    cmd.redo();
    // 线上点抬升
    expect(elev[20 * W + 20]).toBeGreaterThan(0.5);
    // 线外远处不变
    expect(elev[5 * W + 5]).toBeCloseTo(0.2, 5);
    cmd.undo();
    expect(elev[20 * W + 20]).toBeCloseTo(0.2, 5);
  });

  it('AC-6.2 多边形设为海洋', () => {
    const elev = new Float32Array(W * H).fill(0.2);
    const poly = [[10, 10], [30, 10], [30, 30], [10, 30]];
    const cmd = applyVectorPolygon(W, H, elev, poly, 'sea');
    cmd.redo();
    // 多边形内部点低于海平面
    expect(elev[20 * W + 20]).toBeLessThanOrEqual(0);
    // 外部点不变
    expect(elev[2 * W + 2]).toBeCloseTo(0.2, 5);
    cmd.undo();
    expect(elev[20 * W + 20]).toBeCloseTo(0.2, 5);
  });
});

// ── 板块拖拽 (AC-7.1) ──
describe('板块拖拽 (AC-7.1)', () => {
  const W = 30, H = 30;

  it('AC-7.1 平移板块像素到新位置', () => {
    const plateId = new Float32Array(W * H);
    // 板块 1 占据左上 10×10
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) plateId[y * W + x] = 1;
    const cmd = movePlate(W, H, plateId, 1, 5, 5);
    cmd.redo();
    // 原位置不再是板块 1（被相邻板块/海洋填充）
    expect(plateId[0 * W + 0]).not.toBe(1);
    // 新位置（平移 +5,+5）应为板块 1；用非重叠点 (12,12) 验证
    expect(plateId[12 * W + 12]).toBe(1);
    cmd.undo();
    expect(plateId[0 * W + 0]).toBe(1);
    // 非重叠点 (12,12) 还原后不再是板块 1
    expect(plateId[12 * W + 12]).not.toBe(1);
  });
});

// ── 板块几何重算（plate-paint 后修正 Bug-1）──
describe('板块几何重算 recomputePlateGeometry', () => {
  const W = 40, H = 40;
  const seaLevel = 0;

  function makePlates(n: number): Plate[] {
    return Array.from({ length: n }, (_, i) => ({
      id: i, x: 0.5, y: 0.5, vx: 0, vy: 0,
      type: 'ocean' as const, color: [0, 0, 0], area: 0, boundary: 0, growth: 0,
      elevation: 0, moisture: 0, temperature: 0, name: `P${i}`, selected: false,
    }));
  }

  it('基于 plateId 重算质心与 plateDist', () => {
    // 板块 0 占左半（x<20），板块 1 占右半（x>=20）
    const plateId = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) plateId[y * W + x] = x < 20 ? 0 : 1;
    const elevation = new Float32Array(W * H).fill(-0.3);
    const geo = recomputePlateGeometry(W, H, plateId, makePlates(2), elevation, seaLevel);
    // 板块 0 质心 x ≈ 9.5（左半 0..19 的中心）
    expect(geo.plates[0].x * W).toBeCloseTo(9.5, 1);
    expect(geo.plates[1].x * W).toBeCloseTo(29.5, 1);
    // plateDist：板块 0 中心像素 (10,20) 到质心 (9.5,19.5) 距离 ≈ 0
    const centerDist = geo.plateDist[20 * W + 10];
    expect(centerDist).toBeLessThan(1.5);
    // 边缘像素距离更大
    const edgeDist = geo.plateDist[0 * W + 0];
    expect(edgeDist).toBeGreaterThan(centerDist);
  });

  it('按平均高程推断板块 type（陆/海）', () => {
    const plateId = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) plateId[y * W + x] = x < 20 ? 0 : 1;
    const elevation = new Float32Array(W * H);
    // 板块 0 区域高程 > seaLevel（陆地），板块 1 区域 < seaLevel（海洋）
    for (let i = 0; i < W * H; i++) elevation[i] = plateId[i] === 0 ? 0.4 : -0.4;
    const geo = recomputePlateGeometry(W, H, plateId, makePlates(2), elevation, seaLevel);
    expect(geo.plates[0].type).toBe('continent');
    expect(geo.plates[1].type).toBe('ocean');
  });

  it('空板块（无像素）回落到原 plate 位置，type 为 ocean', () => {
    const plateId = new Float32Array(W * H); // 全板块 0
    const elevation = new Float32Array(W * H).fill(-0.3);
    const plates = makePlates(2);
    plates[1] = { ...plates[1], x: 0.3, y: 0.7 };
    const geo = recomputePlateGeometry(W, H, plateId, plates, elevation, seaLevel);
    // 板块 1 无像素 → 回落原 x/y
    expect(geo.plates[1].x).toBe(0.3);
    expect(geo.plates[1].y).toBe(0.7);
    expect(geo.plates[1].type).toBe('ocean');
  });
});
