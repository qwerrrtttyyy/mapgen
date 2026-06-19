import { BasePhase } from './base-phase.js';
import { generateRivers, generateLakes } from '../../public/js/engine/rivers.js';

export class RiversPhase extends BasePhase {
  constructor() {
    super('rivers', 4);
  }

  validate(context) {
    return !!(context.params && 
           context.data &&
           context.data.heightMap &&
           context.data.boundaries);
  }

  async execute(context) {
    const { seed, width, height, riverCount } = context.params;
    const { heightMap, boundaries } = context.data;
    
    // 生成河流
    const rivers = generateRivers(
      width,
      height,
      heightMap,
      boundaries,
      0.1,
      riverCount || 20,
      seed
    );
    
    // 生成湖泊
    const lakeMap = generateLakes(width, height, heightMap, 0.1, 0.05, seed);

    // 更新上下文
    context.data.rivers = rivers.rivers;
    context.data.lakeMap = lakeMap;
    context.data.riverMask = rivers.riverMask;
    context.data.riverWidth = rivers.riverWidth;
    context.data.riverDepth = rivers.riverDepth;

    return { rivers: rivers.rivers, lakeMap };
  }
}
