import { installDeterministicAppleMusic } from '../../../../apps/web/tests/deterministic-apple-music';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-blink-features=CanvasDrawElement'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
page.on('pageerror', e => console.error(e.message));
if (process.env['CAPTURE_UI'] === '1') await installDeterministicAppleMusic(page);
await page.goto(process.env['CAPTURE_UI'] === '1' ? 'http://localhost:3000/_spike/device?capture' : 'http://localhost:3000/_spike/device?capture&diagnostic=production-surface', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__webpodDevicePreview);
await page.waitForTimeout(2000);
if (process.env['CAPTURE_UI'] === '1') await page.locator('.wp-panel').waitFor();
for (const colourway of ['black', 'white'] as const) {
 for (const [view, yawDeg] of [['front', 0], ['oblique', 40], ['side', 85]] as const) {
  await page.evaluate(({ colourway, yawDeg }) => { window.__webpodDevicePreview?.setColourway(colourway); window.__webpodDevicePreview?.setOrientation({ pitchDeg: 0, yawDeg, rollDeg: 0 }); }, { colourway, yawDeg });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${import.meta.dirname}/${process.env['CAPTURE_PREFIX'] ?? 'after'}-${colourway}-${view}.png` });
 }
}
await browser.close();
