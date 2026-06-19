import { BasePhase } from './base-phase.js';
import { generatePlates, assignPlates, computeBoundaries } from '../../public/js/engine/tectonic.js';

export class TectonicPhase extends BasePhase {
  constructor() {
    super('tectonic', 2);
  }

  validate(context) {
    return !!(context.params && 
           context.data &&
           context.data.noiseMap &&
           typeof context.params.plateCount === 'number');
  }

  async execute(context) {
    const { seed, plateCount, width, height, landmass } = context.params;
    
    // 生成板块
    const plates = generatePlates(seed, plateCount, width, height, landmass || 0.3);
    
    // 分配板块
    const { plateId, plateDist } = assignPlates(width, height, plates);
    
    // 计算边界
    const boundaries = computeBoundaries(width, height, plateId);

    // 更新上下文
    context.data.plates = plates;
    context.data.plateMap = plateId;
    context.data.plateDist = plateDist;
    context.data.boundaries = boundaries;

    return { plates, plateMap: plateId, plateDist, boundaries };
  }
}
