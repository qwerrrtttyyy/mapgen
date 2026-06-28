# Task Plan: Fix All Bugs + Improve Algorithms + Integrate p5.js

## Goal
修复所有 24 个已发现的 Bug，提升算法真实性，引入轻量 p5.js 可视化。

## Phases

### Phase 1: P0 致命 Bug 修复 (5 bugs)
Status: pending
- [ ] #1: Worley 噪声缓存无限增长 → 添加 LRU 大小限制
- [ ] #2: LaserController 事件监听器泄漏 → 在 destroy() 中移除
- [ ] #3: 右键菜单全部失效 → 实现真正的 Phase 局部重算
- [ ] #4: 河流数量参数被忽略 → 在 MapParams 中添加 riverCount
- [ ] #5: 侵蚀算法对海洋加水 → 添加高程检查

### Phase 2: P1 严重 Bug 修复 (7 bugs)
Status: pending
- [ ] #6: 检查点 base64 编码性能 → 使用批量编码
- [ ] #7: 板块选择逻辑 Bug → 修复 toggle 逻辑
- [ ] #8: 鼠标轨迹性能 → 降低分辨率
- [ ] #9: 进度条闪烁 → 使用 MessageChannel 分片
- [ ] #10: picker 温度读取 → 添加注释说明
- [ ] #11: 上下文菜单清理 → 修复 removeEventListener 引用
- [ ] #12: 错误消息持久显示 → 添加自动隐藏

### Phase 3: 体验问题修复 (7 bugs)
Status: pending
- [ ] #13: 风格切换触发重算 → 拆分渲染/生成参数
- [ ] #14: 快捷键切换风格触发重算 → 统一处理
- [ ] #15: 工具栏按钮状态不一致 → 全部禁用
- [ ] #16: 移动端手势冲突 → 添加事件目标检查
- [ ] #17: 检查点列表重复加载 → 缓存优化
- [ ] #18: 启动器进度不准确 → 基于阶段权重
- [ ] #19: 导出 PNG 阻塞 → 使用 OffscreenCanvas

### Phase 4: 算法真实性提升
Status: pending
- [ ] 改进板块构造：添加板块运动向量、俯冲带
- [ ] 改进侵蚀：增强水力侵蚀模型（多方向水流、沉积物运移）
- [ ] 改进气候：添加信风带、雨影效应、Hadley 环流
- [ ] 改进河流：D8 流向算法 + 累积流量
- [ ] 改进生物群系：更精细的 Whittaker 分类
- [ ] 改进噪声：Worley 多点 Voronoi (F1, F2-F1)

### Phase 5: 集成 p5.js
Status: pending
- [ ] 安装 p5.js 依赖
- [ ] 创建 p5.js Canvas2D 渲染器（替代当前简单版本）
- [ ] 实现 p5.js 交互式参数调校面板
- [ ] 添加 p5.js 粒子效果（降雨、火山灰）
- [ ] 实现 p5.js 动画过渡

### Phase 6: 代码质量
Status: pending
- [ ] #20-#24: 添加核心算法单元测试
- [ ] 添加 p5.js 类型声明
- [ ] 最终验证构建