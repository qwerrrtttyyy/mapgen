# MapGen Studio 国际化 (i18n) 指南

## 概述

MapGen Studio 已实现完整的国际化系统，支持以下语言：

- **zh-CN** - 简体中文（默认）
- **en-US** - 英语（美国）
- **ja-JP** - 日语

## 文件结构

```
packages/shared/src/i18n/
└── index.ts          # 核心翻译模块
```

## 使用方法

### 1. 基本翻译函数

```typescript
import { t } from '@mapgen/shared';

// 获取中文翻译（默认）
const text = t('zh-CN', 'toolbar.generate'); // "生成"

// 获取英文翻译
const textEn = t('en-US', 'toolbar.generate'); // "Generate"

// 获取日文翻译
const textJa = t('ja-JP', 'toolbar.generate'); // "生成"
```

### 2. 带参数的翻译

```typescript
import { t } from '@mapgen/shared';

// 使用参数替换
const sizeInfo = t('zh-CN', 'world.sizeInfo', {
  width: 512,
  height: 512,
  pixels: 262144,
});
// 输出："512×512 · 262,144 像素"
```

### 3. 创建绑定翻译器

```typescript
import { createTranslator } from '@mapgen/shared';

// 为特定语言创建绑定翻译器
const zh = createTranslator('zh-CN');
const en = createTranslator('en-US');

// 直接使用
zh('tabs.world'); // "世界"
en('tabs.world'); // "World"
```

### 4. 自动检测用户语言

```typescript
import { getPreferredLocale } from '@mapgen/shared';

const locale = getPreferredLocale(); // 根据浏览器设置自动检测
const translate = createTranslator(locale);
```

## 翻译键位结构

### 应用标题

- `app.title` - 应用标题
- `app.logo` - Logo 文本

### 工具栏

- `toolbar.generate` - 生成按钮
- `toolbar.random` - 随机按钮
- `toolbar.undo` - 撤销按钮
- `toolbar.redo` - 重做按钮
- `toolbar.export` - 导出按钮
- `toolbar.statusReady` - 状态文本（就绪）

### 面板标签

- `tabs.world` - 世界
- `tabs.terrain` - 地形
- `tabs.climate` - 气候
- `tabs.water` - 水文
- `tabs.render` - 渲染

### 世界设置

- `world.presets` - 世界预设
- `world.seed` - 种子
- `world.mapSize` - 地图尺寸
- `world.noiseEngine` - 噪声引擎
- `world.tectonics` - 构造
- `world.simulation` - 世界模拟

### 地形设置

- `terrain.basics` - 地形基础
- `terrain.seaLevel` - 海平面
- `terrain.erosionStrength` - 侵蚀强度

### 气候设置

- `climate.parameters` - 气候参数
- `climate.windDirection` - 风向

### 渲染设置

- `render.style` - 渲染风格
- `render.overlays` - 叠层
- `render.lighting` - 光影
- `render.laser` - 激光指针

### 编辑器工具

- `editor.view` - 查看
- `editor.brush` - 画笔
- `editor.mountain` - 山脉
- `editor.plate` - 板块
- `editor.annotate` - 标注

## 添加新语言

要添加新的语言支持，请在 `translations` 对象中添加新的语言代码和对应的翻译：

```typescript
export const translations: Record<Locale, TranslationTree> = {
  // ... 现有语言
  'fr-FR': {
    app: {
      title: 'MapGen Studio — Générateur de Monde Procédural',
      // ... 其他翻译
    },
    // ... 其他所有键的法语翻译
  },
};
```

然后在 `Locale` 类型中添加新的语言代码：

```typescript
export type Locale = 'zh-CN' | 'en-US' | 'ja-JP' | 'fr-FR';
```

## 最佳实践

1. **使用键路径而非硬编码文本**：始终使用翻译键，不要直接在 UI 中写死文本。

2. **保持翻译一致性**：确保相同概念在所有语言中使用相同的键。

3. **提供回退机制**：如果翻译缺失，系统会自动回退到英语。

4. **参数化动态内容**：对于包含数字、名称等动态内容的文本，使用参数替换。

5. **避免嵌套过深**：保持翻译键路径简洁明了。

## 在 HTML 中使用

对于静态 HTML 文件（如 `index.html`），建议：

1. 使用 `data-i18n` 属性标记需要翻译的元素：

```html
<button data-i18n="toolbar.generate">生成</button>
```

2. 在 JavaScript 中初始化时批量替换：

```typescript
import { createTranslator } from '@mapgen/shared';

function initI18n() {
  const locale = getPreferredLocale();
  const translate = createTranslator(locale);

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = translate(key);
    }
  });
}
```

## 维护翻译

- 当添加新的 UI 元素时，请同时在所有支持的语言中添加对应的翻译。
- 定期审查翻译内容，确保准确性和一致性。
- 鼓励社区贡献翻译改进。

## 示例：完整的 UI 初始化

```typescript
import { getPreferredLocale, createTranslator } from '@mapgen/shared';

class UIManager {
  private translate: ReturnType<typeof createTranslator>;

  constructor() {
    const locale = getPreferredLocale();
    this.translate = createTranslator(locale);
    this.initUI();
  }

  private initUI() {
    // 设置按钮文本
    const generateBtn = document.getElementById('btn-generate');
    if (generateBtn) {
      generateBtn.textContent = this.translate('toolbar.generate');
      generateBtn.setAttribute('title', this.translate('toolbar.generateTitle'));
    }

    // 设置标签页
    const worldTab = document.querySelector('[data-tab="world"] span');
    if (worldTab) {
      worldTab.textContent = this.translate('tabs.world');
    }

    // ... 其他 UI 元素
  }
}
```

## 故障排除

### 翻译显示为键路径

- 检查翻译键是否正确
- 确认语言包中是否存在该键
- 查看控制台是否有错误信息

### 参数未正确替换

- 确认参数名称与模板中的占位符匹配
- 检查参数值是否为字符串或数字类型

## 贡献指南

欢迎贡献新的语言翻译或改进现有翻译！请确保：

1. 翻译准确、自然
2. 保持术语一致性
3. 遵循目标语言的语法和习惯
4. 测试所有 UI 元素的显示效果
