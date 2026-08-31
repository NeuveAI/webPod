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
  for (const deviceScaleFactor of [1, 2, 3] as const) {
    const context = await browser.newContext({
      deviceScaleFactor,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto(
      "http://127.0.0.1:3000/_probe/composite?colourway=black&state=ready&scale=1&fov=30&mode=composited",
      { waitUntil: "domcontentloaded" },
    );
    const canvas = page.locator('[data-composite-tier="T1"] canvas');
    await canvas.waitFor();
    await page.waitForFunction(() =>
      document.querySelector("[data-raster-density]")?.getAttribute("data-raster-density") ===
      String(window.devicePixelRatio),
    );
    await page.waitForTimeout(300);
    const bytes = await canvas.screenshot({
      path: resolve(output, `lcd-native-dpr-${String(deviceScaleFactor)}.png`),
    });
    const metric = await page.evaluate(async (encoded) => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(encoded)]));
      const target = new OffscreenCanvas(272, 204);
      const context2d = target.getContext("2d", { willReadFrequently: true });
      if (context2d === null) throw new Error("2D acuity context unavailable");
      context2d.imageSmoothingEnabled = false;
      // The front-facing 272×204 LCD occupies this calibrated region of the
      // native 330×552 device canvas. Normalize before comparing DPRs.
      context2d.drawImage(
        bitmap,
        bitmap.width * 0.105,
        bitmap.height * 0.115,
        bitmap.width * 0.79,
        bitmap.height * 0.37,
        0,
        0,
        272,
        204,
      );
      bitmap.close();
      const { data } = context2d.getImageData(0, 0, 272, 204);
      const luminance = new Float64Array(272 * 204);
      for (let index = 0; index < luminance.length; index += 1) {
        const offset = index * 4;
        luminance[index] =
          (data[offset] ?? 0) * 0.2126 +
          (data[offset + 1] ?? 0) * 0.7152 +
          (data[offset + 2] ?? 0) * 0.0722;
      }
      const gradients: number[] = [];
      for (let y = 8; y < 196; y += 1) {
        for (let x = 8; x < 264; x += 1) {
          const here = luminance[y * 272 + x] ?? 0;
          gradients.push(Math.abs(here - (luminance[y * 272 + x + 1] ?? 0)));
          gradients.push(Math.abs(here - (luminance[(y + 1) * 272 + x] ?? 0)));
        }
      }
      gradients.sort((a, b) => a - b);
      const percentile = (fraction: number): number =>
        gradients[Math.floor((gradients.length - 1) * fraction)] ?? 0;
      const rows = Array.from({ length: 204 }, (_, y) => {
        let sum = 0;
        for (let x = 12; x < 260; x += 1) sum += luminance[y * 272 + x] ?? 0;
        return sum / 248;
      });
      let periodicResidual = 0;
      let periodicSamples = 0;
      for (let y = 12; y < 192; y += 1) {
        const local = ((rows[y - 1] ?? 0) + (rows[y] ?? 0) + (rows[y + 1] ?? 0)) / 3;
        periodicResidual += Math.abs((rows[y] ?? 0) - local);
        periodicSamples += 1;
      }
      return {
        edgeP95: percentile(0.95),
        edgeP99: percentile(0.99),
        rowHighFrequencyMean: periodicResidual / periodicSamples,
      };
    }, Array.from(bytes));
    const minimumP95 = { 1: 14, 2: 23, 3: 27 }[deviceScaleFactor];
    if (metric.edgeP95 < minimumP95) {
      throw new Error(
        `DPR ${String(deviceScaleFactor)} LCD edge acuity ${metric.edgeP95.toFixed(3)} is below ${String(minimumP95)}`,
      );
    }
    process.stdout.write(`${JSON.stringify({ deviceScaleFactor, metric })}\n`);
    await context.close();
  }
} finally {
  await browser.close();
}
