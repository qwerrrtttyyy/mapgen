import { BasePhase } from './base-phase.js';
import { createNoise } from '../../public/js/engine/noise.js';

export class NoisePhase extends BasePhase {
  constructor() {
    super('noise', 1);
  }

  validate(context) {
    return context.params && 
           typeof context.params.seed === 'number' &&
           typeof context.params.width === 'number' &&
           typeof context.params.height === 'number';
  }

  async execute(context) {
    const { seed, width, height } = context.params;
    
    // 创建噪声引擎实例
    const noise = createNoise(seed, 'simplex');
    
    // 生成噪声图
    const noiseMap = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const nx = x / width;
        const ny = y / height;
        noiseMap[idx] = noise.fbm(nx * 4, ny * 4, 6, 2.0, 0.5, 'standard');
      }
    }

    // 更新上下文
    context.data = context.data || {};
    context.data.noiseMap = noiseMap;
    context.data.noise = noise;

    return { noiseMap };
  }
}
