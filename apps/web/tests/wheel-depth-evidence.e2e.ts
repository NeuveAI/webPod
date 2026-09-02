import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  expect,
  test,
  type Page,
} from "../../../packages/panel/node_modules/@playwright/test/index.js";

const evidenceDirectory = resolve(
  process.env["W9A_DEPTH_EVIDENCE_DIR"] ??
    resolve(import.meta.dirname, "test-results/w9a-wheel-depth"),
);
const rejectedEvidenceDirectory = resolve(
  import.meta.dirname,
  "../../../docs/workstreams/002-implementation-spine/evidence/w9a-depth-only",
);

type Colourway = "black" | "white";
type Pose = "front" | "three-quarter";

test.use({
  channel: "chrome",
  launchOptions: { args: ["--enable-blink-features=CanvasDrawElement"] },
});

async function setPreview(
  page: Page,
  colourway: Colourway,
  pose: Pose,
): Promise<void> {
  await page.evaluate(({ colourway: nextColourway, pose: nextPose }) => {
    const preview = window.__webpodDevicePreview;
    if (preview === undefined) throw new Error("device preview API is absent");
    preview.setColourway(nextColourway);
    preview.setPose(nextPose);
  }, { colourway, pose });
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

async function wheelContactPoint(page: Page): Promise<{
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
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2 + 134 * scale;
  const radius = 70.25 * scale;
  const diagonal = Math.SQRT1_2 * radius;
  return { x: centerX + diagonal, y: centerY - diagonal };
}

type DifferenceShape = {
  readonly changedPixels: number;
  readonly width: number;
  readonly height: number;
  readonly principalAspect: number;
};

async function differenceShape(
  page: Page,
  restPng: Buffer,
  heldPng: Buffer,
): Promise<DifferenceShape> {
  return page.evaluate(
    async ({ restBase64, heldBase64 }) => {
      const decode = async (base64: string): Promise<ImageData> => {
        const image = new Image();
        const ready = new Promise<void>((resolveImage, rejectImage) => {
          image.onload = () => resolveImage();
          image.onerror = () =>
            rejectImage(new Error("wheel evidence image decode failed"));
        });
        image.src = `data:image/png;base64,${base64}`;
        await ready;
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d");
        if (context === null) {
          throw new Error("wheel evidence comparison requires a 2D context");
        }
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, canvas.width, canvas.height);
      };
      const [rest, held] = await Promise.all([
        decode(restBase64),
        decode(heldBase64),
      ]);
      if (rest.width !== held.width || rest.height !== held.height) {
        throw new Error("wheel evidence images have different dimensions");
      }

      // A sub-pixel luma threshold removes codec-free antialias noise while
      // retaining the deliberately shallow 0.08 mm lighting response.
      const threshold = 0.75;
      let changedPixels = 0;
      let left = rest.width;
      let top = rest.height;
      let right = -1;
      let bottom = -1;
      let totalWeight = 0;
      let weightedX = 0;
      let weightedY = 0;
      let weightedXX = 0;
      let weightedXY = 0;
      let weightedYY = 0;
      for (let y = 0; y < rest.height; y += 1) {
        for (let x = 0; x < rest.width; x += 1) {
          const offset = (y * rest.width + x) * 4;
          const luma = (data: Uint8ClampedArray): number =>
            0.2126 * (data[offset] ?? 0) +
            0.7152 * (data[offset + 1] ?? 0) +
            0.0722 * (data[offset + 2] ?? 0);
          const difference = Math.abs(luma(rest.data) - luma(held.data));
          if (difference <= threshold) continue;
          const weight = difference - threshold;
          changedPixels += 1;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
          totalWeight += weight;
          weightedX += weight * x;
          weightedY += weight * y;
          weightedXX += weight * x * x;
          weightedXY += weight * x * y;
          weightedYY += weight * y * y;
        }
      }
      if (changedPixels === 0 || totalWeight === 0) {
        return { changedPixels: 0, width: 0, height: 0, principalAspect: 1 };
      }
      const meanX = weightedX / totalWeight;
      const meanY = weightedY / totalWeight;
      const covarianceXX = weightedXX / totalWeight - meanX * meanX;
      const covarianceXY = weightedXY / totalWeight - meanX * meanY;
      const covarianceYY = weightedYY / totalWeight - meanY * meanY;
      const trace = covarianceXX + covarianceYY;
      const discriminant = Math.sqrt(
        Math.max(
          0,
          (covarianceXX - covarianceYY) ** 2 + 4 * covarianceXY ** 2,
        ),
      );
      const major = Math.max(0, (trace + discriminant) / 2);
      const minor = Math.max(1e-9, (trace - discriminant) / 2);
      return {
        changedPixels,
        width: right - left + 1,
        height: bottom - top + 1,
        principalAspect: Math.sqrt(major / minor),
      };
    },
    {
      restBase64: restPng.toString("base64"),
      heldBase64: heldPng.toString("base64"),
    },
  );
}

test("production pointer proves depth-only wheel geometry in both finishes and poses", async ({
  page,
}) => {
  await mkdir(evidenceDirectory, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.goto("/_spike/device", { waitUntil: "domcontentloaded" });
  const root = page.locator(".webpod-device-preview__device");
  const canvas = root.locator("canvas");
  await expect(root).toHaveAttribute("data-composite-tier", "T1");
  await expect(canvas).toBeVisible();
  await expect
    .poll(() => canvas.getAttribute("data-wp-camera-fit-distance"))
    .not.toBeNull();

  const health = await page.evaluate(async () => {
    const response = await fetch("/__webpod_health", { cache: "no-store" });
    if (!response.ok) throw new Error(`health returned ${String(response.status)}`);
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
    readonly state: "rest" | "held" | "released";
    readonly filename: string;
    readonly sha256: string;
  }> = [];
  const captureBytes = new Map<string, Buffer>();

  const recordCapture = async (
    colourway: Colourway,
    pose: Pose,
    state: "rest" | "held" | "released",
  ): Promise<void> => {
    const filename = `${colourway}-${pose}-${state}.png`;
    const path = resolve(evidenceDirectory, filename);
    const bytes = await root.screenshot({
      path,
      animations: "disabled",
    });
    captureBytes.set(`${colourway}-${pose}-${state}`, bytes);
    captures.push({
      colourway,
      pose,
      state,
      filename,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  };

  for (const colourway of ["black", "white"] as const) {
    for (const pose of ["front", "three-quarter"] as const) {
      await setPreview(page, colourway, pose);
      await recordCapture(colourway, pose, "rest");
    }

    await setPreview(page, colourway, "front");
    const contact = await wheelContactPoint(page);
    await page.mouse.move(contact.x, contact.y);
    await page.mouse.down();
    await expect(root).toHaveAttribute("data-wp-wheel-gesture", "active");
    await page.waitForTimeout(80);

    await recordCapture(colourway, "front", "held");

    await setPreview(page, colourway, "three-quarter");
    await recordCapture(colourway, "three-quarter", "held");

    await page.mouse.up();
    await expect(root).not.toHaveAttribute("data-wp-wheel-gesture", "active");
    await page.waitForTimeout(180);
    await recordCapture(colourway, "three-quarter", "released");

    await setPreview(page, colourway, "front");
    await recordCapture(colourway, "front", "released");
  }

  expect(captures).toHaveLength(12);
  const visualComparisons: Array<{
    readonly colourway: Colourway;
    readonly pose: Pose;
    readonly corrected: DifferenceShape;
    readonly rejected: DifferenceShape;
  }> = [];
  for (const colourway of ["black", "white"] as const) {
    for (const pose of ["front", "three-quarter"] as const) {
      const rest = captureBytes.get(`${colourway}-${pose}-rest`);
      const held = captureBytes.get(`${colourway}-${pose}-held`);
      if (rest === undefined || held === undefined) {
        throw new Error("corrected wheel evidence is incomplete");
      }
      const rejectedRest = await readFile(
        resolve(rejectedEvidenceDirectory, `${colourway}-${pose}-rest.png`),
      );
      const rejectedHeld = await readFile(
        resolve(rejectedEvidenceDirectory, `${colourway}-${pose}-held.png`),
      );
      const corrected = await differenceShape(page, rest, held);
      const rejected = await differenceShape(page, rejectedRest, rejectedHeld);
      expect(corrected.changedPixels).toBeGreaterThan(0);
      visualComparisons.push({ colourway, pose, corrected, rejected });
    }
  }
  const rejectedWhiteQuarter = visualComparisons.find(
    ({ colourway, pose }) =>
      colourway === "white" && pose === "three-quarter",
  );
  if (rejectedWhiteQuarter === undefined) {
    throw new Error("white three-quarter comparison is absent");
  }
  expect(rejectedWhiteQuarter.corrected.changedPixels).toBeLessThan(
    rejectedWhiteQuarter.rejected.changedPixels * 0.8,
  );
  expect(rejectedWhiteQuarter.corrected.principalAspect).toBeLessThan(
    rejectedWhiteQuarter.rejected.principalAspect,
  );
  await writeFile(
    resolve(evidenceDirectory, "summary.json"),
    `${JSON.stringify(
      {
        route: "/_spike/device",
        browser: "Chrome with CanvasDrawElement enabled",
        productionPointerLifecycle: [
          "mouse.move",
          "mouse.down",
          "data-wp-wheel-gesture=active",
          "hold",
          "mouse.up",
          "release settle",
        ],
        syntheticControlPose: false,
        controlQueryParameter: false,
        wheelTravelMm: 0.08,
        visualComparison: {
          rejectedBaseline: "evidence/w9a-depth-only",
          thresholdLuma: 0.75,
          visualComparisons,
        },
        health,
        captures,
      },
      null,
      2,
    )}\n`,
  );
});
