# 调试证据 — findings.md

## 证据收集（Phase 1）

### 探测 1: deep_probe.mjs（元素存在性）
- 启动器 root ID 是 `launcher-overlay`（非 `launcher`）
- 工具栏按钮用 `getElementById('btn-*')`（非 `data-action`）
- 0 个 console 错误
- **Generation done: true 是假阳性**：progress 从未显示，不是生成完成而是从未开始

### 探测 2: pixel_probe.mjs（像素级验证）
- 启动器关闭后：`progressDisplay:"none"`, `progressText:"初始化..."`, 中心像素 [0,0,0,255]
- 手动点"生成"后：`progressText:"纹理打包"`（生成在运行）
- 移动端：menuVisible:true, drawerOpen:false（正常）

---

## 根因 1（已确认）：启动器路径下不触发地图生成

**位置**：`packages/web/src/app.ts` 第 272-285 行

**代码**：
```typescript
if (launcher) {
  app.classList.add('launcher-done');
  await launchPromise;        // 等待用户点 start
  await launcher.hide();
  launcher.destroy();
} else {
  await launchPromise;
}
checkpointPanel.refresh();
if (!launcher) {              // ← BUG: launcher 已被赋值为非 null，此分支永远不进
  bus.emit('render.request');
  generateMapAction();
}
```

**数据流追踪**：
1. app.ts 第 230 行：`let launcher: Launcher | null = null`
2. 第 233 行：`if (showLauncher) { launcher = new Launcher(...); }` → launcher 被赋值
3. 第 272 行：`if (launcher)` 为 true → 进入启动器分支
4. 第 282 行：`if (!launcher)` 为 false → **生成永远不触发**

**LaunchResult.start 定义但从未调用**：
- launcher.ts 第 294 行：`start: () => bus.emit('generate.request')`
- app.ts 中 `await launchPromise` 得到 result，但从未调用 `result.start()`

**影响**：用户通过启动器进入后，画布空白，必须手动点"生成地图"。

**修复方案**：第 282 行改为无条件触发，或调用 `result.start()`。

---

## 根因 2（已确认）：boolean uniform 用错误的方法设置

**位置**：`packages/web/src/renderer/webgl.ts` 第 168 行

**代码**：
```typescript
if (typeof value === 'boolean') gl.uniform1i(loc, value ? 1 : 0);  // BUG
```

**Shader 声明**（fs-map.frag）：
```glsl
uniform float u_showBoundaries;   // float，不是 int/bool
uniform float u_laserActive;      // float
uniform float u_pointLightEnabled; // float
// ... 所有开关都是 float
```

**证据**（swiftshader WebGL2 启用后）：
```
GL_INVALID_OPERATION: glUniform1i: Uniform type does not match uniform method.  (×11)
GL_INVALID_OPERATION: glUniform1f: Uniform size does not match uniform method.
```

**影响**：所有 boolean uniform（showBoundaries/laserActive/pointLightEnabled 等 12 个）设置失败，shader 里值为未定义，导致渲染逻辑错误（边界/河流/激光/光照等开关全部失效）。

**修复方案**：boolean → `gl.uniform1f(loc, value ? 1.0 : 0.0)`。同时 u_style/u_fbmOctaves 是 int，需用 uniform1i。

---

## 根因 3（已确认）：plateTex 解码逻辑不一致

**位置**：
- `laserController.ts:132`: `Math.round((plateTex[i*4] || 0) * mapData.plates.length)`
- `picker.ts:52`: `Math.floor(plateTex[i4] * 255)`

**问题**：同一数据两种解码，激光选区选中的板块与点击选中的板块可能不同。

**修复方案**：统一为 `Math.round(plateTex[i4] * (plates.length - 1))` 或与 shader 一致。

---

## 根因 4（已确认）：Canvas2D seaLevel 硬编码为 0

**位置**：`packages/web/src/renderer/canvas2d.ts` 第 27 行 `const seaLevel = 0;`

**问题**：Canvas2D fallback 模式下，海陆判断用 0 而非实际 seaLevel（0.45），导致全陆地或全海洋的错误渲染。

**修复方案**：传入 seaLevel 参数或从 state 读取。

---

## 新一轮调查（续）— "红色地图" 谜题

### 现象
Puppeteer hook drawArrays + readPixels 显示：渲染后 81/81 像素 = `[255, 81, 55]`，
此前误判为 laserColor（[1.0, 0.32, 0.22]）通过激光块泄漏。但 consolidated-probe.mjs
在同一瞬间读取 uniform 证实 `u_laserActive = 0`（激光块被跳过），且 glError=0。

### 真实根因 5（已确认）：plateTex 通道错位 — shader 读 .a 但 boundary 在 .b

**数据布局**（`packages/shared/src/index.ts:157-160`）：
```
plateTex[i4+0] = pid * invPlateCount   // R = plateId
plateTex[i4+1] = plateTypeArr[pid]     // G = plateType
plateTex[i4+2] = boundary[i]           // B = boundary  ← 真实 boundary
plateTex[i4+3] = plateDist[i]          // A = plateDist ← shader 误读为 boundary
```

**Shader 读取**（`fs-map.frag:350, 379`）：
```glsl
boundary = plateData.a;   // BUG: .a 是 plateDist，boundary 在 .b
```

**数学验证**：
- `plateDist = sqrt(minDist)` 到最近板块中心（tectonic.ts:78），范围 ~[0, 0.35]
- 边界着色块（fs-map.frag:407-408）：
  ```glsl
  float bw = u_boundaryWidth * 0.05;          // = 0.04
  float bMask = smoothstep(bw, bw + 0.02, boundary);  // boundary 实际是 plateDist
  col = mix(col, u_boundaryColor, bMask);
  ```
- `plateDist > 0.06` 时 bMask=1 → `col = u_boundaryColor = [1, 0.3, 0.2]`
- `fragColor = vec4(pow(col, vec3(0.95)), 1.0)` → `pow([1,0.3,0.2], 0.95)` = `[1.0, 0.318, 0.216]` → `[255, 81, 55]` ✓ 精确匹配观察像素
- 仅有靠近板块中心的少数像素 `plateDist < 0.06`，bMask=0，露出真实地形（解释 draw #1 中零星的绿/蓝像素）

**影响**：u_style=0/1/3/5/6/7/8 时（不包含 2/4/9），整张地图被边界色覆盖，仅板块中心小斑点可见真实地形。

**修复方案**：shader 中 `boundary = plateData.a` → `boundary = plateData.b`（2 处：行 350、379）。

### 真实根因 6（已确认）：u_moistTex vs u_moistureTex 命名不一致

**位置**：`packages/web/src/renderer/webgl.ts:75, 118`
```typescript
u_moistTex: this._createTex(),   // 缺 "ure"
const texNames = [..., 'u_moistTex', ...];
```

**Shader 声明**（`fs-map.frag:11`）：`uniform sampler2D u_moistureTex;`（含 "ure"）

**数据流**：
1. webgl.ts render() 遍历 `this.textures`，对每个 key 查 `uniformLoc[name]`
2. `uniformLoc['u_moistTex']` = undefined（shader 无此 uniform）→ `gl.uniform1i` 被跳过
3. shader 的 `u_moistureTex` sampler 永不绑定，默认值 = 0
4. `texture(u_moistureTex, uv)` 实际采样 TEXTURE0 = u_plateTex
5. moisture = plateData.r = plateId ∈ {0, 1/8, 2/8, ..., 1}（应为 moist ∈ [0,1]）

**consolidated-probe 确认**：`u_moistureTex = 0`，`u_plateTex = 0`（同 unit）

**影响**：terrainColor/biomeColor/azgaarColor/style 4 的 moisture 全部错误（拿到 plateId），
草色/生物群落着色失真。修复根因 5 后此项变为可见 bug，必须一并修复。

**修复方案**：webgl.ts 中 `u_moistTex` → `u_moistureTex`（2 处：行 75、118）。

### 排除的假设
- ❌ H1 u_laserActive 实际为 1（consolidated-probe 同瞬间读取 = 0，确认）
- ❌ H2 laserColor 通过其他路径（shader grep：laserColor 仅在激光块内，块被跳过）
- ❌ H3 readPixels garbage（hook 在 drawArrays 后立即读，glError=0，像素稳定可复现）
- ❌ H5 激光块数学 bug（块未执行）
- ✓ H4 类似：纹理数据/通道问题导致颜色错误（实为根因 5 + 6）

---

## 新一轮调查（续 2）— laser NaN bug + 未映射 uniforms

### 真实根因 7（已确认）：distToSegment 除零导致激光开启时画布异常

**现象**：laser-smoke.mjs 确认 — `u_laserActive=1`（toggle 成功），但 `laserStart=laserEnd=[0,0]`（默认值，用户开启激光但未拖动），hook 内 7x7 中心像素 `redCount=49/49`（全红 = laserColor [255,81,55] 覆盖），帧合成后 readPixels 5x5 = `[0,0,0]`（NaN→黑）。

**位置**：`packages/web/public/shaders/fs-map.frag:325-330`
```glsl
float distToSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);  // ba=[0,0] 时 dot(ba,ba)=0 → 除零 → NaN
    return length(pa - ba * h);
}
```

**数据流**：
1. `appState.ts:105-106` 默认 `laserStart=[0,0]`, `laserEnd=[0,0]`
2. `laserController.ts:60-67` toggle() 开启 laserActive=true，但**不设置 laserStart/laserEnd**
3. 只有 handleDown/handleMove（鼠标拖动）才设置 laserStart/laserEnd
4. 用户开启激光后若未立即拖动 → laserStart==laserEnd==[0,0]
5. shader 激光块（fs-map.frag:429）调用 `distToSegment(uv*asp, [0,0]*asp, [0,0]*asp)`
6. `ba = [0,0]`, `dot(ba,ba) = 0`, `0/0 = NaN`
7. `h = clamp(NaN, 0, 1)` = NaN（implementation-defined）
8. `pa - ba*NaN = [NaN, NaN]`, `length([NaN,NaN]) = NaN`
9. `dist = NaN`, `smoothstep(..., NaN) = NaN`
10. `glow/mid/core = NaN`, `col = mix(col, laserColor, NaN)` = NaN
11. swiftshader 下 NaN 传播导致整个画布异常（drawArrays 后 buffer 显示 laserColor，合成后变黑）

**影响**：用户开启激光功能后，若未立即拖动激光线，整个画布渲染异常（全红或全黑）。这是高频触发的"诡异问题"。

**修复方案**：distToSegment 添加零长度保护：
```glsl
float distToSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float bb = dot(ba, ba);
    float h = bb > 1e-10 ? clamp(dot(pa, ba) / bb, 0.0, 1.0) : 0.0;
    return length(pa - ba * h);
}
```
当 ba 为零向量（线段退化为点）时，h=0，返回 length(pa) = 到点 a 的距离，这是合理的退化行为。

### 真实根因 8（已确认）：u_plateTotal 未映射导致选中高亮失效

**位置**：`packages/web/src/app.ts:19-52` RENDER_PARAM_MAP 缺少 `plateCount: 'u_plateTotal'`

**数据流**：
1. UIParams 有 `plateCount` 字段（appState.ts:71，默认 8）
2. RENDER_PARAM_MAP 未映射 plateCount → u_plateTotal
3. shader 中 `u_plateTotal = 0`（WebGL 未设置 uniform 默认 0）
4. `isSelected`（fs-map.frag:333）：`pid = clamp(round(plateIdNorm * max(u_plateTotal,1)), 0, max(u_plateTotal-1,0))` = `clamp(..., 0, 0)` = 0
5. 所有像素的 pid 被强制为 0 → 只有 plateId=0 的区域能被选中高亮

**影响**：板块选中功能（showSelection）失效，用户选中任意板块只高亮 plateId=0 的区域。

**修复方案**：RENDER_PARAM_MAP 添加 `plateCount: 'u_plateTotal'`。

### 次要问题：u_detail* uniforms 未映射（UI 未暴露）

**未映射列表**（UIParams 无对应字段）：
- u_detailRiverWidth, u_detailRiverCurve, u_detailCoastJagged, u_detailRidgeDensity
- u_detailRainfallOffset, u_detailTempGradient, u_detailBiomeBlend

**影响**：默认 = 0，河流细节/海岸锯齿/山脊噪声/气候细节缺失。但 UI 未暴露这些参数，属于"未完成功能"而非 bug。暂不处理。

---

## 最终验证（laser-active-probe.mjs 双采样）

### 实验
修改 laser-active-probe.mjs，hook drawArrays 后**同时**采样两种网格：
1. `pixelsCenter7x7` — 中心 7x7 密集中心采样（旧策略）
2. `pixelsFull9x9` — 全画布 9x9 均匀分布采样（与 consolidated-probe 一致）

三步对比：A=baseline (laserActive=0)、B=laser toggle (laserActive=1, start=end=[0,0])、C=drag (laserActive=1, start!=end)。

### 结果
```
Step A: laserActive=0 (baseline)
  Center 7x7: red=49 sea=0 green=0 black=0 other=0
  Full 9x9:   red=5 sea=40 green=16 black=5 other=15   ← 正常分布

Step B: laserActive=1, start=end=[0,0]
  Center 7x7: red=49 sea=0 green=0 black=0 other=0
  Full 9x9:   red=5 sea=40 green=16 black=5 other=15   ← 与 A 完全一致

Step C: laserActive=1, start!=end (drag)
  Center 7x7: red=49 sea=0 green=0 black=0 other=0
  Full 9x9:   red=5 sea=40 green=16 black=5 other=15   ← 仍然正常
```

### 结论
1. **"中心 7x7 全红"是采样假阳性**：画布中心 (W/2, H/2) 恰好落在某条板块边界上，被 boundaryColor [255,81,55] 着色（根因 5 修复后边界色正确出现在真实边界上）。这是采样位置碰巧的结果，不是 bug。
2. **laserActive=1 + start=end=[0,0] 不再破坏画布**：Step B 的全画布分布与 Step A 完全一致，且**零黑像素**（NaN→黑路径不存在）。根因 7 的 distToSegment 零长度保护生效。
3. **drag 模式也正常**：Step C 同样分布正常，激光路径只影响线段附近像素，未泄漏到全画布。
4. **Typecheck 通过、build 通过、零 console error、零 GL error**。

### 教训
- **采样策略决定诊断结论**：中心密集采样 vs 全画布均匀采样会得出截然相反的结论。多网格对比是排除假阳性的关键。
- **同瞬间读取 uniform + pixel**：drawArrays hook 后立即读 uniform 消除了时机竞争。
- **数学验证法**：`pow([1,0.3,0.2], 0.95)` = `[255,81,55]` 是 boundaryColor 的指纹，与 laserColor [1,0.32,0.22] 仅差 0.02——必须靠精确数学而非颜色相似度区分。

### 本轮修复汇总（根因 5–8 全部已修复并验证）
| 根因 | 位置 | 修复 |
|------|------|------|
| 5: plateTex 通道错位 | fs-map.frag:350,379 | `boundary = plateData.a` → `plateData.b` |
| 6: u_moistTex 命名 | webgl.ts:75,118 | `u_moistTex` → `u_moistureTex` |
| 7: distToSegment 除零 NaN | fs-map.frag:325-330 | 添加 `bb > 1e-10` 零长度保护 |
| 8: u_plateTotal 未映射 | app.ts:52 RENDER_PARAM_MAP | 添加 `plateCount: 'u_plateTotal'` |
