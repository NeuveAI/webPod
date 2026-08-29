import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const outputArgument = process.argv[2];
if (outputArgument === undefined) throw new Error("Pass an evidence output directory");
const output = resolve(outputArgument);
mkdirSync(output, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--enable-blink-features=CanvasDrawElement"],
});

try {
  const context = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:3000/_spike/device", { waitUntil: "domcontentloaded" });
  await page.locator("canvas").waitFor();
  for (const intensity of [5_000_000, 8_000_000, 11_000_000, 15_500_000] as const) {
    await page.evaluate((nextIntensity) => {
      const calibration = window.__deviceCalibration;
      if (calibration === undefined) throw new Error("device calibration API missing");
      const current = calibration.getParams();
      calibration.setParams({ lightRig: { key: { ...current.lightRig.key, intensity: nextIntensity } } });
    }, intensity);
    await page.waitForTimeout(100);
    await page.locator("canvas").screenshot({ path: resolve(output, `white-${String(intensity)}.png`) });
  }
  for (const variant of [
    { colourway: "black", face: "front" },
    { colourway: "white", face: "back" },
  ] as const) {
    await page.evaluate((next) => {
      const calibration = window.__deviceCalibration;
      if (calibration === undefined) throw new Error("device calibration API missing");
      const current = calibration.getParams();
      calibration.setParams({
        colourway: next.colourway,
        face: next.face,
        lightRig: { key: { ...current.lightRig.key, intensity: 11_000_000 } },
      });
    }, variant);
    await page.waitForTimeout(100);
    await page.locator("canvas").screenshot({
      path: resolve(output, `${variant.colourway}-${variant.face}-11000000.png`),
    });
  }
  await context.close();
} finally {
  await browser.close();
}
