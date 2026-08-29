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
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(
      "http://127.0.0.1:3000/_probe/composite?colourway=white&state=ready&scale=1&fov=30&mode=composited",
      { waitUntil: "domcontentloaded" },
    );
    await page.locator('[data-composite-tier="T1"] canvas').waitFor();
    await page.waitForTimeout(250);

    const metrics = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>("[data-composite-tier='T1']");
      const canvas = root?.querySelector("canvas");
      const panel = canvas?.querySelector<HTMLElement>("[data-raster-density]");
      if (root === null || root === undefined || canvas === null) throw new Error("T1 canvas missing");
      if (panel === null || panel === undefined) throw new Error("DPR-aware panel source missing");
      const bounds = root.getBoundingClientRect();
      return {
        devicePixelRatio: window.devicePixelRatio,
        viewportWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        root: { x: bounds.x, width: bounds.width },
        canvas: {
          cssWidth: canvas.clientWidth,
          cssHeight: canvas.clientHeight,
          width: canvas.width,
          height: canvas.height,
        },
        panel: {
          density: Number(panel.dataset["rasterDensity"]),
          width: panel.offsetWidth,
          height: panel.offsetHeight,
        },
      };
    });

    const expectedWidth = Math.round(metrics.canvas.cssWidth * deviceScaleFactor);
    const expectedHeight = Math.round(metrics.canvas.cssHeight * deviceScaleFactor);
    if (metrics.canvas.width !== expectedWidth || metrics.canvas.height !== expectedHeight) {
      throw new Error(`DPR ${String(deviceScaleFactor)} backing store mismatch: ${JSON.stringify(metrics.canvas)}`);
    }
    if (
      metrics.panel.density !== deviceScaleFactor ||
      metrics.panel.width !== 320 * deviceScaleFactor ||
      metrics.panel.height !== 240 * deviceScaleFactor
    ) {
      throw new Error(`DPR ${String(deviceScaleFactor)} panel raster mismatch: ${JSON.stringify(metrics.panel)}`);
    }
    if (metrics.scrollWidth !== metrics.viewportWidth) {
      throw new Error(`DPR ${String(deviceScaleFactor)} overflowed horizontally: ${JSON.stringify(metrics)}`);
    }
    const left = metrics.root.x;
    const right = metrics.viewportWidth - metrics.root.x - metrics.root.width;
    if (Math.abs(left - right) > 1) {
      throw new Error(`DPR ${String(deviceScaleFactor)} composite is not centered: ${JSON.stringify(metrics.root)}`);
    }
    if (errors.length > 0) throw new Error(`DPR ${String(deviceScaleFactor)} page errors: ${errors.join(" | ")}`);

    await page.screenshot({
      path: resolve(output, `white-mobile-dpr-${String(deviceScaleFactor)}.png`),
      fullPage: false,
    });
    process.stdout.write(`${JSON.stringify({ deviceScaleFactor, metrics })}\n`);
    await context.close();
  }
} finally {
  await browser.close();
}
