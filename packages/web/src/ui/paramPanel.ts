import { bus } from '../core/eventBus.js';
import { state, type UIParams, patchParams } from '../core/appState.js';
import { commitParams, setParam } from '../core/actions.js';

function byId(id: string) { return document.getElementById(id); }

function hexToRgb(hex: string): number[] {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}

export class ParamPanel {
  private unsub: (() => void)[] = [];

  bind(): void {
    this.bindRanges();
    this.bindNumbers();
    this.bindSelects();
    this.bindCheckboxes();
    this.bindColors();
    this.bindSeed();
    this.bindCollapsibleCards();
  }

  destroy(): void {
    this.unsub.forEach(u => u());
    this.unsub = [];
  }

  applyDefaults(): void {
    const p = state.params;
    for (const [key, value] of Object.entries(p)) {
      this.setInputValue(key, value);
    }
    this.setInputValue('pointLightPosX', p.pointLightPos[0]);
    this.setInputValue('pointLightPosY', p.pointLightPos[1]);
  }

  private setInputValue(key: string, value: unknown): void {
    const el = byId(key);
    if (!el) return;
    if (el instanceof HTMLInputElement) {
      if (el.type === 'range' || el.type === 'number') {
        el.value = String(value);
        this.updateRangeDisplay(el);
      } else if (el.type === 'checkbox') {
        el.checked = Boolean(value);
      } else if (el.type === 'color' && Array.isArray(value)) {
        el.value = rgbToHex(value[0], value[1], value[2]);
      } else if (el.type === 'text') {
        el.value = String(value);
      }
    } else if (el instanceof HTMLSelectElement) {
      el.value = String(value);
    }
  }

  private updateRangeDisplay(el: HTMLInputElement): void {
    const display = el.parentElement?.querySelector('.value') as HTMLElement | null;
    if (!display) return;
    display.textContent = el.value;
    display.classList.add('changed');
    window.setTimeout(() => display.classList.remove('changed'), 150);
  }

  private bindRanges(): void {
    document.querySelectorAll('input[type="range"]').forEach(el => {
      const input = el as HTMLInputElement;
      const handler = () => {
        this.updateRangeDisplay(input);
        const val = parseFloat(input.value);
        if (input.id === 'pointLightPosX' || input.id === 'pointLightPosY') {
          const x = parseFloat((byId('pointLightPosX') as HTMLInputElement).value);
          const y = parseFloat((byId('pointLightPosY') as HTMLInputElement).value);
          setParam('pointLightPos', [x, y]);
        } else {
          const key = input.id as keyof UIParams;
          setParam(key, val as unknown as UIParams[keyof UIParams]);
        }
        bus.emit('render.request');
      };
      input.addEventListener('input', handler);
      this.unsub.push(() => input.removeEventListener('input', handler));
    });
  }

  private bindNumbers(): void {
    document.querySelectorAll('input[type="number"]').forEach(el => {
      const input = el as HTMLInputElement;
      const handler = () => {
        const key = input.id as keyof UIParams;
        setParam(key, parseFloat(input.value) as unknown as UIParams[keyof UIParams]);
        bus.emit('render.request');
      };
      input.addEventListener('input', handler);
      this.unsub.push(() => input.removeEventListener('input', handler));
    });
  }

  private bindSelects(): void {
    document.querySelectorAll('select').forEach(el => {
      const select = el as HTMLSelectElement;
      const handler = () => {
        const key = select.id as keyof UIParams;
        const num = Number(select.value);
        const val = Number.isNaN(num) ? select.value : num;
        setParam(key, val as unknown as UIParams[keyof UIParams]);
        commitParams();
        bus.emit('generate.request');
      };
      select.addEventListener('change', handler);
      this.unsub.push(() => select.removeEventListener('change', handler));
    });
  }

  private bindCheckboxes(): void {
    document.querySelectorAll('input[type="checkbox"]').forEach(el => {
      const input = el as HTMLInputElement;
      const handler = () => {
        const key = input.id as keyof UIParams;
        setParam(key, input.checked as unknown as UIParams[keyof UIParams]);
        bus.emit('render.request');
      };
      input.addEventListener('change', handler);
      this.unsub.push(() => input.removeEventListener('change', handler));
    });
  }

  private bindColors(): void {
    document.querySelectorAll('input[type="color"]').forEach(el => {
      const input = el as HTMLInputElement;
      const handler = () => {
        const key = input.id as keyof UIParams;
        setParam(key, hexToRgb(input.value) as unknown as UIParams[keyof UIParams]);
        bus.emit('render.request');
      };
      input.addEventListener('input', handler);
      this.unsub.push(() => input.removeEventListener('input', handler));
    });
  }

  private bindSeed(): void {
    const el = byId('seedStr') as HTMLInputElement | null;
    if (!el) return;
    const handler = () => setParam('seedStr', el.value);
    el.addEventListener('input', handler);
    this.unsub.push(() => el.removeEventListener('input', handler));
  }

  private bindCollapsibleCards(): void {
    document.querySelectorAll('.md-card-title').forEach(el => {
      const title = el as HTMLElement;
      const handler = () => {
        title.classList.toggle('collapsed');
      };
      title.addEventListener('click', handler);
      this.unsub.push(() => title.removeEventListener('click', handler));
    });
  }
}
