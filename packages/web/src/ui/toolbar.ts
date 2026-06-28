import { bus } from '../core/eventBus.js';
import { clearSelection } from '../core/actions.js';

export class Toolbar {
  private unsub: (() => void)[] = [];

  bind(): void {
    const randomSeed = document.getElementById('btn-random-seed');
    const generate = document.getElementById('btn-generate');
    const exportBtn = document.getElementById('btn-export');
    const saveCheckpoint = document.getElementById('btn-save-checkpoint');
    const clearSelectionBtn = document.getElementById('btn-clear-selection');

    const listeners: [HTMLElement | null, () => void][] = [
      [randomSeed, () => bus.emit('randomSeed.request')],
      [generate, () => bus.emit('generate.request')],
      [exportBtn, () => bus.emit('export.request')],
      [saveCheckpoint, () => bus.emit('checkpoint.save.request')],
      [clearSelectionBtn, () => clearSelection()],
    ];

    for (const [el, handler] of listeners) {
      if (!el) continue;
      el.addEventListener('click', handler);
      this.unsub.push(() => el.removeEventListener('click', handler));
    }

    this.unsub.push(
      bus.on('generating.started', () => {
        if (generate) (generate as HTMLButtonElement).disabled = true;
        if (randomSeed) (randomSeed as HTMLButtonElement).disabled = true;
        if (exportBtn) (exportBtn as HTMLButtonElement).disabled = true;
        if (saveCheckpoint) (saveCheckpoint as HTMLButtonElement).disabled = true;
      }),
      bus.on('generating.completed', () => {
        if (generate) (generate as HTMLButtonElement).disabled = false;
        if (randomSeed) (randomSeed as HTMLButtonElement).disabled = false;
        if (exportBtn) (exportBtn as HTMLButtonElement).disabled = false;
        if (saveCheckpoint) (saveCheckpoint as HTMLButtonElement).disabled = false;
      }),
      bus.on('generating.failed', () => {
        if (generate) (generate as HTMLButtonElement).disabled = false;
        if (randomSeed) (randomSeed as HTMLButtonElement).disabled = false;
        if (exportBtn) (exportBtn as HTMLButtonElement).disabled = false;
        if (saveCheckpoint) (saveCheckpoint as HTMLButtonElement).disabled = false;
      }),
      bus.on('selection.changed', ({ plates }: { plates: number[] }) => {
        if (clearSelectionBtn) clearSelectionBtn.style.display = plates.length > 0 ? 'inline-block' : 'none';
      })
    );
  }

  destroy(): void {
    this.unsub.forEach(u => u());
    this.unsub = [];
  }
}
