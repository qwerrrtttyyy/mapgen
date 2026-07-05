import type { MapData } from '@mapgen/core';
import type { UIParams } from './appState.js';
import { logger } from './logger.js';
import { bus, setMediatorBridge } from './eventBus.js';

export type ColleagueName =
  | 'app'
  | 'actions'
  | 'bus'
  | 'renderer'
  | 'paramPanel'
  | 'toolbar'
  | 'progressView'
  | 'checkpointPanel'
  | 'mapInteraction'
  | 'editor'
  | 'nameOverlay'
  | 'checkpointManager'
  | 'launcher'
  | 'shortcuts'
  | 'contextMenu'
  | 'laserController'
  | 'p5renderer';

export type MediatorEvent =
  | 'render.request'
  | 'generate.request'
  | 'generating.started'
  | 'generating.completed'
  | 'generating.failed'
  | 'progress'
  | 'params.changed'
  | 'params.committed'
  | 'selection.changed'
  | 'selection.clear'
  | 'map.hover'
  | 'map.contextmenu'
  | 'editor.committed'
  | 'editor.mode.changed'
  | 'editor.vector.update'
  | 'overlay.toggle'
  | 'names.updated'
  | 'trail.update'
  | 'regenerate.phase'
  | 'randomSeed.request'
  | 'export.request'
  | 'checkpoint.save.request'
  | 'checkpoint.restore.request'
  | 'checkpoint.delete.request'
  | 'checkpoint.updated'
  | 'laser.mode.set'
  | 'laser.toggle'
  | 'laser.selection.done'
  | 'picker.update';

export interface MediatorEventPayload {
  'render.request': void;
  'generate.request': void;
  'generating.started': void;
  'generating.completed': { mapData: MapData; checkpoints?: number[] };
  'generating.failed': string;
  'progress': { fraction: number; label: string };
  'params.changed': { key: keyof UIParams; value: UIParams[keyof UIParams] };
  'params.committed': UIParams;
  'selection.changed': { plates: number[]; regions: number[] };
  'selection.clear': void;
  'map.hover': number;
  'map.contextmenu': { x: number; y: number };
  'editor.committed': { phase: string };
  'editor.mode.changed': { mode: string };
  'editor.vector.update': { points: number[][]; mode: string };
  'overlay.toggle': boolean;
  'names.updated': void;
  'trail.update': { width: number; height: number; pixels: Uint8Array };
  'regenerate.phase': string;
  'randomSeed.request': void;
  'export.request': void;
  'checkpoint.save.request': void;
  'checkpoint.restore.request': number;
  'checkpoint.delete.request': number;
  'checkpoint.updated': void;
  'laser.mode.set': string;
  'laser.toggle': void;
  'laser.selection.done': { plates: number[] };
  'picker.update': { px: number; py: number; plateId: number; elevation: number; temperature: number; moisture: number };
}

export interface Mediator {
  register(colleague: Colleague): void;
  unregister(colleague: Colleague): void;
  send<T extends MediatorEvent>(
    sender: ColleagueName,
    event: T,
    payload?: MediatorEventPayload[T]
  ): void;
  subscribe<T extends MediatorEvent>(
    colleague: ColleagueName,
    event: T,
    handler: (payload: MediatorEventPayload[T]) => void
  ): () => void;
}

export abstract class Colleague {
  protected mediator: Mediator | null = null;
  readonly name: ColleagueName;

  constructor(name: ColleagueName) {
    this.name = name;
  }

  setMediator(mediator: Mediator): void {
    this.mediator = mediator;
    mediator.register(this);
  }

  protected send<T extends MediatorEvent>(event: T, payload?: MediatorEventPayload[T]): void {
    if (this.mediator) {
      this.mediator.send(this.name, event, payload);
    } else {
      bus.emit(event, payload);
    }
  }

  protected subscribe<T extends MediatorEvent>(
    event: T,
    handler: (payload: MediatorEventPayload[T]) => void
  ): () => void {
    if (this.mediator) {
      return this.mediator.subscribe(this.name, event, handler);
    }
    return bus.on(event, handler);
  }
}

type EventHandler = (payload: unknown) => void;
type BusEmit = (event: string, payload?: unknown) => void;

export class AppMediator implements Mediator {
  private colleagues = new Map<ColleagueName, Colleague>();
  private listeners = new Map<MediatorEvent, Map<ColleagueName, Set<EventHandler>>>();
  private busEmit: BusEmit | null = null;
  private bridging = false;

  setBus(busEmit: BusEmit): void {
    this.busEmit = busEmit;
  }

  register(colleague: Colleague): void {
    if (this.colleagues.has(colleague.name)) {
      logger.warn(`Colleague "${colleague.name}" already registered`);
      return;
    }
    this.colleagues.set(colleague.name, colleague);
    logger.debug(`Mediator: registered "${colleague.name}"`);
  }

  unregister(colleague: Colleague): void {
    this.colleagues.delete(colleague.name);
    for (const [, listenerMap] of this.listeners) {
      listenerMap.delete(colleague.name);
    }
    logger.debug(`Mediator: unregistered "${colleague.name}"`);
  }

  send<T extends MediatorEvent>(
    sender: ColleagueName,
    event: T,
    payload?: MediatorEventPayload[T]
  ): void {
    const listenerMap = this.listeners.get(event);
    if (listenerMap) {
      logger.debug(`Mediator: "${sender}" -> "${event}"`);
      for (const [, handlers] of listenerMap) {
        for (const handler of handlers) {
          try {
            handler(payload);
          } catch (err) {
            logger.error(`Mediator error in "${event}" from "${sender}":`, err);
          }
        }
      }
    }

    if (this.busEmit && !this.bridging) {
      this.bridging = true;
      try {
        this.busEmit(event, payload);
      } catch (err) {
        logger.error(`Mediator->Bus bridge error for "${event}":`, err);
      }
      this.bridging = false;
    }
  }

  subscribe<T extends MediatorEvent>(
    colleague: ColleagueName,
    event: T,
    handler: (payload: MediatorEventPayload[T]) => void
  ): () => void {
    let listenerMap = this.listeners.get(event);
    if (!listenerMap) {
      listenerMap = new Map();
      this.listeners.set(event, listenerMap);
    }

    let handlers = listenerMap.get(colleague);
    if (!handlers) {
      handlers = new Set();
      listenerMap.set(colleague, handlers);
    }

    const typedHandler = handler as EventHandler;
    handlers.add(typedHandler);

    return () => {
      const lm = this.listeners.get(event);
      const hs = lm?.get(colleague);
      if (hs) {
        hs.delete(typedHandler);
        if (hs.size === 0) lm?.delete(colleague);
      }
    };
  }

  receiveFromBus(event: string, payload: unknown): void {
    if (this.bridging) return;
    const listenerMap = this.listeners.get(event as MediatorEvent);
    if (!listenerMap) return;

    logger.debug(`Mediator: "bus" -> "${event}"`);
    this.bridging = true;
    for (const [, handlers] of listenerMap) {
      for (const handler of handlers) {
        try {
          handler(payload);
        } catch (err) {
          logger.error(`Mediator error in "${event}" from bus:`, err);
        }
      }
    }
    this.bridging = false;
  }

  getColleague(name: ColleagueName): Colleague | undefined {
    return this.colleagues.get(name);
  }

  get registeredCount(): number {
    return this.colleagues.size;
  }
}

export const mediator = new AppMediator();

mediator.setBus((event, payload) => bus.emit(event, payload));
setMediatorBridge((event, payload) => mediator.receiveFromBus(event, payload));
