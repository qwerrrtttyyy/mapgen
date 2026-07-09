import type { MapParams, MapData } from './types.js';
import type { GenerateContext, StageContext } from './eventService.js';

/**
 * 插件接口 —— 实现此接口即可挂载到 mapgen 的事件钩子上
 *
 * 所有钩子都是可选的，插件只需实现自己关心的即可。
 * 同步钩子直接执行，异步钩子通过 Promise.all 并行执行（不阻塞 pipeline）。
 */
export interface Plugin {
  /** 插件唯一标识 */
  name: string;
  /** 语义化版本 */
  version: string;
  /** 人类可读描述 */
  description?: string;

  /**
   * 插件初始化钩子
   * 在插件注册时调用，可用于设置初始状态
   */
  onInit?(): void | Promise<void>;

  /**
   * 插件销毁钩子
   * 在插件卸载时调用，用于清理资源
   */
  onDispose?(): void | Promise<void>;

  /**
   * 地图生成开始前
   * 可在此修改 params（返回修改后的 params）
   */
  onGenerateBefore?(ctx: GenerateContext): void | Promise<void>;

  /**
   * 地图生成完成后
   * 可在此检查或修改最终的 mapData
   */
  onGenerateAfter?(ctx: GenerateContext): void | Promise<void>;

  /**
   * 每个 pipeline 阶段开始前
   */
  onStageBefore?(ctx: StageContext): void | Promise<void>;

  /**
   * 每个 pipeline 阶段完成后
   */
  onStageAfter?(ctx: StageContext): void | Promise<void>;

  /**
   * pipeline 阶段出错时
   */
  onPipelineError?(ctx: StageContext & { error: Error }): void | Promise<void>;

  /**
   * 参数校验/转换钩子 —— 可修改参数
   * 返回修改后的 params，或 void 表示不修改
   */
  onParamsValidate?(params: MapParams): MapParams | void;

  /**
   * 最终 MapData 变换钩子 —— 可修改最终输出
   * 返回修改后的 mapData，或 void 表示不修改
   */
  onMapDataTransform?(mapData: MapData): MapData | void;
}

export type PluginEventName =
  | 'init'
  | 'dispose'
  | 'generate:before'
  | 'generate:after'
  | 'stage:before'
  | 'stage:after'
  | 'pipeline:error'
  | 'params:validate'
  | 'mapdata:transform'
  | 'plugin:loaded';

export interface PluginRegistry {
  register(plugin: Plugin): void;
  unregister(name: string): void;
  get(name: string): Plugin | undefined;
  getAll(): Plugin[];
  readonly count: number;
}

const registry = new Map<string, Plugin>();

function validatePlugin(plugin: Plugin): void {
  if (!plugin.name || typeof plugin.name !== 'string') {
    throw new Error('[Plugin] name is required and must be a string');
  }
  if (!plugin.version || typeof plugin.version !== 'string') {
    throw new Error(`[Plugin:${plugin.name}] version is required`);
  }
  if (registry.has(plugin.name)) {
    throw new Error(`[Plugin:${plugin.name}] already registered`);
  }
}

export const pluginRegistry: PluginRegistry = {
  register(plugin: Plugin): void {
    validatePlugin(plugin);
    registry.set(plugin.name, plugin);
    plugin.onInit?.();
  },

  unregister(name: string): void {
    const plugin = registry.get(name);
    if (plugin) {
      plugin.onDispose?.();
      registry.delete(name);
    }
  },

  get(name: string): Plugin | undefined {
    return registry.get(name);
  },

  getAll(): Plugin[] {
    return Array.from(registry.values());
  },

  get count(): number {
    return registry.size;
  },
};
