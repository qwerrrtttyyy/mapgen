export type ThemeId = 'dark' | 'light' | 'aurora';

const STORAGE_KEY = 'mapgen:theme';

const THEMES: ReadonlyArray<{ id: ThemeId; name: string }> = [
  { id: 'dark', name: '深色' },
  { id: 'light', name: '浅色' },
  { id: 'aurora', name: '极光' },
];

const DEFAULT_THEME: ThemeId = 'dark';

function isThemeId(value: unknown): value is ThemeId {
  return value === 'dark' || value === 'light' || value === 'aurora';
}

/**
 * 可切换的主题管理器。保留与现有 Material Design 3 主题的切换性：
 * 通过在 `<html>` 元素上设置 `data-theme` 属性，让 `theme.css` 中的
 * `:root[data-theme="..."]` 选择器覆盖 `style.css` 里 `:root` 的默认值。
 */
export class ThemeManager {
  private current: ThemeId;

  constructor() {
    this.current = this.readStored();
    this.apply(this.current);
  }

  private readStored(): ThemeId {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (isThemeId(raw)) return raw;
    } catch {
      // localStorage 不可用或被禁用时回退到默认主题
    }
    return DEFAULT_THEME;
  }

  private apply(id: ThemeId): void {
    document.documentElement.setAttribute('data-theme', id);
  }

  getTheme(): ThemeId {
    return this.current;
  }

  setTheme(id: ThemeId): void {
    this.current = id;
    this.apply(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // 持久化失败时忽略，仅作用于当前会话
    }
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: id } }));
  }

  toggleTheme(): void {
    const ids = THEMES.map(t => t.id);
    const idx = ids.indexOf(this.current);
    const next = ids[(idx + 1) % ids.length];
    this.setTheme(next);
  }

  getAvailableThemes(): { id: ThemeId; name: string }[] {
    return THEMES.map(t => ({ id: t.id, name: t.name }));
  }
}
