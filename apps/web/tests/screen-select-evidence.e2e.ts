import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  expect,
  test,
  type Page,
} from "../../../packages/panel/node_modules/@playwright/test/index.js";

const evidenceDirectory = resolve(
  process.env["SCREEN_SELECT_EVIDENCE_DIR"] ??
    resolve(import.meta.dirname, "test-results/screen-select-correction"),
);

type Colourway = "black" | "white";
type Pose = "front" | "three-quarter";
type State = "rest" | "held" | "released";

test.use({
  channel: "chrome",
  launchOptions: { args: ["--enable-blink-features=CanvasDrawElement"] },
});

async function setPreview(
  page: Page,
  colourway: Colourway,
  pose: Pose,
): Promise<void> {
  await page.evaluate(
    ({ colourway: nextColourway, pose: nextPose }) => {
      const preview = window.__webpodDevicePreview;
      if (preview === undefined) throw new Error("device preview API is absent");
      preview.setColourway(nextColourway);
      preview.setPose(nextPose);
    },
    { colourway, pose },
  );
  await expect(page.locator(".webpod-device-preview")).toHaveAttribute(
    "data-colourway",
    colourway,
  );
  await expect(page.locator(".webpod-device-preview")).toHaveAttribute(
    "data-pose",
    pose,
  );
  await page.waitForTimeout(100);
}

async function selectCenter(page: Page): Promise<{
  readonly x: number;
  readonly y: number;
}> {
  const canvas = page.locator(".webpod-device-preview canvas");
  const box = await canvas.boundingBox();
  if (box === null) throw new Error("device canvas has no bounds");
  const extentY = Number(
    await canvas.getAttribute("data-wp-projected-extent-y"),
  );
  const scale = (box.height * extentY) / 552;
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2 + 114 * scale,
  };
}

test("production screen reveal and restrained Select press survive both finishes and poses", async ({
  page,
}) => {
  await mkdir(evidenceDirectory, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.goto("/_spike/device", { waitUntil: "domcontentloaded" });
  await page.addStyleTag({
    content:
      "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
  });

  const root = page.locator(".webpod-device-preview__device");
  const canvas = root.locator("canvas");
  await expect(root).toHaveAttribute("data-composite-tier", "T1");
  await expect(canvas).toBeVisible();
  await expect
    .poll(() => canvas.getAttribute("data-wp-composite-source-state"))
    .toBe("painted");
  await expect
    .poll(() => canvas.getAttribute("data-wp-camera-fit-distance"))
    .not.toBeNull();

  const health = await page.evaluate(async () => {
    const response = await fetch("/__webpod_health", { cache: "no-store" });
    if (!response.ok)
      throw new Error(`health returned ${String(response.status)}`);
    return response.json() as Promise<{
      expected: string;
      current: string;
      reviewedCommit: string | null;
      reviewedTree: string | null;
    }>;
  });
  expect(health.current).toBe(health.expected);

  const captures: Array<{
    readonly colourway: Colourway;
    readonly pose: Pose;
    readonly state: State;
    readonly filename: string;
    readonly sha256: string;
  }> = [];
  const hashes = new Map<string, string>();
  const recordCapture = async (
    colourway: Colourway,
    pose: Pose,
    state: State,
  ): Promise<void> => {
    const filename = `${colourway}-${pose}-${state}.png`;
    const bytes = await root.screenshot({
      path: resolve(evidenceDirectory, filename),
      animations: "disabled",
    });
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    hashes.set(`${colourway}-${pose}-${state}`, sha256);
    captures.push({ colourway, pose, state, filename, sha256 });
  };

  for (const colourway of ["black", "white"] as const) {
    for (const pose of ["front", "three-quarter"] as const) {
      await setPreview(page, colourway, pose);
      await recordCapture(colourway, pose, "rest");
    }

    await setPreview(page, colourway, "front");
    const center = await selectCenter(page);
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.waitForTimeout(80);
    await recordCapture(colourway, "front", "held");

    await setPreview(page, colourway, "three-quarter");
    await recordCapture(colourway, "three-quarter", "held");

    await page.mouse.up();
    await page.waitForTimeout(180);
    await recordCapture(colourway, "three-quarter", "released");

    await setPreview(page, colourway, "front");
    await recordCapture(colourway, "front", "released");
  }

  expect(captures).toHaveLength(12);
  for (const colourway of ["black", "white"] as const) {
    for (const pose of ["front", "three-quarter"] as const) {
      const rest = hashes.get(`${colourway}-${pose}-rest`);
      const held = hashes.get(`${colourway}-${pose}-held`);
      const released = hashes.get(`${colourway}-${pose}-released`);
      expect(rest).toBeDefined();
      expect(held).toBeDefined();
      expect(released).toBe(rest);
      expect(held).not.toBe(rest);
    }
  }

  await writeFile(
    resolve(evidenceDirectory, "summary.json"),
    `${JSON.stringify(
      {
        route: "/_spike/device",
        browser: "Chrome with CanvasDrawElement enabled",
        productionPointerLifecycle: [
          "mouse.move to physical Select center",
          "mouse.down",
          "hold",
          "mouse.up",
          "96ms demand-driven release settle",
        ],
        syntheticControlPose: false,
        controlQueryParameter: false,
        selectTravelMm: 0.12,
        selectMotion: "device-local Z translation only",
        selectMaterialMutation: false,
        selectGeometryMutation: false,
        screenOpening:
          "square aperture wall, flat black unlit reveal, planar cover sheet",
        health,
        captures,
      },
      null,
      2,
    )}\n`,
  );
});
