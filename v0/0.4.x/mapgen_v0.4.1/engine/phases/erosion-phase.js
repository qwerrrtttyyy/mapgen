import { BasePhase } from './base-phase.js';
import { hydraulicErosion } from '../../public/js/engine/erosion.js';

export class ErosionPhase extends BasePhase {
  constructor() {
    super('erosion', 3);
  }

  validate(context) {
    return !!(context.params && 
           context.data &&
           context.data.plateMap &&
           context.data.plateDist);
  }

  async execute(context) {
    const { seed, width, height, iterations } = context.params;
    const { plateMap, plateDist } = context.data;
    
    // 运行侵蚀模拟
    const heightMap = hydraulicErosion(
      width,
      height,
      plateDist,
      iterations || 200,
      1.0,
      seed
    );

    // 更新上下文
    context.data.heightMap = heightMap;

    return { heightMap };
  }
}
