import { describe, it, expect, beforeEach } from 'vitest';
import { Tooltip } from '../tooltip.js';

describe('Tooltip', () => {
  let tooltip: Tooltip;

  beforeEach(() => {
    document.body.innerHTML = '';
    tooltip = new Tooltip(document.body);
  });

  it('show() sets display to block', () => {
    tooltip.show(['hello', 'world'], 10, 10);

    const el = document.querySelector('.map-tooltip') as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.style.display).toBe('block');
  });

  it('show() builds content via textContent and does not parse HTML', () => {
    const malicious = '<script>alert(1)</script><img src=x onerror=alert(1)>';
    tooltip.show([malicious], 10, 10);

    const el = document.querySelector('.map-tooltip') as HTMLElement;

    // No actual script/img elements should be created
    expect(el.querySelectorAll('script')).toHaveLength(0);
    expect(el.querySelectorAll('img')).toHaveLength(0);

    // The raw HTML string should appear verbatim as text
    expect(el.textContent).toContain('<script>alert(1)</script>');
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('show() joins multiple lines with <br> elements', () => {
    tooltip.show(['line1', 'line2', 'line3'], 10, 10);

    const el = document.querySelector('.map-tooltip') as HTMLElement;
    const spans = el.querySelectorAll('span');
    const brs = el.querySelectorAll('br');

    expect(spans).toHaveLength(3);
    expect(brs).toHaveLength(2);
    expect(spans[0].textContent).toBe('line1');
    expect(spans[1].textContent).toBe('line2');
    expect(spans[2].textContent).toBe('line3');
  });

  it('show() does nothing while pinned', () => {
    tooltip.pin(['pinned content'], 10, 10);
    tooltip.show(['should be ignored'], 20, 20);

    const el = document.querySelector('.map-tooltip') as HTMLElement;
    const spans = el.querySelectorAll('span');
    expect(spans).toHaveLength(1);
    expect(spans[0].textContent).toBe('pinned content');
  });

  it('pin() adds the hint child element', () => {
    tooltip.pin(['content'], 10, 10);

    const el = document.querySelector('.map-tooltip') as HTMLElement;
    const hint = el.querySelector('.map-tooltip-hint');

    expect(hint).not.toBeNull();
    expect(hint?.textContent).toBe('再次点击取消固定');
    expect(el.style.display).toBe('block');
  });

  it('pin() sets pinned state to true', () => {
    expect(tooltip.isPinned()).toBe(false);
    tooltip.pin(['content'], 10, 10);
    expect(tooltip.isPinned()).toBe(true);
  });

  it('hide() sets display to none', () => {
    tooltip.show(['content'], 10, 10);
    const el = document.querySelector('.map-tooltip') as HTMLElement;
    expect(el.style.display).toBe('block');

    tooltip.hide();
    expect(el.style.display).toBe('none');
  });

  it('hide() does nothing while pinned', () => {
    tooltip.pin(['content'], 10, 10);
    tooltip.hide();

    const el = document.querySelector('.map-tooltip') as HTMLElement;
    expect(el.style.display).toBe('block');
  });

  it('unpin() resets pinned state', () => {
    tooltip.pin(['content'], 10, 10);
    expect(tooltip.isPinned()).toBe(true);

    tooltip.unpin();
    expect(tooltip.isPinned()).toBe(false);

    const el = document.querySelector('.map-tooltip') as HTMLElement;
    expect(el.style.display).toBe('none');
  });

  it('togglePin() pins when not pinned and unpins when pinned', () => {
    expect(tooltip.isPinned()).toBe(false);

    tooltip.togglePin(['content'], 10, 10);
    expect(tooltip.isPinned()).toBe(true);

    const el = document.querySelector('.map-tooltip') as HTMLElement;
    expect(el.querySelectorAll('.map-tooltip-hint')).toHaveLength(1);

    tooltip.togglePin(['content'], 10, 10);
    expect(tooltip.isPinned()).toBe(false);
    expect(el.style.display).toBe('none');
  });
});
