import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const outputArgument = process.argv[2];
if (outputArgument === undefined) throw new Error("Pass an evidence output directory");
const output = resolve(outputArgument);
mkdirSync(output, { recursive: true });

const candidates = [
  {
    name: "low",
    subsurfaceAttenuation: 0.012,
    subsurfaceScale: 1,
  },
  {
    name: "balanced",
    subsurfaceAttenuation: 0.018,
    subsurfaceScale: 1.25,
  },
  {
    name: "high",
    subsurfaceAttenuation: 0.026,
    subsurfaceScale: 1.5,
  },
] as const;

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--enable-blink-features=CanvasDrawElement"],
});

try {
  const context = await browser.newContext({
    deviceScaleFactor: 2,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:3000/_spike/device", {
    waitUntil: "domcontentloaded",
  });
  await page.locator("canvas").waitFor();
  await page.waitForFunction(() => window.__deviceCalibration !== undefined);

  for (const candidate of candidates) {
    await page.evaluate((next) => {
      const calibration = window.__deviceCalibration;
      if (calibration === undefined) throw new Error("device calibration API missing");
      const current = calibration.getParams();
      calibration.setParams({
        colourway: "black",
        face: "front",
        room: "dark",
        materials: {
          bodyBlack: {
            ...current.materials.bodyBlack,
            subsurfaceAttenuation: next.subsurfaceAttenuation,
            subsurfaceScale: next.subsurfaceScale,
          },
        },
      });
    }, candidate);
    await page.waitForTimeout(500);
    await page.locator("canvas").screenshot({
      path: resolve(output, `black-${candidate.name}.png`),
    });
  }

  await page.evaluate(() => {
    const calibration = window.__deviceCalibration;
    if (calibration === undefined) throw new Error("device calibration API missing");
    calibration.setParams({ colourway: "white", face: "front", room: "dark" });
  });
  await page.waitForTimeout(500);
  await page.locator("canvas").screenshot({ path: resolve(output, "white-front.png") });
  await page.evaluate(() => {
    const calibration = window.__deviceCalibration;
    if (calibration === undefined) throw new Error("device calibration API missing");
    calibration.setParams({ colourway: "white", face: "back", room: "dark" });
  });
  await page.waitForTimeout(500);
  await page.locator("canvas").screenshot({ path: resolve(output, "steel-back.png") });
  if (errors.length > 0) throw new Error(errors.join(" | "));
  await context.close();
} finally {
  await browser.close();
}
