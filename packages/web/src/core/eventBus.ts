import { logger } from './logger.js';
import type { MapData } from '@mapgen/core';
import type { UIParams } from './appState.js';

export interface EventMap {
  'render.request': void;
  'generate.request': void;
  'generating.started': void;
  progress: { fraction: number; label: string };
  'generating.completed': { mapData: MapData };
  'generating.failed': string;
  'selection.changed': { plates: number[]; regions: number[] };
  'export.request': void;
  'params.changed': { key: string; value: unknown };
  'params.committed': UIParams;
  'map.hover': number;
}

export type EventHandler<T = unknown> = (payload: T) => void;

let _bridgeToMediator: ((event: string, payload: unknown) => void) | null = null;
let _bridging = false;

export function setMediatorBridge(bridge: (event: string, payload: unknown) => void): void {
  _bridgeToMediator = bridge;
}

export class EventBus {
  private listeners = new Map<string, Set<EventHandler>>();

  on<T>(event: string, handler: EventHandler<T>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as EventHandler);
    return () => this.off(event, handler);
  }

  off<T>(event: string, handler: EventHandler<T>): void {
    const set = this.listeners.get(event);
    if (set) set.delete(handler as EventHandler);
  }

  emit<T>(event: string, payload?: T): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const handler of set) {
        try {
          handler(payload);
        } catch (err) {
          logger.error(`EventBus error in "${event}":`, err);
        }
      }
    }
    if (_bridgeToMediator && !_bridging) {
      _bridging = true;
      try {
        _bridgeToMediator(event, payload as unknown);
      } catch {
        // ignore
      }
      _bridging = false;
    }
  }

  once<T>(event: string, handler: EventHandler<T>): () => void {
    const wrap = (payload: T) => {
      this.off(event, wrap as EventHandler<T>);
      handler(payload);
    };
    return this.on(event, wrap as EventHandler<T>);
  }
}

export const bus = new EventBus();
