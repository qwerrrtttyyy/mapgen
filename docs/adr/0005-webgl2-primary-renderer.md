# ADR-0005: WebGL2 主渲染器 + Canvas2D/p5 降级

## Status

Accepted — 2026-06-26

## Context

mapgen 需要在浏览器中渲染地图，支持 19 种视觉风格（地形、板块、羊皮纸、卫星、低多边形、生物群落、等高线、浮雕、Azgaar、洋流条纹、冰盖覆盖等）。核心需求：

1. **多纹理采样**：11 张 Float32 纹理（elevTex、plateTex、moistTex、riverTex、tempTex、currentTex、iceTex、biomeTex、watershedTex、volcanismTex、seasonTex）需在像素级混合
2. **实时参数调整**：seaLevel、lightAngle、contourInterval 等参数滑动时需 < 16ms 重绘（60fps）
3. **19 种风格切换**：风格切换不应重新生成地图数据，只改渲染参数
4. **降级兼容**：WebGL2 不支持时（旧设备、无 GPU）需自动降级到可工作的渲染器
5. **特殊效果**：部分风格（粒子、低多边形）需要命令式绘图 API

## Decision

实现 **三层渲染降级**，统一在 `Renderer` 接口下：

### 1. WebGL2Renderer（主渲染器，`packages/web/src/renderer/webgl.ts`，362 行）

- **技术**：WebGL2 + GLSL ES 3.00 fragment shader
- **架构**：单个全屏 quad + 单个 fragment shader，通过 `u_style` uniform 在着色器内分支选择 19 种风格
- **纹理**：11 张 RGBA32F 纹理上传到 GPU，fragment shader 直接采样，零 CPU↔GPU 数据往返
- **uniform**：30+ 个 uniform（`u_seaLevel`、`u_lightAngle`、`u_zoom`、`u_pan` 等）通过 `RENDER_PARAM_MAP` 映射
- **缩放/平移**：通过 `u_zoom` / `u_pan` uniform 实现，无需重新上传纹理

### 2. Canvas2DRenderer（降级渲染器，`packages/web/src/renderer/canvas2d.ts`，140 行）

- **技术**：Canvas 2D API，逐像素 `ImageData`
- **触发**：WebGL2 不可用时（`canvas.getContext('webgl2')` 返回 null）
- **限制**：仅支持基础地形风格，不支持等高线/浮雕/洋流等复杂风格
- **用途**：检查点缩略图（`CheckpointPanel` 在 Canvas2D 模式下用彩色地形替代黑屏）

### 3. P5Renderer（艺术化渲染器，`packages/web/src/renderer/p5renderer.ts`，489 行）

- **技术**：p5.js 1.11
- **用途**：粒子特效（雪花、火星、烟雾）与艺术化「低多边形」风格
- **触发**：用户选择特定风格（如 `style: 15` 低多边形）时自动切换
- **注意**：三者中最具表现力但也最慢，不适合大图实时交互

### 接口统一

```typescript
interface Renderer {
  render(params?: RenderParams): void;
  resize(w: number, h: number): void;
  setMapData(map: MapData): void;
  dispose(): void;
}
```

`app.ts` 通过 `buildRenderParams()` 构造统一的 `RenderParams` 对象，三种渲染器各取所需。

## Consequences

### 正面
- WebGL2 主渲染器性能极佳：512×512 地图 19 风格全部 < 5ms/帧
- 单 shader 分支架构避免多程序切换开销，风格切换零延迟
- 11 张纹理一次性上传，参数调整只改 uniform，不重新上传数据
- 三层降级保证在无 GPU 环境仍可用

### 负面
- 单个 fragment shader（`fs-map.frag`）变得非常庞大（1000+ 行 GLSL），维护困难
- 19 种风格在 GLSL 中用 `if (u_style == X)` 分支，GPU 分支预测失败可能影响性能（实际测量影响 < 5%）
- Canvas2D 降级丢失大部分风格，用户体验下降但不崩溃
- p5.js 增加了 ~200KB bundle（gzipped ~80KB），仅用于少数风格

### 中性
- `RENDER_PARAM_MAP` 硬编码 30+ uniform 映射，新增 uniform 需同步改 map 和 shader

## Alternatives Considered

### 1. WebGPU 替代 WebGL2
- **优点**：更现代，Compute Shader 可做 GPU 端生成，性能更高
- **否决原因**：2026 年浏览器兼容性仍不够（Safari 17+ 才支持，全球覆盖率 ~85%）；WebGL2 覆盖率 ~97%；项目优先兼容性

### 2. 多 shader 程序（每风格一个 shader）
- **优点**：shader 更简单，分支更少
- **否决原因**：程序切换有开销（~0.5ms），19 风格频繁切换会卡顿；维护 19 个 shader 文件成本高

### 3. 只用 Canvas2D（删 WebGL2）
- **优点**：实现简单，无 GPU 依赖
- **否决原因**：512×512 逐像素 ImageData 约 30ms/帧，无法 60fps；无法实现等高线/浮雕等需要多次纹理采样的风格

### 4. Three.js / regl 封装层
- **优点**：减少 WebGL 样板代码
- **否决原因**：Three.js 太重（~600KB），且其场景图模型不适合全屏 quad 渲染；regl 较轻但仍增加依赖，自实现 362 行已足够

## References

- [WebGL 2.0 Specification](https://www.khronos.org/registry/webgl/specs/latest/2.0/)
- [GLSL ES 3.00 Specification](https://www.khronos.org/registry/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf)
- [packages/web/src/renderer/webgl.ts](../../packages/web/src/renderer/webgl.ts) — 主渲染器
- [packages/web/src/renderer/canvas2d.ts](../../packages/web/src/renderer/canvas2d.ts) — 降级渲染器
- [packages/web/src/renderer/p5renderer.ts](../../packages/web/src/renderer/p5renderer.ts) — 艺术化渲染器
- [packages/web/public/shaders/fs-map.frag](../../packages/web/public/shaders/fs-map.frag) — 19 风格 fragment shader
