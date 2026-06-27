import { describe, it, expect, beforeEach } from 'vitest';
import { ThemeManager } from '../themeManager.js';

describe('ThemeManager', () => {
  let manager: ThemeManager;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    manager = new ThemeManager();
  });

  it('defaults to dark theme when nothing is persisted', () => {
    expect(manager.getTheme()).toBe('dark');
  });

  it('getTheme returns the theme set by setTheme', () => {
    manager.setTheme('light');
    expect(manager.getTheme()).toBe('light');
    manager.setTheme('aurora');
    expect(manager.getTheme()).toBe('aurora');
  });

  it('setTheme sets data-theme attribute on document.documentElement', () => {
    manager.setTheme('aurora');
    expect(document.documentElement.getAttribute('data-theme')).toBe('aurora');

    manager.setTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('persists the theme to localStorage under mapgen:theme', () => {
    manager.setTheme('light');
    expect(localStorage.getItem('mapgen:theme')).toBe('light');

    manager.setTheme('aurora');
    expect(localStorage.getItem('mapgen:theme')).toBe('aurora');
  });

  it('constructor reads and applies the persisted theme', () => {
    localStorage.setItem('mapgen:theme', 'aurora');

    const restored = new ThemeManager();

    expect(restored.getTheme()).toBe('aurora');
    expect(document.documentElement.getAttribute('data-theme')).toBe('aurora');
  });

  it('toggleTheme cycles through the themes', () => {
    expect(manager.getTheme()).toBe('dark');

    manager.toggleTheme();
    expect(manager.getTheme()).toBe('light');

    manager.toggleTheme();
    expect(manager.getTheme()).toBe('aurora');

    manager.toggleTheme();
    expect(manager.getTheme()).toBe('dark');
  });

  it('getAvailableThemes returns 3 themes with stable ids', () => {
    const themes = manager.getAvailableThemes();

    expect(themes).toHaveLength(3);
    expect(themes.map(t => t.id)).toEqual(['dark', 'light', 'aurora']);
    themes.forEach(t => {
      expect(typeof t.name).toBe('string');
      expect(t.name.length).toBeGreaterThan(0);
    });
  });

  it('dispatches a themechange CustomEvent with the new theme on setTheme', () => {
    const received: { theme: string }[] = [];
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { theme: string };
      received.push(detail);
    };
    window.addEventListener('themechange', handler);

    manager.setTheme('light');

    window.removeEventListener('themechange', handler);

    expect(received).toEqual([{ theme: 'light' }]);
  });
});
