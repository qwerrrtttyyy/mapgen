# ADR-0001: FBM 噪声体系选型（Perlin/Simplex/Value/Worley）

## Status

Accepted — 2026-06-26

## Context

mapgen 需要一个噪声系统作为地形高程、温度场、湿度场、河流走向等所有程序化生成的基础。核心需求：

1. **确定性**：相同种子必须产生完全相同的输出（seed 参数的可重现性契约）
2. **多频段叠加**：地形需要从大陆轮廓到局部细节的多尺度特征，FBM（Fractal Brownian Motion）通过多倍频叠加实现
3. **多种风格**：不同地图风格需要不同噪声特征——连续渐变（Perlin）、尖锐山脊（Simplex ridged）、细胞状结构（Worley）
4. **性能**：512×512 地图含 26 万像素，每个像素需 4-8 个倍频采样，必须在 100ms 内完成（Web Worker 中跑）
5. **无外部依赖**：core 包零 runtime dependency，算法必须自实现

specs/mapgen-v2/requirements.md 的 AC-1.1 要求「输出不包含可见网格/块状伪影」，AC-1.2 要求 ridged 变体生成连续山脊线（连通率 ≥ 70%）。

## Decision

实现自研 `NoiseEngine` 类（`packages/core/src/noise.ts`），提供 4 种噪声类型 × 4 种 FBM 变体：

**噪声类型**（NoiseType）：
- `perlin`：经典 Perlin 噪声，梯度噪声，适合连续渐变地形
- `simplex`：Simplex 噪声，改进版 Perlin，减少网格伪影，适合大部分场景（默认）
- `value`：值噪声，最简单最快，适合细节扰动
- `worley`：Worley/Cellular 噪声，细胞状结构，适合裂纹、泡沫纹理

**FBM 变体**（FbmType）：
- `standard`：标准 FBM，倍频振幅递减，适合基础地形
- `ridged`：山脊噪声，取绝对值后反转，生成尖锐山脊线
- `billowy`：膨胀噪声，类似 ridged 但更圆润，适合丘陵
- `warped`：域形变 FBM，在采样前对坐标做噪声扰动，消除规则纹理

**种子机制**：用 LCG（Linear Congruential Generator，`(s * 16807) % 2147483647`）生成 512 长度排列数组，所有噪声类型共享同一 permutation。

## Consequences

### 正面
- 4×4 = 16 种组合覆盖了从写实地球到奇幻世界的大部分地图风格
- 自实现零依赖，bundle size 可控（core 压缩后 < 100KB）
- LCG 种子保证确定性（P0-1 修复后全链路确定性，包括板块属性）

### 负面
- Simplex 实现需注意专利（3D+ Simplex 曾有专利，2022 年已过期；2D 一直无专利）
- Worley 噪声需要 LRU 缓存（WORLEY_CACHE_MAX = 10000）避免重复计算细胞中心点，增加了内存复杂度
- 4 种 FBM 变体的混合权重需要手动调参，没有自动调优机制

### 中性
- 噪声类型在 MapParams 中是必填字段，用户必须选择，不能自动选择最优组合

## Alternatives Considered

### 1. 使用 noisejs / simplex-noise npm 包
- **优点**：成熟、经过广泛测试
- **否决原因**：core 包定位为零 runtime dependency 的纯算法库；且外部包的种子 API 不统一，无法保证 4 种噪声共享同一 permutation

### 2. 只实现 Simplex（删减为单一噪声）
- **优点**：代码量减半，维护简单
- **否决原因**：Worley 噪声无法用 Simplex 模拟；用户明确要求多种风格（specs/mapgen-v2 US-1）

### 3. 使用 OpenSimplex（替代 Simplex）
- **优点**：无专利风险，更好的各向同性
- **否决原因**：实现复杂度更高（需要 4D skew），性能略低于经典 Simplex；当前 2D Simplex 专利已过期，风险消除

## References

- [Perlin, K. (1985). "An Image Synthesizer"](https://dl.acm.org/doi/10.1145/325165.325247)
- [Stam, A. (1997). "Real-time animation of gaseous phenomena"](https://dl.acm.org/doi/10.5555/266912.266925) — Simplex noise 原始论文
- [Worley, S. (1996). "A Cellular Texture Basis Function"](https://www.rhythmiccanvas.com/research/papers/worley.pdf)
- [specs/mapgen-v2/requirements.md](../../specs/mapgen-v2/requirements.md) — AC-1.1, AC-1.2
- [packages/core/src/noise.ts](../../packages/core/src/noise.ts) — 实现
