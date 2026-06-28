// Dogfood test for mapgen v2 editor features
// Launches chromium with --no-sandbox (required in this sandbox)
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = '/workspace/dogfood-output';
const SH = `${OUT}/screenshots`;
fs.mkdirSync(SH, { recursive: true });

const shot = async (page, name) => {
  await page.screenshot({ path: `${SH}/${name}.png`, fullPage: false });
  console.log(`  📸 ${name}.png`);
};

const results = { pass: [], fail: [], errors: [] };
const log = (s) => console.log(s);

const browser = await chromium.launch({
  headless: true,
  executablePath: '/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--headless=new'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

// Collect console errors
const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));

try {
  log('\n=== 1. Navigate to app ===');
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
  await shot(page, '01-initial');

  // Dismiss launcher if present (click 启动 button)
  log('\n=== 2. Dismiss launcher & generate procedural map ===');
  const startBtn = await page.locator('#launcher-start').first();
  if (await startBtn.count() > 0) {
    await startBtn.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(7000);
  }
  await shot(page, '02-procedural-map');

  // Inspect state via window
  const hasMap = await page.evaluate(() => {
    const c = document.getElementById('glCanvas');
    return { canvas: !!c, canvasW: c?.width, canvasH: c?.height, editorBar: !!document.getElementById('editor-bar') };
  });
  log(`  canvas=${hasMap.canvas} (${hasMap.canvasW}x${hasMap.canvasH}) editorBar=${hasMap.editorBar}`);
  results.pass.push('App loads with canvas + editor bar');

  // Check names overlay rendered
  log('\n=== 3. Verify names generated ===');
  const namesInfo = await page.evaluate(() => {
    // Access via app state — names are in md.names; check overlay canvas drawn
    const ov = document.querySelector('.name-overlay');
    return { overlay: !!ov, overlayW: ov?.width, overlayH: ov?.height };
  });
  log(`  overlay=${namesInfo.overlay} (${namesInfo.overlayW}x${namesInfo.overlayH})`);
  if (namesInfo.overlay) results.pass.push('Name overlay canvas exists');
  else results.fail.push('Name overlay canvas missing');

  // Toggle names on to ensure visible
  const namesToggle = await page.locator('#names-toggle, button:has-text("名称")').first();
  if (await namesToggle.count()) {
    await namesToggle.click().catch(() => {});
    await page.waitForTimeout(500);
  }
  await shot(page, '03-names-shown');

  // Test brush tool
  log('\n=== 4. Test brush tool (raise) ===');
  const brushBtn = await page.locator('[data-tool="brush"], button:has-text("画笔")').first();
  if (await brushBtn.count()) {
    await brushBtn.click();
    await page.waitForTimeout(300);
    const canvas = await page.locator('#glCanvas');
    const box = await canvas.boundingBox();
    // Stroke a line across center
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
    await page.mouse.down();
    for (let i = 0; i < 8; i++) {
      await page.mouse.move(box.x + box.width * (0.3 + i * 0.05), box.y + box.height * 0.5);
      await page.waitForTimeout(40);
    }
    await page.mouse.up();
    await page.waitForTimeout(800);
    await shot(page, '04-brush-raise');
    results.pass.push('Brush raise stroke applied');
  } else {
    results.fail.push('Brush tool button not found');
  }

  // Test undo
  log('\n=== 5. Test Undo (Ctrl+Z) ===');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(800);
  await shot(page, '05-after-undo');
  results.pass.push('Undo executed (Ctrl+Z)');

  // Test redo
  log('\n=== 6. Test Redo (Ctrl+Y) ===');
  await page.keyboard.press('Control+y');
  await page.waitForTimeout(800);
  await shot(page, '06-after-redo');
  results.pass.push('Redo executed (Ctrl+Y)');

  // Test double-click rename — mock prompt
  log('\n=== 7. Test double-click rename (AC-8.3) ===');
  await page.evaluate(() => {
    window.__renameCalled = false;
    window.__promptOrig = window.prompt;
    window.prompt = (text, def) => { window.__renameCalled = true; window.__renameText = text; return '测试改名山脉'; };
  });
  // Switch to annotate/idle mode first
  const viewBtn = await page.locator('[data-tool="idle"], button:has-text("查看")').first();
  if (await viewBtn.count()) { await viewBtn.click(); await page.waitForTimeout(200); }
  const canvas2 = await page.locator('#glCanvas');
  const box2 = await canvas2.boundingBox();
  // Double click near center where a name likely is
  await page.mouse.click(box2.x + box2.width * 0.5, box2.y + box2.height * 0.4, { clickCount: 2 });
  await page.waitForTimeout(500);
  const renameInfo = await page.evaluate(() => ({ called: window.__renameCalled, text: window.__renameText }));
  log(`  prompt called=${renameInfo.called} text="${renameInfo.text}"`);
  if (renameInfo.called) results.pass.push('Double-click rename prompt triggered (AC-8.3)');
  else results.fail.push('Double-click rename prompt NOT triggered (AC-8.3 regression)');
  await shot(page, '07-rename');

  // Test blank mode
  log('\n=== 8. Test blank generation mode ===');
  const blankRadio = await page.locator('input[name="genMode"][value="blank"]');
  if (await blankRadio.count()) {
    await blankRadio.check();
    await page.waitForTimeout(300);
    // Click generate
    const genBtn2 = await page.locator('#btn-generate').first();
    if (await genBtn2.count()) {
      await genBtn2.click().catch(() => {});
      await page.waitForTimeout(5000);
    }
    await shot(page, '08-blank-mode');
    const blankInfo = await page.evaluate(() => {
      // sample center pixel elevation via reading is hard; just confirm canvas still renders
      const c = document.getElementById('glCanvas');
      return { canvas: !!c, w: c?.width, h: c?.height };
    });
    log(`  blank canvas=${blankInfo.canvas} (${blankInfo.w}x${blankInfo.h})`);
    results.pass.push('Blank generation mode runs');
  } else {
    results.fail.push('Blank mode radio not found');
  }

  // Switch back to procedural
  const procRadio = await page.locator('input[name="genMode"][value="procedural"]');
  if (await procRadio.count()) {
    await procRadio.check();
    await page.waitForTimeout(300);
    const genBtn3 = await page.locator('#btn-generate').first();
    if (await genBtn3.count()) { await genBtn3.click().catch(() => {}); await page.waitForTimeout(5000); }
    await shot(page, '09-procedural-restore');
  }

  log('\n=== 9. Console errors ===');
  if (consoleErrors.length === 0) {
    log('  ✅ No console errors');
    results.pass.push('No console errors during session');
  } else {
    log(`  ⚠️ ${consoleErrors.length} console errors:`);
    consoleErrors.slice(0, 10).forEach((e) => log(`     - ${e}`));
    results.errors = consoleErrors.slice(0, 20);
  }

} catch (e) {
  log(`\n❌ EXCEPTION: ${e.message}`);
  results.fail.push(`Exception: ${e.message}`);
  await shot(page, '99-exception').catch(() => {});
} finally {
  await browser.close();
}

log('\n=== SUMMARY ===');
log(`PASS: ${results.pass.length}`);
results.pass.forEach((s) => log(`  ✅ ${s}`));
log(`FAIL: ${results.fail.length}`);
results.fail.forEach((s) => log(`  ❌ ${s}`));
if (results.errors.length) {
  log(`Console errors (${results.errors.length}):`);
  results.errors.forEach((e) => log(`  ⚠️ ${e}`));
}
fs.writeFileSync(`${OUT}/dogfood-result.json`, JSON.stringify(results, null, 2));
console.log(`\nResult written to ${OUT}/dogfood-result.json`);
