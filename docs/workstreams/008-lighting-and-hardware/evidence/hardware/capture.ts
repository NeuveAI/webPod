import { chromium } from '../../../../../packages/panel/node_modules/@playwright/test/index.mjs';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
const directory = import.meta.dirname;
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-blink-features=CanvasDrawElement'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
const captures: unknown[] = [];
for (const colourway of ['black', 'white']) {
  for (const view of ['top', 'bottom']) {
    await page.goto(`http://localhost:3000/_spike/device?diagnostic=production-surface&colourway=${colourway}&capture&view=${view}`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: resolve(directory, `after-${colourway}-${view}.png`) });
  }
  for (const [view, pitchDeg] of [['top-oblique', 45], ['bottom-oblique', -45]] as const) {
    await page.goto(`http://localhost:3000/_spike/device?diagnostic=production-surface&colourway=${colourway}&capture`);
    await page.waitForFunction(() => Reflect.get(window, '__webpodDevicePreview') !== undefined);
    const orientation = await page.evaluate((pitchDeg) => Reflect.get(window, '__webpodDevicePreview').setOrientation({ pitchDeg, yawDeg: -12, rollDeg: 0 }), pitchDeg);
    await page.waitForTimeout(1000);
    const clip = await page.locator('.webpod-device-preview canvas').first().evaluate((canvas) => {
      const r = canvas.getBoundingClientRect();
      const ex = Number(canvas.getAttribute('data-wp-projected-extent-x'));
      const ey = Number(canvas.getAttribute('data-wp-projected-extent-y'));
      return { x: r.left + r.width * (1 - ex) / 2 - 20, y: r.top + r.height * (1 - ey) / 2 - 20, width: r.width * ex + 40, height: r.height * ey + 40 };
    });
    await page.screenshot({ path: resolve(directory, `${colourway}-${view}.png`), clip });
    const detail = { ...clip, y: view === 'top-oblique' ? clip.y : clip.y + clip.height - 140, height: 140 };
    await page.screenshot({ path: resolve(directory, `${colourway}-${view}-detail.png`), clip: detail });
    captures.push({ colourway, view, orientation, clip, detail });
  }
}
await browser.close();
await writeFile(resolve(directory, 'capture-summary.json'), JSON.stringify({ source: 'live localhost:3000 worktree; production DeviceCanvas materials', viewport: [1200, 800], dpr: 2, errors, captures }, null, 2));
if (errors.length) throw new Error(errors.join('\n'));
