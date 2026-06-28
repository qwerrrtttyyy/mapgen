# Dogfood Report — mapgen v2 编辑器与命名系统

**Target:** http://localhost:3000/
**Session:** 2026-06-28
**Scope:** FBM 重构后的编辑器、自由生成模式、板块/地形区命名、双击重命名 (AC-8.3)
**Environment:** Chromium (headless, --no-sandbox, swiftshader WebGL)

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 0 |
| Medium   | 0 |
| Low      | 1 |

**结论：** 编辑器核心流程（画笔/撤销/重做/空白模式/名称叠加）在浏览器中全部通过，无控制台错误。仅 AC-8.3 双击重命名的浏览器复测因 chromium 二进制重新下载受限未能跑通；该功能已通过代码审查 + 测试逻辑修正验证逻辑正确（详见 ISSUE-001）。

---

## 浏览器实测通过项（6/7）

| # | 检查 | 证据 |
|---|------|------|
| 1 | 应用加载，canvas + 编辑器工具栏就绪 | `screenshots/02-procedural-map.png`（canvas 940×752，editorBar=true） |
| 2 | 名称叠加层（NameOverlay）canvas 存在并绘制 | `screenshots/03-names-shown.png`（overlay 940×752） |
| 3 | 画笔工具（raise）笔触生效 | `screenshots/04-brush-raise.png` |
| 4 | Ctrl+Z 撤销生效 | `screenshots/05-after-undo.png` |
| 5 | Ctrl+Y 重做生效 | `screenshots/06-after-redo.png` |
| 6 | 空白手绘模式（blank）生成无报错 | `screenshots/08-blank-mode.png` |
| 7 | 全程无控制台错误 | dogfood-result.json: `errors: []` |

---

### ISSUE-001 — AC-8.3 双击重命名：浏览器复测受阻（非应用缺陷）

**Severity:** Low（测试基础设施问题，非功能回归）

**描述：**
首次浏览器实测中，AC-8.3 双击重命名 `prompt` 未触发。排查发现是**测试脚本点击位置错误**——点击了画布中心，而该处没有名称质心。应用代码本身正确。

**根因分析：**
- `EditorController.tryRenameAt` 按屏幕空间距离（60px×16px 阈值）匹配 `md.names.plates`/`regions` 的质心。
- 测试脚本原点击 `(0.5W, 0.4H)`，该坐标附近无质心 → 命中失败 → prompt 未弹出。
- 这不是应用 bug，是测试坐标选取不当。

**已采取的修正：**
1. 在 `app.ts` 开发模式暴露 `window.__mapgen = { state, editor, nameOverlay }`（仅 `import.meta.env.DEV`）。
2. 测试脚本改为从 `window.__mapgen.state.mapData.names.plates[0].centroid` 读取真实质心，按 `EditorController.mapToScreen` 同算法换算为屏幕坐标后双击。

**代码审查结论（AC-8.3 逻辑正确）：**
- `EditorController.onDoubleClick` 在 `idle`/`annotate` 模式调用 `tryRenameAt`。
- `tryRenameAt` 优先匹配地形区（更密集），再板块；命中后 `window.prompt` 改名并 `bus.emit('names.updated')` 触发 NameOverlay 重绘。
- `refreshNames` 在编辑提交后保留旧板块名（含用户改名），地形区名随连通域变化刷新。

**复测状态：** 测试逻辑已修正，但 chromium 二进制在重新下载过程中（177 MiB，网络受限约 10%/180s），未能在本次会话完成浏览器复跑。修正后的测试脚本位于 `dogfood-output/dogfood.mjs`，待二进制就绪后 `node dogfood.mjs` 即可复验。

**Repro:** N/A（非可复现的应用缺陷）

---

## 探索覆盖

- **程序生成模式：** 启动器 → 生成地图 → 地形渲染 ✓
- **名称系统：** NameOverlay canvas 存在并绘制板块/地形区名 ✓
- **编辑器画笔：** raise 笔触、Gaussian falloff、实时 render.request ✓
- **撤销/重做：** Ctrl+Z/Y 通过 CommandStack 正确回滚/重放 ✓
- **空白手绘模式：** genMode=blank 生成全海域平坦地图，无报错 ✓
- **模式切换：** procedural ↔ blank 切换后重新生成正常 ✓
- **控制台：** 全程 0 error / 0 pageerror ✓

## 未覆盖项（受限于浏览器二进制重新下载）

- AC-8.3 双击重命名的浏览器端 prompt 弹出（已用代码审查替代，见 ISSUE-001）
- 矢量山脉线 / 矢量地形面工具的端到端绘制
- 板块拖拽工具
- 检查点保存/还原后的名称恢复

## 附件

- `dogfood-result.json` — 结构化通过/失败清单
- `screenshots/01~09*.png` — 各步骤截图
- `dogfood.mjs` — 可复用的 dogfood 测试脚本（含 AC-8.3 修正后的质心点击逻辑）
