import { BasePhase } from './base-phase.js';

export class PhaseRegistry {
  constructor() {
    this.phases = [];
  }

  register(phase) {
    if (!(phase instanceof BasePhase)) {
      throw new Error('Phase must extend BasePhase');
    }
    
    if (this.phases.some(p => p.name === phase.name)) {
      throw new Error(`Phase "${phase.name}" already registered`);
    }
    
    this.phases.push(phase);
  }

  unregister(name) {
    const index = this.phases.findIndex(p => p.name === name);
    if (index !== -1) {
      this.phases.splice(index, 1);
    }
  }

  getPhases() {
    return [...this.phases].sort((a, b) => a.weight - b.weight);
  }

  async executeAll(context) {
    const phases = this.getPhases();
    const result = {};
    
    for (const phase of phases) {
      const phaseResult = await phase.wrappedExecute(context);
      Object.assign(result, phaseResult);
    }
    
    return result;
  }
}
