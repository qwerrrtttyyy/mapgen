/**
 * 状态栏与进度条管理
 */

export function setGeneratingStatus(generating: boolean, error?: string): void {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  const progOverlay = document.getElementById('progress-overlay');

  if (dot) {
    dot.classList.remove('generating', 'error');
    if (generating) dot.classList.add('generating');
    else if (error) dot.classList.add('error');
  }
  if (text) {
    if (error) text.textContent = '错误';
    else if (generating) text.textContent = '生成中...';
    else text.textContent = '就绪';
  }
  if (progOverlay) {
    progOverlay.classList.toggle('show', generating);
  }
}

export function setProgress(fraction: number, phase: string): void {
  const bar = document.getElementById('prog-fill');
  const pct = document.getElementById('prog-pct');
  const phaseEl = document.getElementById('prog-phase');
  if (bar) bar.style.width = `${Math.round(fraction * 100)}%`;
  if (pct) pct.textContent = `${Math.round(fraction * 100)}%`;
  if (phaseEl) phaseEl.textContent = phase;
}
