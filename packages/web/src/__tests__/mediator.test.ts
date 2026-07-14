// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../core/logger.js', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../core/eventBus.js', () => ({
  bus: { emit: vi.fn(), on: vi.fn(() => vi.fn()) },
  setMediatorBridge: vi.fn(),
}));

import { AppMediator, Colleague, type ColleagueName } from '../core/mediator.js';

// Concrete test colleague — uses only public/protected setMediator
class TestColleague extends Colleague {
  public receivedEvents: Array<{ event: string; payload: unknown }> = [];

  constructor(name: ColleagueName) {
    super(name);
  }
}

describe('AppMediator', () => {
  let mediator: AppMediator;

  beforeEach(() => {
    mediator = new AppMediator();
  });

  describe('register / unregister', () => {
    it('registers a colleague', () => {
      const col = new TestColleague('app');
      mediator.register(col);
      expect(mediator.registeredCount).toBe(1);
      expect(mediator.getColleague('app')).toBe(col);
    });

    it('warns on duplicate registration', () => {
      const col1 = new TestColleague('app');
      const col2 = new TestColleague('app');
      mediator.register(col1);
      mediator.register(col2);
      expect(mediator.registeredCount).toBe(1);
    });

    it('unregisters a colleague', () => {
      const col = new TestColleague('app');
      mediator.register(col);
      mediator.unregister(col);
      expect(mediator.registeredCount).toBe(0);
      expect(mediator.getColleague('app')).toBeUndefined();
    });
  });

  describe('send / subscribe', () => {
    it('delivers events to subscribers', () => {
      const handler = vi.fn();
      mediator.subscribe('app', 'generate.request', handler);
      mediator.send('actions', 'generate.request');
      expect(handler).toHaveBeenCalledOnce();
    });

    it('delivers payload to handler', () => {
      const handler = vi.fn();
      mediator.subscribe('app', 'generating.failed', handler);
      mediator.send('renderer', 'generating.failed', 'Network error');
      expect(handler).toHaveBeenCalledWith('Network error');
    });

    it('does not deliver to unsubscribed events', () => {
      const handler = vi.fn();
      mediator.subscribe('app', 'generate.request', handler);
      mediator.send('actions', 'params.changed', { key: 'mapSize', value: 512 });
      expect(handler).not.toHaveBeenCalled();
    });

    it('supports multiple subscribers for same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      mediator.subscribe('app', 'render.request', handler1);
      mediator.subscribe('renderer', 'render.request', handler2);
      mediator.send('actions', 'render.request');
      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it('unsubscribe stops delivery', () => {
      const handler = vi.fn();
      const unsub = mediator.subscribe('app', 'generate.request', handler);
      unsub();
      mediator.send('actions', 'generate.request');
      expect(handler).not.toHaveBeenCalled();
    });

    it('send with no subscribers does not throw', () => {
      expect(() => mediator.send('app', 'generate.request')).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('catches handler errors and continues', () => {
      const goodHandler = vi.fn();
      const badHandler = vi.fn(() => {
        throw new Error('boom');
      });
      mediator.subscribe('app', 'generate.request', badHandler);
      mediator.subscribe('renderer', 'generate.request', goodHandler);
      mediator.send('actions', 'generate.request');
      expect(goodHandler).toHaveBeenCalledOnce();
    });
  });
});
