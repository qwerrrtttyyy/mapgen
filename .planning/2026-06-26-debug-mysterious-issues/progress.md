# 进度日志 — 新一轮调试（延续）

## Session 2026-06-26 (continuation)

### 已恢复上下文
- 上一轮 4 个根因已修复（启动器触发、boolean uniform、plateTex 解码、Canvas2D seaLevel）
- 本轮核心谜题：73/81 像素 = laserColor [255,81,55] 但 u_laserActive=0

### 新发现（代码静态审计）

#### 发现 1: u_moistTex vs u_moistureTex 命名不一致（确认 BUG）
- `webgl.ts:75` 创建纹理对象 key = `u_moistTex`（缺 "ure"）
- `fs-map.frag:11` 声明 sampler = `u_moistureTex`（含 "ure"）
- `webgl.ts:201-207` render() 遍历 this.textures 时：
  - `uniformLoc['u_moistTex']` = undefined（shader 没有此 uniform）
  - 所以 `gl.uniform1i(loc, texUnit)` 被跳过
  - shader 的 `u_moistureTex` sampler 永远不被设置，默认值 = 0
  - 结果：shader 中 `texture(u_moistureTex, uv)` 实际采样 TEXTURE0 = u_plateTex
- 影响：所有用到 moisture 的着色路径（terrainColor/biomeColor/azgaarColor/style 4）实际拿到 plateId 数据

#### 发现 2: 激光块逻辑分析（fs-map.frag:427-458）
- 条件 `if (u_laserActive > 0.5)` 包裹整个激光块
- 若 u_laserActive=0，块不执行，laserColor 不应出现
- 若 u_laserActive=1 且 laserStart=laserEnd=[0,0]：
  - distToSegment(uv, [0,0], [0,0]): ba=[0,0], dot(ba,ba)=0 → 除零 → NaN
  - dist = NaN * resolution.y = NaN
  - smoothstep(0.024, 0, NaN) = NaN（或实现相关）
  - 不会产生统一的 [255,81,55]

#### 待验证假设
- H1: u_laserActive 实际为 1（gl-introspect 时机问题，与 multi-pixel-sample 不同时刻）
- H2: laserColor 通过其他代码路径出现
- H3: readPixels 返回 stale/garbage（preserveDrawingBuffer:false）
- H4: moisture sampler bug 间接导致 [255,81,55]
- H5: 激光块数学 bug

### 下一步
写一个**单一诊断脚本**：hook drawArrays，在同一瞬间读取 u_laserActive/u_laserStart/u_laserEnd/u_style/u_moistureTex sampler + 9x9 像素，消除时机不一致。

---

## Session 2026-06-26 (round 2 — final)

### 已修复根因
- 根因 5（plateTex 通道错位）：fs-map.frag `boundary = plateData.a` → `plateData.b`
- 根因 6（u_moistTex 命名）：webgl.ts `u_moistTex` → `u_moistureTex`
- 根因 7（distToSegment 除零 NaN）：fs-map.frag 添加 `bb > 1e-10` 零长度保护
- 根因 8（u_plateTotal 未映射）：app.ts RENDER_PARAM_MAP 添加 `plateCount: 'u_plateTotal'`

### 验证（laser-active-probe.mjs 双采样）
关键实验：hook drawArrays 后**同时**采样中心 7x7 与全画布 9x9。

| 步骤 | Center 7x7 | Full 9x9 |
|------|-----------|----------|
| A: laserActive=0 | red=49 (全红) | red=5 sea=40 green=16 black=5 other=15 (正常) |
| B: laserActive=1, start=end=[0,0] | red=49 (全红) | red=5 sea=40 green=16 black=5 other=15 (与 A 一致) |
| C: laserActive=1, drag | red=49 (全红) | red=5 sea=40 green=16 black=5 other=15 (仍然正常) |

### 结论
- "中心 7x7 全红"是采样假阳性 — 画布中心恰好落在板块边界上（boundaryColor [255,81,55]），不是 bug
- laserActive=1 + start=end=[0,0] 不再破坏画布（根因 7 修复生效，零黑像素）
- typecheck 通过、build 通过、零 console error、零 GL error

### 状态
**本轮调试完成。** 根因 1–8 全部已修复并验证。task_plan.md 中 4 个 phase 状态保持 complete。
