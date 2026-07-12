/**
 * UI Optimizer — 轻量级响应式状态管理与 DOM 绑定工具。
 *
 * ## 设计目标
 *
 * 1. **单一响应式状态** — 替代全局可变 `state` + 双事件系统（Bus/Mediator）
 * 2. **声明式 DOM 绑定** — 替代 `$('id')` + 手动 addEventListener 样板代码
 * 3. **批量更新** — 状态变更合并到下一帧渲染，避免抖动
 * 4. **类型安全** — 完整 TypeScript 类型推导
 *
 * ## 使用示例
 *
 * ```ts
 * // 定义 store
 * const store = createStore({
 *   count: 0,
 *   name: 'mapgen',
 * });
 *
 * // 绑定到 DOM
 * bindText(store, 'count', '#countEl', v => `计数: ${v}`);
 * bindInput(store, 'name', '#nameInput');
 *
 * // 更新状态（自动触发绑定的 DOM 更新）
 * store.count = 5;
 * store.patch({ name: 'new name' });
 * ```
 *
 * @module ui-optimizer
 */

// ── 类型工具 ──

/** 从对象类型中提取值类型为 `number` 的键 */
type NumberKeys<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T];
/** 从对象类型中提取值类型为 `boolean` 的键 */
type BooleanKeys<T> = { [K in keyof T]: T[K] extends boolean ? K : never }[keyof T];
/** 从对象类型中提取值类型为 `string` 的键 */
type StringKeys<T> = { [K in keyof T]: T[K] extends string ? K : never }[keyof T];
/** 从对象类型中提取值类型为 `number[]` 的键 */
type NumberArrayKeys<T> = { [K in keyof T]: T[K] extends number[] ? K : never }[keyof T];

// ── 工具：跨环境调度（浏览器用 queueMicrotask，Node.js 测试也支持）──

const _scheduleMicro: (fn: () => void) => void =
  typeof queueMicrotask !== 'undefined' ? queueMicrotask : (fn: () => void) => setTimeout(fn, 0);

// ── 响应式 Store ──

type Subscriber<S> = (state: Readonly<S>) => void;

export interface Store<S extends Record<string, unknown>> {
  /** 当前状态快照（只读，通过 `patch` 或直接赋值修改） */
  readonly state: Readonly<S>;
  /** 订阅状态变更，返回取消订阅函数 */
  subscribe: (listener: Subscriber<S>) => () => void;
  /** 批量更新状态，合并到下一帧统一通知 */
  patch: (partial: Partial<S>) => void;
  /** 重置到初始状态 */
  reset: () => void;
  /** 获取原始值（用于非响应式读取） */
  get: <K extends keyof S>(key: K) => S[K];
}

/**
 * 创建一个响应式 Store。
 *
 * 返回的 `store` 对象可直接读写属性触发更新：
 * ```ts
 * const store = createStore({ count: 0 });
 * store.count = 5;           // 触发更新
 * console.log(store.count);  // 5
 * ```
 */
export function createStore<S extends Record<string, unknown>>(initial: S): Store<S> & S {
  let _state = { ...initial };
  const subscribers = new Set<Subscriber<S>>();
  let pending: Partial<S> | null = null;
  let pendingScheduled = false;

  function notify() {
    const snapshot = { ..._state } as Readonly<S>;
    for (const fn of subscribers) {
      try {
        fn(snapshot);
      } catch (err) {
        console.error('[Store] subscriber error:', err);
      }
    }
  }

  function flush() {
    pendingScheduled = false;
    if (pending) {
      _state = { ..._state, ...pending };
      pending = null;
      notify();
    }
  }

  function schedule(patch: Partial<S>) {
    pending = { ...pending, ...patch };
    if (!pendingScheduled) {
      pendingScheduled = true;
      _scheduleMicro(flush);
    }
  }

  const store: Store<S> & Record<string | symbol, unknown> = {
    get state() {
      return _state as Readonly<S>;
    },
    subscribe(listener: Subscriber<S>) {
      subscribers.add(listener);
      return () => {
        subscribers.delete(listener);
      };
    },
    patch(partial: Partial<S>) {
      schedule(partial);
    },
    reset() {
      schedule({ ...initial } as Partial<S>);
    },
    get<K extends keyof S>(key: K): S[K] {
      return _state[key];
    },
  };

  // 为每个初始属性创建 getter/setter，实现直接读写触发响应式更新
  for (const key of Object.keys(initial)) {
    Object.defineProperty(store, key, {
      enumerable: true,
      configurable: true,
      get() {
        return _state[key];
      },
      set(value: unknown) {
        schedule({ [key]: value } as Partial<S>);
      },
    });
  }

  return store as unknown as Store<S> & S;
}

// ── DOM 绑定工具 ──

type Formatter<T> = (value: T) => string;

/**
 * 将 store 中的某个字段绑定到元素的文本内容。
 * 可选 `format` 函数格式化输出。
 */
export function bindText<S extends Record<string, unknown>, K extends keyof S>(
  store: Store<S> & S,
  key: K,
  selector: string,
  format?: Formatter<S[K]>
): () => void {
  const el = document.querySelector(selector);
  if (!el) {
    console.warn(`[bindText] 未找到元素: ${selector}`);
    return () => {};
  }
  return store.subscribe(() => {
    const val = store.get(key);
    (el as HTMLElement).textContent = format ? format(val) : String(val);
  });
}

/**
 * 将 store 中的数字字段绑定到元素的 `value` 属性（用于 `<input>` / `<output>`）。
 */
export function bindNumber<S extends Record<string, unknown>>(
  store: Store<S> & S,
  key: NumberKeys<S>,
  selector: string,
  options?: {
    /** 输入变化时同步回 store */
    sync?: boolean;
    /** 值格式化 */
    format?: Formatter<number>;
    /** 最小值 */
    min?: number;
    /** 最大值 */
    max?: number;
  }
): () => void {
  const el = document.querySelector(selector);
  if (!el) {
    console.warn(`[bindNumber] 未找到元素: ${selector}`);
    return () => {};
  }
  const input = el as HTMLInputElement;

  // store → DOM
  const unsub = store.subscribe(() => {
    let val = store.get(key as keyof S) as unknown as number;
    if (options?.min !== undefined) val = Math.max(options.min, val);
    if (options?.max !== undefined) val = Math.min(options.max, val);
    input.value = options?.format ? options.format(val) : String(val);
  });

  // DOM → store
  if (options?.sync !== false) {
    const handler = () => {
      let val = parseFloat(input.value);
      if (isNaN(val)) return;
      if (options?.min !== undefined) val = Math.max(options.min, val);
      if (options?.max !== undefined) val = Math.min(options.max, val);
      (store as unknown as Record<string, unknown>)[key as string] = val;
    };
    input.addEventListener('input', handler);
    input.addEventListener('change', handler);
    return () => {
      unsub();
      input.removeEventListener('input', handler);
      input.removeEventListener('change', handler);
    };
  }

  return unsub;
}

/**
 * 将 store 中的布尔字段绑定到元素的 `checked` 属性（用于 `<input type="checkbox">`）。
 */
export function bindCheckbox<S extends Record<string, unknown>>(
  store: Store<S> & S,
  key: BooleanKeys<S>,
  selector: string
): () => void {
  const el = document.querySelector(selector);
  if (!el) {
    console.warn(`[bindCheckbox] 未找到元素: ${selector}`);
    return () => {};
  }
  const input = el as HTMLInputElement;

  const unsub = store.subscribe(() => {
    input.checked = store.get(key as keyof S) as unknown as boolean;
  });

  const handler = () => {
    (store as unknown as Record<string, unknown>)[key as string] = input.checked;
  };
  input.addEventListener('change', handler);

  return () => {
    unsub();
    input.removeEventListener('change', handler);
  };
}

/**
 * 将 store 中的字符串字段绑定到输入框。
 */
export function bindString<S extends Record<string, unknown>>(
  store: Store<S> & S,
  key: StringKeys<S>,
  selector: string
): () => void {
  const el = document.querySelector(selector);
  if (!el) {
    console.warn(`[bindString] 未找到元素: ${selector}`);
    return () => {};
  }
  const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

  const unsub = store.subscribe(() => {
    input.value = String(store.get(key as keyof S) ?? '');
  });

  const handler = () => {
    (store as unknown as Record<string, unknown>)[key as string] = input.value;
  };
  input.addEventListener('input', handler);
  input.addEventListener('change', handler);

  return () => {
    unsub();
    input.removeEventListener('input', handler);
    input.removeEventListener('change', handler);
  };
}

/**
 * 将 store 中的数字数组字段绑定到多个 `<input type="range">` 或 `<input type="number">`。
 * 按数组下标一一对应：`selectors[0]` ↔ `value[0]`。
 */
export function bindNumberArray<S extends Record<string, unknown>>(
  store: Store<S> & S,
  key: NumberArrayKeys<S>,
  selectors: string[],
  options?: {
    min?: number;
    max?: number;
    step?: number;
  }
): () => void {
  const els = selectors.map(s => document.querySelector(s)).filter(Boolean) as HTMLInputElement[];
  if (els.length === 0) {
    console.warn(`[bindNumberArray] 未找到任何元素: ${selectors.join(', ')}`);
    return () => {};
  }

  const unsub = store.subscribe(() => {
    const arr = store.get(key as keyof S) as unknown as number[];
    els.forEach((el, i) => {
      if (i < arr.length) el.value = String(arr[i]);
    });
  });

  const handlers = els.map((el, i) => {
    const handler = () => {
      const arr = [...(store.get(key as keyof S) as unknown as number[])];
      let val = parseFloat(el.value);
      if (isNaN(val)) return;
      if (options?.min !== undefined) val = Math.max(options.min, val);
      if (options?.max !== undefined) val = Math.min(options.max, val);
      arr[i] = val;
      (store as unknown as Record<string, unknown>)[key as string] = arr;
    };
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
    return [el, handler] as const;
  });

  return () => {
    unsub();
    for (const [el, handler] of handlers) {
      el.removeEventListener('input', handler);
      el.removeEventListener('change', handler);
    }
  };
}

/**
 * 将 store 中的字段绑定到元素的 CSS class 切换。
 * 当 `store[key] === value` 时添加 `className`，否则移除。
 */
export function bindClass<S extends Record<string, unknown>, K extends keyof S>(
  store: Store<S> & S,
  key: K,
  selector: string,
  className: string,
  expectedValue: S[K]
): () => void {
  const el = document.querySelector(selector);
  if (!el) {
    console.warn(`[bindClass] 未找到元素: ${selector}`);
    return () => {};
  }
  return store.subscribe(() => {
    const val = store.get(key);
    el.classList.toggle(className, val === expectedValue);
  });
}

/**
 * 将 store 中的字段绑定到元素的属性。
 */
export function bindAttr<S extends Record<string, unknown>, K extends keyof S>(
  store: Store<S> & S,
  key: K,
  selector: string,
  attr: string,
  format?: Formatter<S[K]>
): () => void {
  const el = document.querySelector(selector);
  if (!el) {
    console.warn(`[bindAttr] 未找到元素: ${selector}`);
    return () => {};
  }
  return store.subscribe(() => {
    const val = store.get(key);
    (el as HTMLElement).setAttribute(attr, format ? format(val) : String(val));
  });
}

/**
 * 将 store 中的字段绑定到元素的 `disabled` 状态。
 */
export function bindDisabled<S extends Record<string, unknown>, K extends keyof S>(
  store: Store<S> & S,
  key: K,
  selector: string,
  /** 当 `store[key] === true` 时禁用 */
  invert?: boolean
): () => void {
  const el = document.querySelector(selector);
  if (!el) {
    console.warn(`[bindDisabled] 未找到元素: ${selector}`);
    return () => {};
  }
  return store.subscribe(() => {
    const val = store.get(key);
    (el as HTMLInputElement).disabled = invert ? !val : !!val;
  });
}

// ── 工具函数 ──

/**
 * 创建一个节流函数。在 `wait` ms 内多次调用只会执行一次。
 */
export function throttle<T extends (...args: never[]) => void>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      last = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn(...args);
      }, remaining);
    }
  };
}

/**
 * 创建一个防抖函数。最后一次调用后等待 `wait` ms 才执行。
 */
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };
}

/**
 * 批量操作 DOM 更新（写入时强制同步 layout，避免 layout thrashing）。
 * 用法：所有读操作先做，然后 `batchDOMWrite` 执行所有写操作。
 */
export function batchDOMWrite(operations: (() => void)[]): void {
  // 强制同步 layout（读操作在此前完成）
  void document.body.offsetHeight;
  for (const op of operations) {
    op();
  }
}

/**
 * 将模板字符串渲染为 DOM 元素并挂载到父节点。
 * 支持 `%attr%` 占位符替换。
 */
export function renderTemplate(
  html: string,
  parent: HTMLElement,
  vars?: Record<string, string>
): HTMLElement {
  let content = html;
  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      content = content.replace(new RegExp(`%${key}%`, 'g'), value);
    }
  }
  const temp = document.createElement('div');
  temp.innerHTML = content.trim();
  const el = temp.firstElementChild as HTMLElement;
  parent.appendChild(el);
  return el;
}

export default {
  createStore,
  bindText,
  bindNumber,
  bindCheckbox,
  bindString,
  bindNumberArray,
  bindClass,
  bindAttr,
  bindDisabled,
  throttle,
  debounce,
  batchDOMWrite,
  renderTemplate,
};
