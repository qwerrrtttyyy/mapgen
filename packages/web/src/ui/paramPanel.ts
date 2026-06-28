import { bus } from '../core/eventBus.js';
import { state, type UIParams, patchParams } from '../core/appState.js';
import { commitParams, setParam } from '../core/actions.js';

function byId(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function hexToRgb(hex: string): number[] {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}

const RENDER_ONLY_PARAMS = new Set<string>([
  'style', 'showBoundaries', 'showRivers', 'showContours', 'showTerrain',
  'showSelection', 'showClimate', 'showGrid', 'showElevScale', 'lightAngle',
  'pointLightEnabled', 'pointLightPos', 'pointLightIntensity', 'pointLightColor',
  'glowEnabled', 'boundaryWidth', 'boundaryColor', 'contourInterval',
  'trailEnabled', 'cursorActive', 'cursorSize', 'laserActive', 'laserWidth',
  'laserSelection', 'laserColor',
]);

// Range params that affect generation — trigger regen on change (mouse release)
const GENERATION_TRIGGER_PARAMS = new Set<string>([
  'riverCount', 'rainStrength', 'windDirX', 'windDirY',
]);

// 抽出强类型 setter，调用方无需再做 unknown 断言
function setTypedParam<K extends keyof UIParams>(key: K, value: UIParams[K]): void {
  setParam(key, value);
}

export class ParamPanel {
  private unsub: (() => void)[] = [];

  bind(): void {
    this.bindRanges();
    this.bindSelects();
    this.bindCheckboxes();
    this.bindColors();
    this.bindSeed();
    this.bindCollapsibleCards();
    this.bindLaserMode();
    this.bindLaserActiveVisibility();
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
    const display = el.parentElement?.querySelector('.value');
    if (!display) return;
    display.textContent = el.value;
    // 复用 CSS 动画：移除 → reflow → 重新添加，浏览器负责清理
    display.classList.remove('changed');
    void (display as HTMLElement).offsetWidth;
    display.classList.add('changed');
  }

  // 关键：限定到 #drawer 内，避免误绑启动器/检查点面板等外部 input
  private drawerScope(): ParentNode {
    return document.getElementById('drawer') ?? document;
  }

  private bindRanges(): void {
    this.drawerScope().querySelectorAll<HTMLInputElement>('input[type="range"]').forEach(input => {
      const handler = () => {
        this.updateRangeDisplay(input);
        if (input.id === 'pointLightPosX' || input.id === 'pointLightPosY') {
          const x = parseFloat((byId('pointLightPosX') as HTMLInputElement | null)?.value ?? '0.5');
          const y = parseFloat((byId('pointLightPosY') as HTMLInputElement | null)?.value ?? '0.5');
          setTypedParam('pointLightPos', [x, y]);
        } else {
          const key = input.id as keyof UIParams;
          setTypedParam(key, parseFloat(input.value));
        }
        bus.emit('render.request');
      };
      input.addEventListener('input', handler);
      this.unsub.push(() => input.removeEventListener('input', handler));

      // Generation-affecting params: regenerate on release (change event)
      if (GENERATION_TRIGGER_PARAMS.has(input.id)) {
        const changeHandler = () => {
          commitParams();
          bus.emit('generate.request');
        };
        input.addEventListener('change', changeHandler);
        this.unsub.push(() => input.removeEventListener('change', changeHandler));
      }
    });
  }

  private bindSelects(): void {
    this.drawerScope().querySelectorAll<HTMLSelectElement>('select').forEach(select => {
      const handler = () => {
        const key = select.id as keyof UIParams;
        const num = Number(select.value);
        const val = Number.isNaN(num) ? select.value : num;
        setTypedParam(key, val);
        commitParams();
        if (RENDER_ONLY_PARAMS.has(select.id)) {
          bus.emit('render.request');
        } else {
          bus.emit('generate.request');
        }
      };
      select.addEventListener('change', handler);
      this.unsub.push(() => select.removeEventListener('change', handler));
    });
  }

  private bindCheckboxes(): void {
    this.drawerScope().querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(input => {
      const handler = () => {
        const key = input.id as keyof UIParams;
        setTypedParam(key, input.checked);
        bus.emit('render.request');
      };
      input.addEventListener('change', handler);
      this.unsub.push(() => input.removeEventListener('change', handler));
    });
  }

  private bindColors(): void {
    this.drawerScope().querySelectorAll<HTMLInputElement>('input[type="color"]').forEach(input => {
      const handler = () => {
        const key = input.id as keyof UIParams;
        setTypedParam(key, hexToRgb(input.value));
        bus.emit('render.request');
      };
      input.addEventListener('input', handler);
      this.unsub.push(() => input.removeEventListener('input', handler));
    });
  }

  private bindSeed(): void {
    const el = byId('seedStr') as HTMLInputElement | null;
    if (!el) return;
    const handler = () => setTypedParam('seedStr', el.value);
    el.addEventListener('input', handler);
    this.unsub.push(() => el.removeEventListener('input', handler));
  }

  private bindCollapsibleCards(): void {
    this.drawerScope().querySelectorAll<HTMLElement>('.md-card-title').forEach(title => {
      const handler = () => title.classList.toggle('collapsed');
      title.addEventListener('click', handler);
      this.unsub.push(() => title.removeEventListener('click', handler));
    });
  }

  private bindLaserMode(): void {
    this.drawerScope().querySelectorAll<HTMLInputElement>('input[name="laserMode"]').forEach(input => {
      const handler = () => {
        if (input.checked) bus.emit('laser.mode.set', input.value);
      };
      input.addEventListener('change', handler);
      this.unsub.push(() => input.removeEventListener('change', handler));
    });
  }

  private bindLaserActiveVisibility(): void {
    const update = () => {
      const group = byId('laser-mode-group') as HTMLElement | null;
      if (group) group.style.display = state.params.laserActive ? '' : 'none';
    };
    update();
    this.unsub.push(bus.on('params.changed', update));
  }
}
