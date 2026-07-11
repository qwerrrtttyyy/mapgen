# ADR-0003: Köppen-Geiger 32 类生物群系分类

## Status

Accepted — 2026-06-28

## Context

v0.0.1 的 `texturePack.ts` 中有一个 15 类的简化生物群系分类，问题：

1. **分类太粗**：15 类无法区分「地中海夏旱（Csa）」与「湿润亚热带（Cfa）」，导致气候带分布不符合地理常识
2. **与渲染脱节**：GLSL 着色器 `fs-map.frag` 的 `BIOME_COLORS` 表与 TS 端分类不一致，渲染颜色对不上
3. **无高山带**：海拔梯度未纳入分类，高海拔地区的生物群系与同纬度低海拔相同

specs/mapgen-v2/requirements.md 的 AC-3.1 要求「赤道带温度 ≥ 0.7 且湿度 ≥ 0.6，副热带带出现干燥区（湿度 ≤ 0.4）」，AC-3.2 要求「山脉背风坡形成雨影区」。

## Decision

实现 32 类生物群系分类（`packages/core/src/biomes.ts`，303 行），基于 **Köppen-Geiger 气候分类法** + **Whittaker 温度-降水二维分类** + **高山垂直带**。

### 分类体系

| ID 范围 | 分类体系 | 示例 |
|---------|----------|------|
| 0-1 | 水体 | 0=深海, 1=浅海 |
| 2-5 | A 热带（Tcold ≥ 18°C） | 2=热带雨林(Af), 3=热带季风(Am), 4=热带草原(Aw), 5=热带荒漠灌丛(As) |
| 6-9 | B 干旱（降水低于阈值） | 6=热带沙漠(BWh), 7=温带沙漠(BWk), 8=半干旱草原(BSh), 9=半干旱温带草原(BSk) |
| 10-14 | C 温带（0 ≤ Tcold < 18, Thot ≥ 10） | 10=地中海夏旱(Csa), 11=地中海温带(Csb), 12=湿润亚热带(Cfa), 13=海洋性西岸(Cfb), 14=亚寒带西岸(Cfc) |
| 15-18 | D 寒带（Thot ≥ 10, Tcold < 0） | 15=温带草原冬干(Dwa), 16=温带草原湿润(Dfa), 17=寒带针叶林(Dfb/Dfc), 18=寒带大陆性(Dfd) |
| 19-20 | E 极地（Thot < 10） | 19=极地苔原(ET), 20=极地冰盖(EF) |
| 21-24 | 高山垂直带 | 21=高山苔原, 22=高山灌丛, 23=高山草甸, 24=高山寒漠 |
| 25-27 | 湿地 | 25=红树林, 26=河岸林地, 27=盐沼湿地 |
| 28-31 | 特殊 | 28=冰川覆盖, 29=海冰, 30=湖泊, 31=河口三角洲 |

### 输入与输出

```typescript
interface BiomeClassifyInput {
  temperature: Float32Array;  // [-1, 1], 赤道 +1 极地 -1
  moisture: Float32Array;     // [0, 1]
  elevation: Float32Array;    // [-1, 1]
  seaLevel: number;
  snowLine: number;
  landIce?: Float32Array;     // 冰盖厚度
}
function classifyBiomes(input: BiomeClassifyInput): BiomeResult;
```

### 与 GLSL 着色器对齐

`fs-map.frag` 的 `BIOME_COLORS[32]` 数组与本分类严格一一对应。`packingStage` 将 `biomeId/31` 编码到 `tempTex` 通道 B，着色器采样后用 `int(biome * 31.0)` 索引颜色表。

## Consequences

### 正面
- 32 类覆盖了地球真实气候带分布，地图可信度大幅提升
- 高山垂直带（21-24）使山地气候随海拔变化，符合真实地理
- 湿地（25-27）与冰川（28-29）的特殊处理让海岸线与极地更真实
- 与 GLSL 严格对齐，渲染颜色与分类 ID 不会脱节

### 负面
- 32 个 ID 需要维护 32 种颜色，调色成本高
- 温度范围 [-1, 1] 与 Köppen 原始摄氏度阈值需线性映射，映射系数是经验值，非真实气候数据
- 高山带的判定阈值（snowLine * 0.7 等）是经验值，不同纬度应不同

### 中性
- BiomeId 是 Uint8（0-31），未来扩展到 64 类需要改纹理格式

## Alternatives Considered

### 1. Holdridge 生命带分类
- **优点**：3 维（温度+降水+潜在蒸散），更精确
- **否决原因**：12 个生命带，粒度太粗；蒸散计算需要额外输入（辐射、风速），mapgen 不模拟这些

### 2. Whittaker 二维分类（纯温度+降水）
- **优点**：简单，10-15 类
- **否决原因**：无纬度带概念，沙漠可能出现在赤道，违反 AC-3.1

### 3. 真实 Köppen-Geiger 30 类（不加高山带）
- **优点**：与气候学完全一致
- **否决原因**：无高山垂直带，高海拔地区分类错误；mapgen 的 32 类 = 30 基础 + 高山4 + 湿地3 + 特殊2 - 重复3，是 Köppen 的超集

## References

- [Köppen, W. (1900). "Versuch einer Klassifikation der Klimate"](https://en.wikipedia.org/wiki/K%C3%B6ppen_climate_classification)
- [Whittaker, R.H. (1975). "Communities and Ecosystems"](https://www.worldcat.org/title/communities-and-ecosystems/oclc/1147620)
- [Peel, M.C. et al. (2007). "Updated world map of the Köppen-Geiger climate classification"](https://hess.copernicus.org/articles/11/1633/2007/)
- [specs/mapgen-v2/requirements.md](../../specs/mapgen-v2/requirements.md) — AC-3.1, AC-3.2
- [packages/core/src/biomes.ts](../../packages/core/src/biomes.ts) — 实现
- [packages/web/public/shaders/fs-map.frag](../../packages/web/public/shaders/fs-map.frag) — BIOME_COLORS
