import { chromium, expect } from '@playwright/test';
import { installDeterministicAppleMusic } from '../../../../apps/web/tests/deterministic-apple-music';
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-blink-features=CanvasDrawElement'] });
try {
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await installDeterministicAppleMusic(page, { trackCount: 80, trackTitle: 'Turbo' });
await page.goto('http://localhost:3000/_spike/device?capture', { waitUntil: 'domcontentloaded' });
const panel = page.locator('.wp-panel');
await expect(panel).toHaveAttribute('data-screen', 'S03');
await panel.focus();
await panel.press('Enter');
await panel.press('Enter');
await expect(panel.locator('.wp-list-scroll')).toBeAttached();
const evidence: unknown[] = [];
for (const colourway of ['black', 'white'] as const) {
  await page.evaluate(c => { window.__webpodDevicePreview?.setColourway(c); window.__webpodDevicePreview?.reset(); }, colourway);
  for (const [name, presses] of [['top', 0], ['middle', 40], ['bottom', 80]] as const) {
    await panel.focus();
    for (let n=0;n<80;n++) await panel.press('ArrowUp');
    for (let n=0;n<presses;n++) await panel.press('ArrowDown');
    await page.waitForTimeout(600);
    const indicator = panel.locator('.wp-list-scroll');
    const state = await indicator.evaluate(el => {
      const thumb = el.querySelector('.wp-list-scroll__thumb');
      if (!thumb) throw new Error('Missing thumb');
      const well = el.getBoundingClientRect(), box = thumb.getBoundingClientRect();
      return { offset: el.getAttribute('data-thumb-offset'), size: el.getAttribute('data-thumb-size'), start: el.getAttribute('data-window-start'), top: box.top - well.top, bottom: well.bottom - box.bottom };
    });
    expect(state.top).toBeGreaterThanOrEqual(-0.1);
    expect(state.bottom).toBeGreaterThanOrEqual(-0.1);
    if (name === 'top') expect(Number(state.start)).toBe(0);
    if (name === 'bottom') expect(Number(state.start)).toBe(71);
    evidence.push({ colourway, name, ...state });
    await page.screenshot({ path: `${import.meta.dirname}/revision-scroll-${colourway}-${name}.png` });
  }
}
await Bun.write(`${import.meta.dirname}/revision-scroll.json`, JSON.stringify(evidence, null, 2));
} finally { await browser.close(); }
