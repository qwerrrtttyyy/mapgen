// Analyze the screenshot PNG to see what's actually displayed
import fs from 'fs';
import { PNG } from 'pngjs';

const files = ['visual-01-launcher.png', 'visual-02-after-generate.png', 'black-screen-01-initial.png'];

for (const file of files) {
  try {
    const buf = fs.readFileSync(file);
    const png = PNG.sync.read(buf);
    const { width, height, data } = png;
    console.log(`\n=== ${file} (${width}x${height}) ===`);

    // Sample a grid
    let red = 0, sea = 0, green = 0, black = 0, dark = 0, other = 0, total = 0;
    const grid = [];
    const N = 9;
    for (let gy = 0; gy < N; gy++) {
      const row = [];
      for (let gx = 0; gx < N; gx++) {
        const x = Math.floor(gx/(N-1) * (width-1));
        const y = Math.floor(gy/(N-1) * (height-1));
        const idx = (y * width + x) * 4;
        const r = data[idx], g = data[idx+1], b = data[idx+2];
        row.push([r, g, b]);
        total++;
        if (r > 200 && g > 40 && g < 130 && b < 90) red++;
        else if (b > r && b > g && b > 40) sea++;
        else if (g > r && g > b) green++;
        else if (r < 20 && g < 20 && b < 30) black++;
        else if (r < 40 && g < 40 && b < 50) dark++;
        else other++;
      }
      grid.push(row);
    }

    // Print grid
    for (let gy = N-1; gy >= 0; gy--) {
      let line = '  ';
      for (let gx = 0; gx < N; gx++) {
        const [r,g,b] = grid[gy][gx];
        line += `[${String(r).padStart(3)},${String(g).padStart(3)},${String(b).padStart(3)}] `;
      }
      console.log(line);
    }
    console.log(`Distribution: red=${red} sea=${sea} green=${green} black=${black} dark=${dark} other=${other}`);
  } catch (e) {
    console.log(`\n=== ${file}: ${e.message} ===`);
  }
}
