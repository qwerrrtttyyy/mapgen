import { Colleague } from '../core/mediator.js';
import { bus } from '../core/eventBus.js';
import { state } from '../core/appState.js';
import type { CheckpointManager, CheckpointData } from '../checkpoint.js';

const TRANSITION_DURATION = 300;

export class CheckpointPanel extends Colleague {
  private list: HTMLElement | null;
  private saveBtn: HTMLElement | null;
  private mgr: CheckpointManager | null = null;
  private unsub: (() => void)[] = [];

  constructor() {
    super('checkpointPanel');
    this.list = document.getElementById('checkpoint-list');
    this.saveBtn = document.getElementById('btn-save-checkpoint');
  }

  bind(mgr: CheckpointManager): void {
    this.mgr = mgr;

    this.list?.addEventListener('click', e => this.handleListClick(e));

    if (this.mediator) {
      this.bindWithMediator();
    } else {
      this.bindWithBus();
    }
  }

  private bindWithMediator(): void {
    this.unsub.push(
      this.subscribe('generating.completed', () => void this.refresh()),
      this.subscribe('checkpoint.updated', () => void this.refresh()),
      this.subscribe('checkpoint.delete.request', (id: number) => this.handleDelete(id))
    );
  }

  private bindWithBus(): void {
    this.unsub.push(
      bus.on('generating.completed', () => void this.refresh()),
      bus.on('checkpoint.updated', () => void this.refresh()),
      bus.on('checkpoint.delete.request', (id: number) => this.handleDelete(id))
    );
  }

  destroy(): void {
    this.unsub.forEach(u => u());
    this.unsub = [];
  }

  private handleListClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const item = target.closest<HTMLElement>('.checkpoint-item');
    if (!item || !this.mgr) return;
    const id = Number(item.dataset.id);
    if (Number.isNaN(id)) return;

    if (target.closest('.ck-btn-restore')) {
      if (this.mediator) {
        this.send('checkpoint.restore.request', id);
      } else {
        bus.emit('checkpoint.restore.request', id);
      }
    } else if (target.closest('.ck-btn-delete')) {
      if (this.mediator) {
        this.send('checkpoint.delete.request', id);
      } else {
        bus.emit('checkpoint.delete.request', id);
      }
    } else if (target.closest('.ck-name')) {
      this.handleRename(id, item);
    }
  }

  private handleRename(id: number, item: HTMLElement): void {
    if (!this.mgr) return;
    const ckpt = this.mgr.checkpoints[id];
    if (!ckpt) return;
    const nameEl = item.querySelector('.ck-name');
    if (!nameEl) return;
    const newName = prompt('重命名检查点:', ckpt.name);
    if (!newName || newName === ckpt.name) return;
    void this.mgr.rename(id, newName);
    nameEl.textContent = newName;
  }

  private handleDelete(id: number): void {
    if (!this.list || !this.mgr) return;
    const ckpt = this.mgr.checkpoints[id];
    if (!ckpt) return;
    if (!confirm(`确定删除检查点 "${ckpt.name}"?`)) return;

    const item = this.list.querySelector(`.checkpoint-item[data-id="${id}"]`);
    if (!item) {
      void this.doDelete(id);
      return;
    }
    item.classList.add('leaving');
    window.setTimeout(() => void this.doDelete(id), TRANSITION_DURATION);
  }

  private async doDelete(id: number): Promise<void> {
    if (!this.mgr) return;
    await this.mgr.delete(id);
    if (this.mediator) {
      this.send('checkpoint.updated');
    } else {
      bus.emit('checkpoint.updated');
    }
  }

  private formatSize(ckpt: CheckpointData): string {
    const json = JSON.stringify(ckpt);
    const bytes = new Blob([json]).size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  refresh(): void {
    if (!this.mgr || !this.list) return;

    if (this.saveBtn) {
      this.saveBtn.style.display = state.mapData ? 'inline-block' : 'none';
    }

    this.list.innerHTML = '';
    for (let i = 0; i < this.mgr.checkpoints.length; i++) {
      const c = this.mgr.checkpoints[i];
      const item = document.createElement('div');
      item.className = 'checkpoint-item entering';
      item.dataset.id = String(i);

      const thumb = document.createElement('img');
      thumb.className = 'ck-thumb';
      thumb.src = c.thumbnail || '';
      thumb.alt = '';

      const info = document.createElement('div');
      info.className = 'checkpoint-info';

      const name = document.createElement('div');
      name.className = 'ck-name';
      name.textContent = c.name;
      name.title = '点击重命名';

      const meta = document.createElement('div');
      meta.className = 'ck-meta';
      meta.textContent = `${c.phase} · ${new Date(c.time).toLocaleString('zh-CN')} · ${this.formatSize(c)}`;

      info.append(name, meta);

      const rb = document.createElement('button');
      rb.textContent = '恢复';
      rb.className = 'ck-btn-restore';
      rb.title = '恢复此检查点';

      const db = document.createElement('button');
      db.textContent = '删除';
      db.className = 'ck-btn-delete';
      db.title = '删除此检查点';

      item.append(thumb, info, rb, db);
      this.list.appendChild(item);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => item.classList.remove('entering'));
      });
    }
  }
}
