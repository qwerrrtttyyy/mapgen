# 调试任务 — 不明原因的诡异问题

> 目标：系统化定位并修复用户报告的"诡异问题"。
> 方法：systematic-debugging 四阶段（根因调查 → 模式分析 → 假设验证 → 实现修复）。
> 创建：2026-06-26

---

## 铁律
**没有完成 Phase 1 根因调查，不得提出修复方案。**

## 阶段

### Phase 1: 根因调查（证据收集）— `complete`
- [x] 1.1 Puppeteer 深度探测：捕获所有 console、pageerror、requestfailed、response 4xx/5xx
- [x] 1.2 交互流程测试：启动器 → 生成 → 激光 → 检查点 → 参数调整 → 导出
- [x] 1.3 静态代码审计：搜索潜在 race condition、null 解引用、未捕获 Promise
- [x] 1.4 汇总证据到 findings.md，定位失败组件（4 个根因）

### Phase 2: 模式分析 — `complete`
- [x] 2.1 对比工作正常的代码路径与异常路径（shader float vs JS boolean）
- [x] 2.2 列出所有差异

### Phase 3: 假设与测试 — `complete`
- [x] 3.1 形成单一假设（4 个独立根因）
- [x] 3.2 最小变更验证（GL errors 12→0）

### Phase 4: 实现修复 — `complete`
- [x] 4.1 创建失败测试用例（Puppeteer 复现脚本）
- [x] 4.2 实施单一修复（4 个根因逐一修复）
- [x] 4.3 验证：typecheck + build + Puppeteer 回归（全通过）

---

## 当前状态
- 预览服务器：http://localhost:3000/ (vite preview，生产构建)
- 用户描述："还是会出现一些诡异的问题，不明原因"
- 待补充：用户尚未说明具体现象，先用 Puppeteer 主动探测
