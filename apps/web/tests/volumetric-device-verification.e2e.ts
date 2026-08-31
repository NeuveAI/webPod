import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  expect,
  test,
  type Locator,
  type Page,
} from "../../../packages/panel/node_modules/@playwright/test/index.js";

const evidenceDirectory = resolve(
  process.env["VOLUMETRIC_DEVICE_BROWSER_EVIDENCE_DIR"] ??
    resolve(import.meta.dirname, "test-results/volumetric-device-browser"),
);

type DevicePoseSummary = {
  readonly name: string;
  readonly pose: string;
  readonly colourway: "black" | "white";
  readonly probeFace: string;
  readonly screenshot: string;
  readonly hash: string;
};

type CanonicalPoseSummary = DevicePoseSummary & {
  readonly verificationMode: "canonical-luminance";
  readonly readingCount: number;
  readonly failTokens: readonly string[];
  readonly maxAbsDelta: number;
};

type PhysicalPoseSummary = DevicePoseSummary & {
  readonly verificationMode: "physical-continuity";
  readonly sampleError: string;
};

type AnimatedFrameSummary = {
  readonly index: number;
  readonly orientation: {
    readonly pitchDeg: number;
    readonly yawDeg: number;
    readonly rollDeg: number;
  };
  readonly pose: string;
  readonly probeFace: string;
  readonly screenshot: string;
  readonly hash: string;
};

test.use({
  channel: "chrome",
  launchOptions: {
    args: ["--enable-blink-features=CanvasDrawElement"],
  },
});

async function freezeVisuals(page: Page): Promise<void> {
  await page.addStyleTag({
    content:
      "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
  });
}

async function afterTwoFrames(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

async function settleDevicePaint(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const calibration = Reflect.get(window, "__deviceCalibration");
        return typeof calibration === "object" && calibration !== null;
      }),
    )
    .toBe(true);
  const readingCount = await page.evaluate(() => {
    const calibration = Reflect.get(window, "__deviceCalibration");
    if (typeof calibration !== "object" || calibration === null) {
      throw new Error("Device calibration API is not mounted");
    }
    const sample = Reflect.get(calibration, "sample");
    if (typeof sample !== "function") {
      throw new Error("Device sample command is absent");
    }
    const result = Reflect.apply(sample, calibration, []);
    return Array.isArray(result) ? result.length : 0;
  });
  expect(readingCount).toBeGreaterThan(0);
  await afterTwoFrames(page);
}

async function expectNoViewportOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
}

async function expectCentred(locator: Locator, page: Page): Promise<void> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (box === null || viewport === null) return;
  const elementCentre = box.x + box.width / 2;
  expect(Math.abs(elementCentre - viewport.width / 2)).toBeLessThanOrEqual(1);
}

async function expectAuthoredDeviceRatio(locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (box === null) return;
  expect(box.width).toBeLessThanOrEqual(330.01);
  expect(box.height).toBeLessThanOrEqual(552.01);
  expect(Math.abs(box.width / box.height - 330 / 552)).toBeLessThan(0.002);
}

async function expectContainedVertically(
  locator: Locator,
  viewportHeight: number,
): Promise<void> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (box === null) return;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewportHeight);
}

function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function captureStage(
  stage: Locator,
  filename: string,
): Promise<{ readonly screenshot: string; readonly hash: string }> {
  const screenshot = resolve(evidenceDirectory, filename);
  const buffer = await stage.screenshot({ path: screenshot });
  return { screenshot, hash: hashBuffer(buffer) };
}

async function setDevicePose(
  page: Page,
  patch: Record<string, unknown>,
): Promise<{ readonly pose: string; readonly probeFace: string }> {
  return page.evaluate((nextPatch) => {
    const calibration = Reflect.get(window, "__deviceCalibration");
    if (typeof calibration !== "object" || calibration === null) {
      throw new Error("Device calibration API is not mounted");
    }
    const setParams = Reflect.get(calibration, "setParams");
    const getParams = Reflect.get(calibration, "getParams");
    if (typeof setParams !== "function" || typeof getParams !== "function") {
      throw new Error("Device calibration API is incomplete");
    }
    Reflect.apply(setParams, calibration, [nextPatch]);
    const params = Reflect.apply(getParams, calibration, []);
    if (typeof params !== "object" || params === null) {
      throw new Error("Device calibration state is unreadable");
    }
    const pose = Reflect.get(params, "pose");
    const probeFace = Reflect.get(params, "probeFace");
    if (typeof pose !== "string" || typeof probeFace !== "string") {
      throw new Error("Device calibration state omitted pose identity");
    }
    return { pose, probeFace };
  }, patch);
}

async function readCanonicalSample(page: Page): Promise<{
  readonly readingCount: number;
  readonly failTokens: readonly string[];
  readonly maxAbsDelta: number;
}> {
  return page.evaluate(() => {
    const calibration = Reflect.get(window, "__deviceCalibration");
    if (typeof calibration !== "object" || calibration === null) {
      throw new Error("Device calibration API is not mounted");
    }
    const sample = Reflect.get(calibration, "sample");
    if (typeof sample !== "function") {
      throw new Error("Device sample command is absent");
    }
    const results = Reflect.apply(sample, calibration, []);
    if (!Array.isArray(results)) {
      throw new Error("Device sample command did not return an array");
    }
    const failTokens = results
      .filter((result) => {
        const pass = Reflect.get(result, "pass");
        return pass !== true;
      })
      .map((result) => String(Reflect.get(result, "token")));
    const maxAbsDelta = results.reduce((max, result) => {
      const delta = Number(Reflect.get(result, "delta"));
      return Math.max(max, Math.abs(delta));
    }, 0);
    return {
      readingCount: results.length,
      failTokens,
      maxAbsDelta,
    };
  });
}

async function readNonCanonicalSampleError(page: Page): Promise<string> {
  return page.evaluate(() => {
    const calibration = Reflect.get(window, "__deviceCalibration");
    if (typeof calibration !== "object" || calibration === null) {
      throw new Error("Device calibration API is not mounted");
    }
    const sample = Reflect.get(calibration, "sample");
    if (typeof sample !== "function") {
      throw new Error("Device sample command is absent");
    }
    try {
      Reflect.apply(sample, calibration, []);
      throw new Error("non-canonical sample unexpectedly succeeded");
    } catch (error) {
      if (!(error instanceof Error)) return String(error);
      return error.message;
    }
  });
}

async function readSourceHealth(page: Page): Promise<{
  readonly expected: string;
  readonly current: string;
  readonly fileCount: number;
}> {
  return page.evaluate(async () => {
    const response = await fetch("/__webpod_health", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`source health returned ${String(response.status)}`);
    }
    return response.json() as Promise<{
      readonly expected: string;
      readonly current: string;
      readonly fileCount: number;
    }>;
  });
}

test.describe("volumetric device verification", () => {
  test.beforeAll(async () => {
    await mkdir(evidenceDirectory, { recursive: true });
  });

  test("keeps canonical luminance and rotated physical-continuity verification distinct", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/_spike/device?capture", { waitUntil: "domcontentloaded" });
    await freezeVisuals(page);

    const stage = page.locator(".webpod-device-spike__stage");
    await expect(stage).toBeVisible();
    await expect(stage.locator("canvas")).toBeVisible();
    await settleDevicePaint(page);
    await expectNoViewportOverflow(page);
    await expectCentred(stage, page);
    await expectAuthoredDeviceRatio(stage);
    await expectContainedVertically(stage, 844);

    const sourceHealth = await readSourceHealth(page);
    expect(sourceHealth.current).toBe(sourceHealth.expected);
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const canonicalCases = [
      {
        name: "black-front",
        colourway: "black" as const,
        patch: { colourway: "black", face: "front" },
        expectedPose: "front",
        expectedProbeFace: "front",
        screenshot: "device-front-black.png",
      },
      {
        name: "white-front",
        colourway: "white" as const,
        patch: { colourway: "white", face: "front" },
        expectedPose: "front",
        expectedProbeFace: "front",
        screenshot: "device-front-white.png",
      },
      {
        name: "steel-rear",
        colourway: "white" as const,
        patch: { colourway: "white", face: "back" },
        expectedPose: "rear",
        expectedProbeFace: "back",
        screenshot: "device-rear-white.png",
      },
    ];

    const canonical: CanonicalPoseSummary[] = [];
    for (const item of canonicalCases) {
      const state = await setDevicePose(page, item.patch);
      expect(state.pose).toBe(item.expectedPose);
      expect(state.probeFace).toBe(item.expectedProbeFace);
      const sample = await readCanonicalSample(page);
      expect(sample.readingCount).toBeGreaterThan(0);
      expect(sample.failTokens).toEqual([]);
      expect(sample.maxAbsDelta).toBeLessThanOrEqual(4);
      const capture = await captureStage(stage, item.screenshot);
      canonical.push({
        name: item.name,
        pose: state.pose,
        colourway: item.colourway,
        probeFace: state.probeFace,
        verificationMode: "canonical-luminance",
        readingCount: sample.readingCount,
        failTokens: sample.failTokens,
        maxAbsDelta: sample.maxAbsDelta,
        screenshot: capture.screenshot,
        hash: capture.hash,
      });
    }

    const rotatedCases = [
      {
        name: "three-quarter-black",
        colourway: "black" as const,
        patch: { colourway: "black", pose: "three-quarter" },
        expectedPose: "three-quarter",
        expectedProbeFace: "front",
        screenshot: "device-three-quarter-black.png",
      },
      {
        name: "edge-white",
        colourway: "white" as const,
        patch: { colourway: "white", pose: "edge" },
        expectedPose: "edge",
        expectedProbeFace: "right",
        screenshot: "device-edge-white.png",
      },
      {
        name: "custom-flip-white",
        colourway: "white" as const,
        patch: {
          colourway: "white",
          orientation: { pitchDeg: 12, yawDeg: -128, rollDeg: 0 },
        },
        expectedPose: "custom",
        expectedProbeFace: "back",
        screenshot: "device-custom-flip-white.png",
      },
    ];

    const physical: PhysicalPoseSummary[] = [];
    for (const item of rotatedCases) {
      const state = await setDevicePose(page, item.patch);
      expect(state.pose).toBe(item.expectedPose);
      expect(state.probeFace).toBe(item.expectedProbeFace);
      await expectNoViewportOverflow(page);
      await expectCentred(stage, page);
      await expectAuthoredDeviceRatio(stage);
      await expectContainedVertically(stage, 844);
      const sampleError = await readNonCanonicalSampleError(page);
      expect(sampleError).toContain(
        "canonical luminance sampling applies only to the front and rear reference poses",
      );
      expect(sampleError).toContain("physical-continuity validation instead");
      const capture = await captureStage(stage, item.screenshot);
      physical.push({
        name: item.name,
        pose: state.pose,
        colourway: item.colourway,
        probeFace: state.probeFace,
        verificationMode: "physical-continuity",
        sampleError,
        screenshot: capture.screenshot,
        hash: capture.hash,
      });
    }

    const animatedOrientations = [
      { pitchDeg: 0, yawDeg: -12, rollDeg: 0 },
      { pitchDeg: 6, yawDeg: -44, rollDeg: 1.5 },
      { pitchDeg: 4, yawDeg: -88, rollDeg: 0.5 },
      { pitchDeg: 10, yawDeg: -132, rollDeg: -1.5 },
      { pitchDeg: 0, yawDeg: -168, rollDeg: 0 },
    ] as const;

    const animated: AnimatedFrameSummary[] = [];
    let previousHash: string | null = null;
    for (const [index, orientation] of animatedOrientations.entries()) {
      const state = await setDevicePose(page, {
        colourway: "white",
        orientation,
      });
      await expectNoViewportOverflow(page);
      await expectCentred(stage, page);
      await expectAuthoredDeviceRatio(stage);
      const capture = await captureStage(
        stage,
        `device-animated-${String(index).padStart(2, "0")}.png`,
      );
      if (previousHash !== null) expect(capture.hash).not.toBe(previousHash);
      previousHash = capture.hash;
      animated.push({
        index,
        orientation,
        pose: state.pose,
        probeFace: state.probeFace,
        screenshot: capture.screenshot,
        hash: capture.hash,
      });
    }

    expect(pageErrors).toEqual([]);

    const summary = {
      recordedAt: "2026-08-31",
      route: "/_spike/device?capture",
      sourceHealth,
      canonical,
      physical,
      animated,
      pageErrors,
    };
    await writeFile(
      resolve(evidenceDirectory, "summary.json"),
      `${JSON.stringify(summary, null, 2)}\n`,
    );
  });
});
