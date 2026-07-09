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
 * 触发所有插件的指定钩子（并行执行异步钩子，用 Promise.allSettled 防止单个插件炸掉全部）
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
    const results = await Promise.allSettled(promises);
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[EventService] Plugin "${plugins[i]?.name}" async ${hookName} failed:`, r.reason);
      }
    });
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
 * 通知所有已注册插件有新插件加入
 */
function notifyPluginLoaded(newPlugin: Plugin): void {
  const plugins = pluginRegistry.getAll();
  for (const plugin of plugins) {
    if (plugin.name === newPlugin.name) continue;
    if (typeof plugin.onPluginRegistered === 'function') {
      try {
        plugin.onPluginRegistered(newPlugin);
      } catch (err) {
        console.error(`[EventService] Plugin "${plugin.name}" onPluginRegistered error:`, err);
      }
    }
  }
}

/**
 * 注册插件并通知其他插件
 */
export function registerPlugin(plugin: Plugin): void {
  pluginRegistry.register(plugin);
  notifyPluginLoaded(plugin);
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
