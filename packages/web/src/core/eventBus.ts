import { logger } from './logger.js';

export type EventHandler<T = unknown> = (payload: T) => void;

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
    if (!set) return;
    for (const handler of set) {
      try {
        handler(payload);
      } catch (err) {
        logger.error(`EventBus error in "${event}":`, err);
      }
    }
  }

  once<T>(event: string, handler: EventHandler<T>): () => void {
    const wrap = (payload: T) => {
      this.off(event, wrap as EventHandler<T>);
      (handler as EventHandler<T>)(payload);
    };
    return this.on(event, wrap as EventHandler<T>);
  }
}

export const bus = new EventBus();
