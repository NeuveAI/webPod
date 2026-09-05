import { chromium, expect } from '@playwright/test';
import { Euler, PerspectiveCamera, Vector3 } from '../../../../packages/device/node_modules/three';
import { installDeterministicAppleMusic } from '../../../../apps/web/tests/deterministic-apple-music';
import { DEVICE_LAYOUT } from '../../../../packages/device/src/layout';
import { DEFAULT_DEVICE_ENVELOPE } from '../../../../packages/device/src/device-envelope';
import { DEFAULT_FRONT_ASSEMBLY_DEPTHS, frontShellOffsetAt } from '../../../../packages/device/src/front-surface';
import { deviceOrientationToRotation } from '../../../../packages/device/src/orientation';

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-blink-features=CanvasDrawElement'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await installDeterministicAppleMusic(page);
  await page.goto('http://localhost:3000/_spike/device?capture', { waitUntil: 'domcontentloaded' });
  await page.locator('.wp-panel').waitFor();
  await page.waitForFunction(() => !!window.__webpodDevicePreview);
  const canvas = page.locator('canvas');
  const results = [];
  for (const pose of [
    { pitchDeg: 0, yawDeg: 0, rollDeg: 0 },
    { pitchDeg: 10, yawDeg: -34, rollDeg: 2 },
    { pitchDeg: -30, yawDeg: 40, rollDeg: 15 },
    { pitchDeg: 35, yawDeg: -50, rollDeg: -20 },
  ]) {
    await page.evaluate(p => window.__webpodDevicePreview?.setOrientation(p), pose);
    await page.waitForTimeout(350);
    const rect = await canvas.boundingBox();
    if (!rect) throw new Error('Canvas missing');
    const distance = Number(await canvas.getAttribute('data-wp-camera-fit-distance'));
    const camera = new PerspectiveCamera(30, rect.width / rect.height, 0.1, distance * 4);
    camera.position.z = distance;
    camera.updateMatrixWorld();
    const actualPose = await page.evaluate(() => window.__webpodDevicePreview?.get().orientation);
    if (!actualPose) throw new Error("Pose missing");
    const rotation = new Euler(...deviceOrientationToRotation(actualPose));
    const project = (x: number, y: number) => {
      // Project the visible physical wheel, independently of its input mesh.
      const bx = DEVICE_LAYOUT.wheel.centerX + x, by = DEVICE_LAYOUT.wheel.centerY + y;
      const p = new Vector3(bx, by, DEFAULT_FRONT_ASSEMBLY_DEPTHS.wheelSurfaceBaseZ + frontShellOffsetAt(bx, by))
        .sub(new Vector3(...DEFAULT_DEVICE_ENVELOPE.center)).applyEuler(rotation).project(camera);
      return { x: rect.x + (p.x + 1) * rect.width / 2, y: rect.y + (1 - p.y) * rect.height / 2 };
    };
    for (const angle of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const rad = angle * Math.PI / 180;
      for (const [radius, active] of [[DEVICE_LAYOUT.wheel.outerR - 1, true], [DEVICE_LAYOUT.wheel.outerR + 1, false]] as const) {
        await page.mouse.move(5, 5);
        const p = project(Math.cos(rad) * radius, Math.sin(rad) * radius);
        await page.mouse.move(p.x, p.y);
        if (active) await expect(canvas).toHaveAttribute('data-wp-cursor-control', 'true');
        else await expect(canvas).not.toHaveAttribute('data-wp-cursor-control', 'true');
        results.push({ pose, angle, radius, active });
      }
    }
    // Native Select click reaches the highlighted Albums item at every pose.
    const panel = page.locator('.wp-panel');
    await panel.focus();
    for (let i = 0; i < 8; i++) await panel.press('Escape');
    const p = project(0, 0);
    await page.mouse.click(p.x, p.y);
    await expect(panel.getByRole('listbox', { name: 'Albums', exact: true })).toBeAttached();
    const menu = project(0, 70);
    await page.mouse.click(menu.x, menu.y);
    await expect(panel.getByRole('listbox', { name: 'Music categories' })).toBeAttached();
  }
  await Bun.write(`${import.meta.dirname}/fit-input.json`, JSON.stringify(results, null, 2));
  console.log(`${results.length} visible-boundary samples and 8 physical button actions passed across four poses`);
} finally { await browser.close(); }
