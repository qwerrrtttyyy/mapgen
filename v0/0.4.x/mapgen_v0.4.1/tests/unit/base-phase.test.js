import { describe, it } from 'node:test';
import assert from 'node:assert';
import { BasePhase } from '../../engine/phases/base-phase.js';

describe('BasePhase', () => {
  describe('constructor()', () => {
    it('should create phase with name and weight', () => {
      const phase = new BasePhase('test', 1);
      
      assert.strictEqual(phase.name, 'test');
      assert.strictEqual(phase.weight, 1);
    });

    it('should default weight to 1', () => {
      const phase = new BasePhase('test');
      
      assert.strictEqual(phase.weight, 1);
    });
  });

  describe('execute()', () => {
    it('should throw error if not implemented', async () => {
      const phase = new BasePhase('test');
      
      try {
        await phase.execute({});
        assert.fail('Should have thrown');
      } catch (err) {
        assert.ok(err.message.includes('must implement execute()'));
      }
    });
  });

  describe('validate()', () => {
    it('should return true by default', () => {
      const phase = new BasePhase('test');
      
      const result = phase.validate({});
      
      assert.strictEqual(result, true);
    });
  });

  describe('wrappedExecute()', () => {
    it('should execute phase and record timing', async () => {
      const phase = new BasePhase('test', 1);
      phase.execute = async (ctx) => ({ result: 'success' });
      
      const ctx = {
        emit: () => {},
      };
      
      const result = await phase.wrappedExecute(ctx);
      
      assert.strictEqual(result.result, 'success');
      assert.ok(phase.startTime);
      assert.ok(phase.endTime);
    });

    it('should emit phase:start event', async () => {
      const phase = new BasePhase('test', 1);
      phase.execute = async (ctx) => ({});
      
      const events = [];
      const ctx = {
        emit: (event, data) => {
          events.push({ event, data });
        },
      };
      
      await phase.wrappedExecute(ctx);
      
      assert.ok(events.some(e => e.event === 'phase:start'));
    });

    it('should emit phase:complete event', async () => {
      const phase = new BasePhase('test', 1);
      phase.execute = async (ctx) => ({ result: 'success' });
      
      const events = [];
      const ctx = {
        emit: (event, data) => {
          events.push({ event, data });
        },
      };
      
      await phase.wrappedExecute(ctx);
      
      assert.ok(events.some(e => e.event === 'phase:complete'));
    });

    it('should emit phase:error event on failure', async () => {
      const phase = new BasePhase('test', 1);
      phase.execute = async (ctx) => {
        throw new Error('Test error');
      };
      
      const events = [];
      const ctx = {
        emit: (event, data) => {
          events.push({ event, data });
        },
      };
      
      try {
        await phase.wrappedExecute(ctx);
      } catch (err) {
        // 预期的错误
      }
      
      assert.ok(events.some(e => e.event === 'phase:error'));
    });
  });
});
