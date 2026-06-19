import { BasePhase } from './base-phase.js';
import { SeededRandom } from '../../public/js/engine/seeded-random.js';

export class RegionsPhase extends BasePhase {
  constructor() {
    super('regions', 5);
  }

  validate(context) {
    return !!(context.params && 
           context.data &&
           context.data.heightMap &&
           context.data.lakeMap);
  }

  async execute(context) {
    const { seed, width, height, regionCount } = context.params;
    const { heightMap, lakeMap } = context.data;
    
    const rng = new SeededRandom(seed);
    const totalPixels = width * height;
    const regionMap = new Int32Array(totalPixels);
    const regions = [];
    
    // 生成随机种子点
    const seeds = [];
    for (let i = 0; i < (regionCount || 10); i++) {
      seeds.push({
        x: Math.floor(rng.next() * width),
        y: Math.floor(rng.next() * height),
        id: i,
      });
    }
    
    // 泛洪填充分配区域
    for (let i = 0; i < totalPixels; i++) {
      if (lakeMap[i]) {
        regionMap[i] = -1; // 湖泊
        continue;
      }
      
      let minDist = Infinity;
      let minRegion = 0;
      
      for (const s of seeds) {
        const px = i % width;
        const py = Math.floor(i / width);
        const dist = Math.hypot(px - s.x, py - s.y);
        if (dist < minDist) {
          minDist = dist;
          minRegion = s.id;
        }
      }
      
      regionMap[i] = minRegion;
    }
    
    // 收集区域信息
    for (let i = 0; i < seeds.length; i++) {
      let count = 0;
      let heightSum = 0;
      
      for (let j = 0; j < totalPixels; j++) {
        if (regionMap[j] === i) {
          count++;
          heightSum += heightMap[j];
        }
      }
      
      regions.push({
        id: i,
        pixelCount: count,
        avgHeight: heightSum / count,
        seedX: seeds[i].x,
        seedY: seeds[i].y,
      });
    }

    // 更新上下文
    context.data.regionMap = regionMap;
    context.data.regions = regions;

    return { regionMap, regions };
  }
}
