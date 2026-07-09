import type { MapParams, MapData, ProgressCallback } from './types.js';
import { pluginRegistry, type Plugin } from './plugin.js';

// ── Context types ─────────────────────────────────────────────────────────

export interface GenerateContext {
  /** 当前地图参数（插件可修改） */
  params: MapParams;
  /** 地图宽度 */
  width: number;
  /** 地图高度 */
  height: number;
  /** 随机种子 */
  seed: number;
  /** 最终生成结果（仅在 generate:after 时有值） */
  mapData?: MapData;
}

export interface StageContext {
  /** 阶段名称 */
  stageName: string;
  /** 当前地图参数 */
  params: MapParams;
  /** 阶段输出状态（仅在 stage:after 时有值） */
  state?: unknown;
}

// ── EventService ──────────────────────────────────────────────────────────

type HookHandler<T> = (ctx: T) => void | Promise<void>;
type TransformHandler<T, R> = (input: T) => R | void;

interface EventServiceState {
  /** 是否已初始化 */
  initialized: boolean;
}

const state: EventServiceState = {
  initialized: false,
};

/**
 * 触发所有插件的指定钩子（并行执行异步钩子）
 */
async function invokeHook<T>(
  hookName: keyof Plugin,
  ctx: T
): Promise<void> {
  const plugins = pluginRegistry.getAll();
  const promises: Promise<void>[] = [];

  for (const plugin of plugins) {
    const handler = plugin[hookName];
    if (typeof handler === 'function') {
      try {
        const result = (handler as HookHandler<T>).call(plugin, ctx);
        if (result && typeof (result as Promise<void>).then === 'function') {
          promises.push(result as Promise<void>);
        }
      } catch (err) {
        console.error(`[EventService] Plugin "${plugin.name}" error in ${hookName}:`, err);
      }
    }
  }

  if (promises.length > 0) {
    await Promise.all(promises);
  }
}

/**
 * 触发 transform 钩子链 —— 每个插件的返回值作为下一个插件的输入
 */
function invokeTransform<T>(
  hookName: keyof Plugin,
  input: T
): T {
  let current = input;
  const plugins = pluginRegistry.getAll();

  for (const plugin of plugins) {
    const handler = plugin[hookName];
    if (typeof handler === 'function') {
      try {
        const result = (handler as TransformHandler<T, T>).call(plugin, current);
        if (result !== undefined && result !== null) {
          current = result;
        }
      } catch (err) {
        console.error(`[EventService] Plugin "${plugin.name}" transform error in ${hookName}:`, err);
      }
    }
  }

  return current;
}

/**
 * 初始化事件服务（幂等）
 */
export function initEventService(): void {
  if (state.initialized) return;
  state.initialized = true;
}

/**
 * 触发 generate:before 钩子
 * 插件可在此修改 params
 */
export async function emitGenerateBefore(
  params: MapParams,
  width: number,
  height: number,
  seed: number
): Promise<GenerateContext> {
  const ctx: GenerateContext = { params, width, height, seed };
  await invokeHook('onGenerateBefore', ctx);

  // 允许插件通过 onParamsValidate 修改 params
  const validated = invokeTransform('onParamsValidate', ctx.params);
  ctx.params = validated;

  return ctx;
}

/**
 * 触发 generate:after 钩子
 * 插件可在此修改最终 mapData
 */
export async function emitGenerateAfter(
  ctx: GenerateContext,
  mapData: MapData
): Promise<MapData> {
  ctx.mapData = mapData;
  await invokeHook('onGenerateAfter', ctx);

  // 允许插件通过 onMapDataTransform 修改 mapData
  return invokeTransform('onMapDataTransform', mapData);
}

/**
 * 触发 stage:before 钩子
 */
export async function emitStageBefore(
  stageName: string,
  params: MapParams
): Promise<void> {
  await invokeHook('onStageBefore', { stageName, params });
}

/**
 * 触发 stage:after 钩子
 */
export async function emitStageAfter(
  stageName: string,
  params: MapParams,
  state: unknown
): Promise<void> {
  await invokeHook('onStageAfter', { stageName, params, state });
}

/**
 * 触发 pipeline:error 钩子
 */
export async function emitPipelineError(
  stageName: string,
  params: MapParams,
  error: Error
): Promise<void> {
  await invokeHook('onPipelineError', { stageName, params, error });
}

/**
 * 触发 plugin:loaded 事件
 */
export async function emitPluginLoaded(plugin: Plugin): Promise<void> {
  const plugins = pluginRegistry.getAll();
  for (const p of plugins) {
    if (p.name !== plugin.name) {
      // 通知其他插件有新插件加入（可选监听）
    }
  }
}

/**
 * 注册插件并触发 plugin:loaded
 */
export function registerPlugin(plugin: Plugin): void {
  pluginRegistry.register(plugin);
  emitPluginLoaded(plugin);
}

/**
 * 卸载插件
 */
export function unregisterPlugin(name: string): void {
  pluginRegistry.unregister(name);
}

/**
 * 获取事件服务状态
 */
export function getEventServiceStatus(): { initialized: boolean; pluginCount: number } {
  return {
    initialized: state.initialized,
    pluginCount: pluginRegistry.count,
  };
}
