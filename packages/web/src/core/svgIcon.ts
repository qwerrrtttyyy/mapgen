// SVG 图标工具 — 统一生成线条风格图标，替代 emoji
// 使用 Lucide/Feather 风格的 24x24 viewBox path data

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 根据 path data 创建 SVG 图标元素
 * @param pathData SVG path 的 d 属性值
 * @param size 图标尺寸（px），默认 20
 * @param strokeWidth 描边宽度，默认 1.5
 */
export function createSvgIcon(pathData: string, size = 20, strokeWidth = 1.5): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', String(strokeWidth));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', pathData);
  svg.appendChild(path);
  return svg;
}

/**
 * 创建多 path 的 SVG 图标
 * @param paths 多个 path d 属性值数组
 * @param size 图标尺寸
 */
export function createSvgIconMulti(paths: string[], size = 20, strokeWidth = 1.5): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', String(strokeWidth));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}

/**
 * 渲染图标到容器，替换容器现有内容
 */
export function renderIcon(container: HTMLElement, pathData: string, size = 20): void {
  container.replaceChildren(createSvgIcon(pathData, size));
}
