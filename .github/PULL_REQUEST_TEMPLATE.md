# Pull Request Template

## 📋 描述

简要描述此 PR 的目的和变更内容。

## 🎯 变更类型

请勾选适用的变更类型：

- [ ] 🐛 Bug 修复 (non-breaking change which fixes an issue)
- [ ] ✨ 新功能 (non-breaking change which adds functionality)
- [ ] 💥 破坏性变更 (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 文档更新
- [ ] 🎨 代码风格/格式调整
- [ ] ♻️ 代码重构
- [ ] ⚡ 性能优化
- [ ] ✅ 测试添加/修改
- [ ] 🔧 配置/工具变更

## 🧪 测试

请描述您如何验证此变更：

- [ ] 本地开发测试通过 (`npm run dev`)
- [ ] TypeScript 类型检查通过 (`npm run typecheck`)
- [ ] 单元测试通过 (`npm run test`)
- [ ] 构建成功 (`npm run build`)
- [ ] ESLint 检查通过 (`npm run lint`)
- [ ] Prettier 格式化通过 (`npm run format:check`)

**测试覆盖率变化**：
- 新增测试用例：XX 个
- 总测试用例：XX 个

## 📸 截图（如有 UI 变更）

请附上变更前后的截图对比。

| Before | After |
|--------|-------|
|        |       |

## 🔗 相关链接

- 相关 Issue: #XX
- 相关设计文档: [链接]
- 相关需求文档: [链接]

## ✅ Checklist

请确认以下检查项已完成：

- [ ] 代码遵循项目编码规范
- [ ] 已添加必要的注释和文档
- [ ] 新增功能已添加对应测试
- [ ] 所有测试用例通过
- [ ] 无 TypeScript 类型错误
- [ ] 无 ESLint 错误
- [ ] 无控制台警告/错误
- [ ] 更新了 CHANGELOG.md（如适用）
- [ ] 更新了 README.md（如适用）

## 🚀 发布说明

请为此变更编写简要的发布说明（如适用）：

```markdown
### v0.0.X

**新增功能**：
- ...

**Bug 修复**：
- ...

**性能优化**：
- ...

**文档更新**：
- ...
```