# 设计文档：mapgen v2

## 1. 架构总览

保持 Turborepo monorepo 结构，新增 3 个模块：

```
packages/
├── shared/src/
│   ├── noise.ts          # 【重构】FBM 体系：多频段+域形变+各向异性
│   ├── tectonic.ts       # 【增强】边界平滑过渡带
│   ├── erosion.ts        # 【增强】边界山脉走向
│   ├── rivers.ts         # 【增强】汇流检测+入海保证
│   ├── regions.ts        # 【已重构】风带气候
│   ├── naming.ts         # 【新增】自动命名系统
│   ├── editor.ts         # 【新增】编辑命令+撤销栈+区域检测
│   └── index.ts          # 聚合导出
└── web/src/
    ├── editor/           # 【新增】编辑器子系统
    │   ├── EditorController.ts   # 状态机+工具路由
    │   ├── BrushEngine.ts        # 画笔涂刷
    │   ├── VectorTool.ts         # 矢量线/多边形
    │   ├── PlateDragger.ts       # 板块拖拽
    │   ├── CommandStack.ts       # 撤销/重做
    │   └── NameOverlay.ts        # 标注层
    ├── renderer/
    │   └── webgl.ts      # 【扩展】支持编辑器叠加层渲染
    └── app.ts            # 【扩展】集成编辑器
```

## 2. 数据模型

### 2.1 现有纹理格式（不变，BR-2）

- `elevTex`: [elevation, slope, ridge, ridgeMask] (RGBA32F)
- `plateTex`: [plateId, boundary, boundaryType, plateDist] (RGBA32F)
- `moistTex`: [moisture, rainfall, biome, tempZone] (RGBA32F)
- `tempTex`: [temperature, _, biome, _] (RGBA32F)
- `riverTex`: [riverMask, riverWidth, riverDepth, _] (RGBA32F)

### 2.2 新增：编辑器状态

```typescript
interface EditorState {
  mode: EditorMode; // idle | brush | vector-line | vector-poly | drag-plate | annotate
  activeTool: ToolId;
  brush: { radius: number; strength: number; target: BrushTarget }; // raise|lower|sea|land|plate-paint
  vector: { points: number[]; closed: boolean; targetType: VectorTarget }; // mountain|coast|lake|river
  selection: { plateId: number | null };
  names: {
    plates: Map<number, string>; // plateId → 名称
    regions: Map<string, string>; // regionKey → 名称
  };
  commandStack: Command[]; // 撤销栈，max 50
  redoStack: Command[];
}
```

### 2.3 新增：命名数据

```typescript
interface NameManifest {
  plates: Array<{ plateId: number; name: string; centroid: [number, number] }>;
  regions: Array<{
    key: string;
    name: string;
    type: TerrainType;
    centroid: [number, number];
    area: number;
  }>;
}
type TerrainType = 'mountain' | 'plain' | 'plateau' | 'basin' | 'desert' | 'forest' | 'ocean';
```

### 2.4 新增：编辑命令（Command 模式）

```typescript
type Command =
  | {
      type: 'brush';
      target: BrushTarget;
      pixels: Array<{ idx: number; before: number; after: number }>;
    }
  | {
      type: 'vector-mountain';
      line: number[];
      width: number;
      affected: Array<{ idx: number; before: number; after: number }>;
    }
  | {
      type: 'vector-terrain';
      polygon: number[];
      targetType: VectorTarget;
      affected: Array<{ idx: number; before: number; after: number }>;
    }
  | { type: 'plate-move'; plateId: number; dx: number; dy: number; beforePlateId: Float32Array }
  | {
      type: 'rename';
      target: 'plate' | 'region';
      key: string | number;
      before: string;
      after: string;
    };
```

## 3. 算法设计

### 3.1 FBM 体系重构（noise.ts）

**问题根因**：当前 FBM 直接叠加等频噪声，且 simplex 实现存在网格伪影。

**新方案**：

1. **谱权重**：每 octave 权重 = `persistence^i × spectral(i)`，spectral 补偿高频衰减
2. **域形变**：用低频 simplex 扰动采样坐标（warpStrength 随 octave 递减）
3. **各向异性**：山脊模式沿主方向拉伸（用户可调 ridgeAngle），保证山脊连续
4. **多噪声混合**：陆地用 ridged（山脊）+ standard（细节）混合，海洋用 standard
5. **Worley F2-F1**：用于细胞状地形（岛屿链）

```typescript
class FbmGenerator {
  fbmNatural(
    x,
    y,
    octaves,
    lac,
    pers,
    type,
    opts: { warpStrength; ridgeAngle; anisotropy }
  ): number;
  // 谱权重：w_i = pers^i * (1 - 0.4 * i / octaves)  防止高频过强
  // 域形变：dx = simplex(x*f, y*f) * warp * 0.5^i
  // 各向异性（ridged）：x' = x*cos(θ)+y*sin(θ), 沿 θ 方向 elongate
}
```

### 3.2 板块边界平滑（tectonic.ts + erosion.ts）

**问题根因**：边界为硬切，无过渡带。

**新方案**：

1. `computeBoundaries` 输出 `boundaryWidth`（0-1 距离场，边界=1，向内衰减）
2. `generateElevation` 在边界处用 `smoothstep` 混合两板块高程（过渡带 ≥ 3px）
3. 汇聚边界山脉：沿边界切向生成 ridged 噪声，保证走向与边界夹角 ≤ 30°
4. 海岸线：域形变 + 海岸细节噪声让海岸蜿蜒

### 3.3 河流汇流（rivers.ts）

**问题根因**：当前逐源追踪，不检测汇流。

**新方案**：

1. D8 流向（已有）
2. 流量累积（已有）：每个像素累积上游贡献
3. **汇流检测**：追踪时若遇到已有河流像素（riverMask > 0.5），则汇入该河流下游，下游宽度按 `√(上游流量和)` 增长
4. **入海保证**：源点选择要求 `accumulation ≥ 阈值` 且终点必须到达 `elevation ≤ seaLevel` 或内陆洼地（flowDir == -1）
5. **逆坡禁止**：D8 已保证流向最低邻居，无逆坡

### 3.4 气候验证（regions.ts，已重构）

当前实现已满足 AC-3.1/3.2（风带+雨影+海洋蒸发源）。需补充：

- 雨影强度阈值校验：背风坡湿度差 ≥ 0.3
- 副热带干燥带：纬度 20°-35° 强制湿度上限 0.4

## 4. 编辑器设计

### 4.1 状态机

```
idle ──select tool──> brush | vector-line | vector-poly | drag-plate | annotate
brush ──mousedown──> brushing ──mousemove──> brushing ──mouseup──> idle (commit)
vector-line ──click──> adding-points ──Enter/double-click──> idle (commit)
vector-poly ──click──> adding-points ──close──> idle (commit)
drag-plate ──mousedown on plate──> dragging ──mouseup──> idle (commit)
annotate ──dblclick on name──> editing ──Enter──> idle (commit)
```

### 4.2 画笔引擎（BrushEngine）

- 涂刷时记录 `pixels[]`（idx, before, after）作为 Command
- 实时更新 `elevTex` 通道 0，并标记 `dirty`
- 触发 `render.request`（仅渲染，不重生成）
- 画笔形状：径向高斯衰减（边缘平滑）
- 板块涂刷：直接写 `plateTex` 通道 0

### 4.3 矢量工具（VectorTool）

- **线→山脉**：沿线像素用 ridged 噪声抬升，宽度参数控制影响半径
- **多边形→地形**：扫描线填充，按 targetType 设高程（陆地 +0.2 / 海洋 -0.3 / 湖泊 seaLevel+0.05）
- 完成后重新计算 slope（局部）

### 4.4 板块拖拽（PlateDragger）

- mousedown 选中 plateId（取 plateTex[idx].r）
- 记录所有该 plateId 像素
- mousemove 平移偏移
- mouseup：写入新位置，旧位置由相邻板块填充或设为海洋；重算边界

### 4.5 撤销/重做（CommandStack）

- 每个 Command 实现 `undo()` / `redo()`
- 栈 max 50（BR-3）
- Ctrl+Z = pop commandStack → redoStack → undo()
- Ctrl+Shift+Z = pop redoStack → commandStack → redo()
- 编辑后清空 redoStack

### 4.6 名称叠加层（NameOverlay）

- 独立 Canvas2D 叠加在 WebGL 之上
- 按 plateId/regionKey 的 centroid 渲染文字
- 双击命中检测：点-文字包围盒
- 改名后重绘

## 5. 命名系统设计（naming.ts）

### 5.1 词库

```typescript
const LEXICON = {
  direction: ['北极', '北', '东北', '东', '东南', '南', '南极', '西南', '西', '西北', '中央'],
  plateType: { continent: ['大陆', '洲', '陆地'], ocean: ['洋', '海', '湾'] },
  terrain: {
    mountain: ['山脉', '山脊', '峰群'],
    plain: ['平原', '草原', '低地'],
    plateau: ['高原', '台地'],
    basin: ['盆地', '洼地'],
    desert: ['沙漠', '荒原'],
    forest: ['森林', '林地'],
  },
  proper: [
    '龙脊',
    '银沙',
    '苍穹',
    '碧落',
    '玄铁',
    '霜语',
    '烈焰',
    '深岚',
    '星陨',
    '月隐' /* +50 */,
  ],
};
```

### 5.2 生成器

```typescript
function generateNames(seed, plates, plateCentroids, regions): NameManifest {
  const rng = mulberry32(seed);
  // 板块名：方向词（按质心相对中心方位角）+ 类型词
  // 地形区名：proper词（rng 选取，不重复）+ 地貌词
}
```

### 5.3 区域检测（editor.ts）

```typescript
function detectTerrainRegions(width, height, elevation, slope, moisture, seaLevel): Region[] {
  // 1. 阈值分类：mountain(elev>snowLine*0.7 && slope>thr) / plain(slope<low && elev<mid) /
  //              plateau(elev>high && slope<low) / basin(局部洼地) / desert(moisture<0.3) / forest(moisture>0.6)
  // 2. 连通域标记（4邻接）
  // 3. 过滤面积 < minArea 的碎片
  // 4. 计算每个连通域质心+面积
}
```

## 6. 自由生成模式

- `MapParams` 新增 `mode: 'procedural' | 'blank'`
- `blank` 模式：跳过 noise/tectonic 阶段，高程初始化为 `seaLevel + 0.1`，板块全 0，用户用编辑器构建
- UI：种子卡片新增「生成模式」单选

## 7. 测试策略（TDD）

核心算法与命名系统使用 TDD（用户已请求 tdd skill）：

- `packages/core/src/__tests__/noise.test.ts`：FBM 无伪影、各向异性山脊连续性
- `packages/core/src/__tests__/rivers.test.ts`：汇流、入海、无逆坡
- `packages/core/src/__tests__/naming.test.ts`：确定性、唯一性、命名格式
- `packages/core/src/__tests__/editor.test.ts`：命令栈、区域检测
- 测试框架：vitest（轻量，与 Vite 集成）

## 8. 技术选择与权衡

| 决策         | 选择              | 理由                             |
| ------------ | ----------------- | -------------------------------- |
| 撤销实现     | Command 模式      | 比 snapshot 节省内存，可精确还原 |
| 编辑器叠加层 | 独立 Canvas2D     | 不污染 WebGL 管线，文字渲染简单  |
| 区域检测     | 连通域标记 + 阈值 | 经典 CV 方法，纯 TS 可实现       |
| 命名 PRNG    | mulberry32        | 极轻量，确定性，种子驱动         |
| 测试框架     | vitest            | 已有 Vite，零额外配置            |

## 9. 模块边界与依赖

```
naming.ts ← 无依赖（纯函数）
editor.ts ← noise/tectonic/erosion/regions（区域检测读结果）
web/editor/* ← shared/editor + shared/naming + renderer
```

命名系统与编辑器解耦：命名只读 MapData 输出 NameManifest，编辑器消费 NameManifest 渲染叠加层。
