import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  expect,
  test,
  type Browser,
  type Page,
} from "../../../packages/panel/node_modules/@playwright/test/index.js";

const evidenceDirectory = resolve(
  process.env["VOLUMETRIC_DEVICE_BROWSER_EVIDENCE_DIR"] ??
    resolve(import.meta.dirname, "test-results/volumetric-device-browser"),
);
const baseURL = `http://127.0.0.1:${String(Number(process.env["W5B_PORT"] ?? "4317"))}`;

type Pose = "front" | "three-quarter" | "edge" | "rear";
type Colourway = "black" | "white";

test.use({
  channel: "chrome",
  launchOptions: { args: ["--enable-blink-features=CanvasDrawElement"] },
});

async function prepare(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto("/_spike/device?capture", { waitUntil: "domcontentloaded" });
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
  });
  const root = page.locator(".webpod-device-preview__device");
  await expect(root).toHaveAttribute("data-composite-tier", "T1");
  await expect(root.locator("canvas")).toBeVisible();
  await expect
    .poll(() => root.locator("canvas").getAttribute("data-wp-composite-source-state"))
    .toBe("painted");
  await expect.poll(() => root.locator("canvas").getAttribute("data-wp-camera-fit-distance")).not.toBeNull();
}

async function setPreview(
  page: Page,
  pose: Pose,
  colourway: Colourway,
): Promise<void> {
  await page.evaluate(({ nextPose, nextColourway }) => {
    const api = window.__webpodDevicePreview;
    if (api === undefined) throw new Error("device preview API is absent");
    api.setColourway(nextColourway);
    api.setPose(nextPose);
  }, { nextPose: pose, nextColourway: colourway });
  await expect(page.locator(".webpod-device-preview")).toHaveAttribute("data-pose", pose);
  await expect(page.locator(".webpod-device-preview")).toHaveAttribute("data-colourway", colourway);
  await page.waitForTimeout(80);
}

async function expectFitInsideSafeArea(page: Page): Promise<Record<string, number>> {
  const canvas = page.locator(".webpod-device-preview canvas");
  const diagnostics = await canvas.evaluate((element) => {
    const value = (name: string): number => {
      const raw = element.getAttribute(name);
      if (raw === null) throw new Error(`missing ${name}`);
      return Number(raw);
    };
    return {
      distance: value("data-wp-camera-fit-distance"),
      padding: value("data-wp-camera-fit-padding"),
      extentX: value("data-wp-projected-extent-x"),
      extentY: value("data-wp-projected-extent-y"),
      limitX: value("data-wp-projected-limit-x"),
      limitY: value("data-wp-projected-limit-y"),
    };
  });
  expect(diagnostics.extentX).toBeLessThanOrEqual(diagnostics.limitX + 0.000002);
  expect(diagnostics.extentY).toBeLessThanOrEqual(diagnostics.limitY + 0.000002);
  expect(diagnostics.padding).toBe(34);
  expect(diagnostics.distance).toBeGreaterThan(0);
  return diagnostics;
}

async function expectNoOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    clientHeight: document.documentElement.clientHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
  expect(dimensions.scrollHeight).toBe(dimensions.clientHeight);
}

async function expectNativePanelGeometryAligned(page: Page): Promise<void> {
  const alignment = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      ".webpod-device-preview__device canvas",
    );
    const panel = document.querySelector<HTMLElement>(".wp-composite-panel-host");
    if (canvas === null || panel === null) throw new Error("composite geometry is absent");
    const canvasRect = canvas.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const number = (key: string): number => {
      const raw = canvas.dataset[key];
      if (raw === undefined) throw new Error(`missing ${key}`);
      return Number(raw);
    };
    return {
      panel: {
        left: panelRect.left,
        top: panelRect.top,
        width: panelRect.width,
        height: panelRect.height,
      },
      projected: {
        left: canvasRect.left + number("wpScreenClipLeft"),
        top: canvasRect.top + number("wpScreenClipTop"),
        width: number("wpScreenClipWidth"),
        height: number("wpScreenClipHeight"),
      },
    };
  });
  for (const key of ["left", "top", "width", "height"] as const) {
    expect(Math.abs(alignment.panel[key] - alignment.projected[key])).toBeLessThan(2);
  }
}

async function capture(page: Page, filename: string): Promise<string> {
  const path = resolve(evidenceDirectory, filename);
  const bytes = await page.screenshot({ path });
  return createHash("sha256").update(bytes).digest("hex");
}

async function sourceHealth(page: Page): Promise<{ expected: string; current: string }> {
  return page.evaluate(async () => {
    const response = await fetch("/__webpod_health", { cache: "no-store" });
    if (!response.ok) throw new Error(`source health returned ${String(response.status)}`);
    return response.json() as Promise<{ expected: string; current: string }>;
  });
}

async function verifyDpr(browser: Browser, dpr: 1 | 2 | 3): Promise<Record<string, number>> {
  const context = await browser.newContext({
    baseURL,
    deviceScaleFactor: dpr,
    viewport: { width: 430, height: 932 },
  });
  const page = await context.newPage();
  try {
    await prepare(page, 430, 932);
    const result = await page.locator(".webpod-device-preview canvas").evaluate((canvas) => ({
      density: Number(canvas.getAttribute("data-wp-raster-density")),
      rasterWidth: Number(canvas.getAttribute("data-wp-raster-pixel-width")),
      rasterHeight: Number(canvas.getAttribute("data-wp-raster-pixel-height")),
      webglWidth: (canvas as HTMLCanvasElement).width,
      webglHeight: (canvas as HTMLCanvasElement).height,
    }));
    expect(result.density).toBe(dpr);
    expect(result.rasterWidth).toBe(320 * dpr);
    expect(result.rasterHeight).toBe(240 * dpr);
    expect(result.webglWidth).toBe(430 * dpr);
    expect(result.webglHeight).toBe(932 * dpr);
    return result;
  } finally {
    await context.close();
  }
}

test.describe("true-3D device route", () => {
  test.beforeAll(async () => mkdir(evidenceDirectory, { recursive: true }));

  test("fits real model bounds, preserves T1 acuity, and captures every physical pose", async ({
    page,
    browser,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await prepare(page, 1024, 768);
    const health = await sourceHealth(page);
    expect(health.current).toBe(health.expected);
    await expectNoOverflow(page);

    const captures: Array<Record<string, unknown>> = [];
    const cases: ReadonlyArray<{
      pose: Pose;
      colourway: Colourway;
      filename: string;
    }> = [
      { pose: "front", colourway: "black", filename: "true3d-front-black.png" },
      { pose: "front", colourway: "white", filename: "true3d-front-white.png" },
      { pose: "three-quarter", colourway: "black", filename: "true3d-quarter-black.png" },
      { pose: "edge", colourway: "black", filename: "true3d-edge-black.png" },
      { pose: "rear", colourway: "white", filename: "true3d-rear-steel.png" },
    ];
    for (const item of cases) {
      await setPreview(page, item.pose, item.colourway);
      const fit = await expectFitInsideSafeArea(page);
      const hash = await capture(page, item.filename);
      captures.push({ ...item, fit, hash });
    }

    await page.evaluate(() => {
      const api = window.__webpodDevicePreview;
      if (api === undefined) throw new Error("device preview API is absent");
      api.setColourway("black");
      api.setOrientation({ pitchDeg: 42, yawDeg: -20, rollDeg: 0 });
    });
    await expect(page.locator(".webpod-device-preview")).toHaveAttribute(
      "data-pose",
      "custom",
    );
    await page.waitForTimeout(80);
    const topFit = await expectFitInsideSafeArea(page);
    const topHash = await capture(page, "true3d-top-controls.png");
    captures.push({
      pose: "top-controls",
      colourway: "black",
      filename: "true3d-top-controls.png",
      fit: topFit,
      hash: topHash,
    });

    await page.setViewportSize({ width: 375, height: 812 });
    await setPreview(page, "three-quarter", "black");
    const mobileFit = await expectFitInsideSafeArea(page);
    await expectNoOverflow(page);
    const mobileHash = await capture(page, "true3d-mobile-375x812.png");

    const panel = page.locator('[role="application"][aria-label="webPod music player"]');
    await panel.focus();
    const before = await page.locator('[aria-current="true"]').textContent();
    await panel.press("ArrowDown");
    const after = await page.locator('[aria-current="true"]').textContent();
    expect(after).not.toBe(before);

    await setPreview(page, "front", "black");
    await expectNativePanelGeometryAligned(page);
    const panelBounds = await panel.boundingBox();
    if (panelBounds === null) throw new Error("native panel has no hit-test bounds");
    await page.mouse.click(
      panelBounds.x + panelBounds.width / 2,
      panelBounds.y + panelBounds.height / 2,
    );
    await expect(panel).toBeFocused();

    const orientationBeforePlainDrag = await page.evaluate(
      () => window.__webpodDevicePreview?.get().orientation,
    );
    await page.mouse.move(18, 18);
    await page.mouse.down();
    await page.mouse.move(88, 52);
    await page.mouse.up();
    expect(await page.evaluate(() => window.__webpodDevicePreview?.get().orientation))
      .toEqual(orientationBeforePlainDrag);

    await page.keyboard.down("Shift");
    await page.mouse.move(18, 18);
    await page.mouse.down();
    await page.mouse.move(88, 52);
    await page.mouse.up();
    await page.keyboard.up("Shift");
    expect(await page.evaluate(() => window.__webpodDevicePreview?.get().pose)).toBe("custom");

    const dpr = {
      1: await verifyDpr(browser, 1),
      2: await verifyDpr(browser, 2),
      3: await verifyDpr(browser, 3),
    };
    expect(pageErrors).toEqual([]);
    await writeFile(
      resolve(evidenceDirectory, "summary.json"),
      `${JSON.stringify({ route: "/_spike/device?capture", health, captures, mobileFit, mobileHash, dpr, pageErrors }, null, 2)}\n`,
    );
  });
});
