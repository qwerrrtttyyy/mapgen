# 实施计划：mapgen v2

任务按依赖顺序排列，每批可独立构建验证。TDD 标记的任务先写测试再实现。

## 批次 A：FBM 体系重构（核心算法）

- [ ] 1. 搭建测试基础设施
  - 安装 vitest 到 `@mapgen/core`
  - 创建 `packages/core/src/__tests__/` 目录
  - 配置 `vitest.config.ts`
  - _Requirement: AC-1.1, AC-1.2_

- [ ] 2. 【TDD】重写 FBM 谱权重与域形变
  - 先写测试：`noise.test.ts` 验证无网格伪影（相邻像素高程差 ≤ 0.3）、ridged 山脊连通率 ≥ 70%
  - 实现 `fbmNatural()`：谱权重 `pers^i × (1 - 0.4*i/oct)`、域形变（warpStrength 递减）
  - _Requirement: AC-1.1, AC-1.2_

- [ ] 3. 【TDD】实现各向异性 ridged 噪声
  - 先写测试：沿 ridgeAngle 方向山脊连续
  - 实现各向异性采样（坐标旋转 + elongate）
  - _Requirement: AC-1.2_

- [ ] 4. 集成新 FBM 到 generateElevation
  - 替换 `erosion.ts` 中的 `noise.fbm` 调用为 `fbmNatural`
  - 陆地 ridged+standard 混合，海洋 standard
  - _Requirement: AC-1.1_

## 批次 B：板块边界平滑

- [ ] 5. 【TDD】边界过渡带
  - 先写测试：相邻板块边界 3px 内高程单调变化
  - `computeBoundaries` 输出距离场 `boundaryWidth`
  - `generateElevation` 用 smoothstep 混合板块高程
  - _Requirement: AC-4.1_

- [ ] 6. 【TDD】汇聚边界山脉走向
  - 先写测试：山脉走向与边界切向夹角 ≤ 30°
  - 沿边界切向生成 ridged 噪声山脉
  - _Requirement: AC-4.2_

## 批次 C：河流汇流

- [ ] 7. 【TDD】河流汇流检测
  - 先写测试：两河相交后下游宽度 ≥ √(上游和)
  - 追踪时遇 riverMask>0.5 则汇入，下游宽度按累积流量开方
  - _Requirement: AC-2.2_

- [ ] 8. 【TDD】入海保证与逆坡禁止
  - 先写测试：每条河终点 elevation ≤ seaLevel 或 flowDir==-1；全程高程递减
  - 源点筛选要求 accumulation ≥ 阈值
  - _Requirement: AC-2.1_

## 批次 D：气候验证

- [ ] 9. 【TDD】气候分布校验
  - 先写测试：赤道带温度≥0.7湿度≥0.6；副热带湿度≤0.4；雨影差≥0.3
  - 修正 regions.ts 阈值（已基本完成，补强校验）
  - _Requirement: AC-3.1, AC-3.2_

## 批次 E：命名系统

- [ ] 10. 【TDD】命名生成器
  - 先写测试：同一 seed 输出一致、名称唯一、格式正确
  - 实现 `naming.ts`：词库 + mulberry32 PRNG + generateNames()
  - _Requirement: AC-8.4, AC-8.5, BR-4_

- [ ] 11. 【TDD】区域检测
  - 先写测试：识别山脉/平原/高原/盆地/沙漠/森林连通域
  - 实现 `detectTerrainRegions()`：阈值分类 + 4邻接连通域 + 碎片过滤
  - _Requirement: AC-8.2_

- [ ] 12. 集成命名到 generateMap
  - generateMap 末尾调用 generateNames + detectTerrainRegions
  - 输出 NameManifest 到 MapData
  - _Requirement: AC-8.1, AC-8.2_

## 批次 F：编辑器核心

- [ ] 13. 【TDD】命令栈
  - 先写测试：push/undo/redo/max50/redoClear
  - 实现 `CommandStack.ts`
  - _Requirement: AC-9.1, AC-9.2, BR-3_

- [ ] 14. 画笔引擎
  - 实现 `BrushEngine.ts`：抬升/沉降/海陆/板块涂刷
  - 径向高斯衰减，实时更新 elevTex 通道0
  - 生成 brush Command 压栈
  - _Requirement: AC-5.1, AC-5.2, C-1_

- [ ] 15. 矢量工具
  - 实现 `VectorTool.ts`：线→山脉、多边形→地形
  - 扫描线填充，局部重算 slope
  - 生成 vector Command 压栈
  - _Requirement: AC-6.1, AC-6.2_

- [ ] 16. 板块拖拽
  - 实现 `PlateDragger.ts`：选中/平移/释放/重算边界
  - 生成 plate-move Command 压栈
  - _Requirement: AC-7.1_

## 批次 G：编辑器 UI 与集成

- [ ] 17. EditorController 状态机
  - 实现 mode 切换、工具路由、事件分发
  - _Requirement: US-5, US-6, US-7_

- [ ] 18. 编辑器工具栏 UI
  - index.html 新增编辑器工具栏（画笔/矢量/拖拽/标注 + 模式选择）
  - style.css 工具栏样式
  - _Requirement: US-5, US-6_

- [ ] 19. 名称叠加层
  - 实现 `NameOverlay.ts`：Canvas2D 叠加，双击改名
  - _Requirement: AC-8.1, AC-8.3_

- [ ] 20. 自由生成模式
  - MapParams 新增 `mode: 'procedural' | 'blank'`
  - blank 模式跳过 noise/tectonic
  - UI 单选切换
  - _Requirement: AC-10.1_

- [ ] 21. 集成到 app.ts
  - 编辑器接入主应用，键盘快捷键 Ctrl+Z/Y
  - 编辑后局部重算气候/河流（按需）
  - _Requirement: AC-9.1, AC-9.2_

## 批次 H：验证

- [ ] 22. 全量构建与类型检查
  - `npm run build` + `npm run typecheck` 通过
  - _所有 AC_

- [ ] 23. dogfood 浏览器验证
  - 启动 dev server，用 agent-browser 探索编辑器
  - 验证画笔/矢量/拖拽/命名/撤销
  - _所有 AC_

- [ ] 24. 测试套件运行
  - `npm test` 全部通过
  - _所有 AC_
