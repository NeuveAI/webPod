/**
 * Device-lighting rig tuner and luminance evidence generator.
 *
 * ⚑ This is a development-only calibration tool, not product code. It drives the
 * running `/_spike/device` route over CDP, moves the light rig / room / form
 * parameters, and reports how far the render's vertical luminance column is
 * from §4.2–4.5's stop tables. §12.3 says to *"tune the light rig and env map
 * until the numbers match"*; this is that tuning, done by measurement instead
 * of by eye, so the checked luminance evidence is
 * reproducible rather than asserted.
 *
 * Usage — the dev server and a browser session must already be up:
 *   bunx agent-browser --session device-calibration open http://localhost:3000/_spike/device
 *   bun run packages/device/calibration/tune.ts report
 *   bun run packages/device/calibration/tune.ts tune 400
 */
import { setTimeout as sleep } from "node:timers/promises";

import {
  type CalibrationStage,
  mergeOwned,
  ownedPatch,
} from "./stage-ownership";
import { parseEdgeCrownArchive, parseSheenRoughnessArchive } from "./archive-schema";

const CDP_TARGET_URL =
  process.env.DEVICE_CALIBRATION_URL ?? "http://localhost:3000/_spike/device";

type Json = Record<string, unknown>;

/** A minimal CDP client — one page target, `Runtime.evaluate`, nothing else. */
class Page {
  private socket: WebSocket;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (v: Json) => void; reject: (e: Error) => void }
  >();

  private constructor(socket: WebSocket) {
    this.socket = socket;
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as {
        id?: number;
        result?: Json;
        error?: { message: string };
      };
      if (message.id === undefined) return;
      const entry = this.pending.get(message.id);
      if (entry === undefined) return;
      this.pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message));
      else entry.resolve(message.result ?? {});
    });
  }

  static async attach(browserWsUrl: string): Promise<Page> {
    const httpBase = browserWsUrl
      .replace(/^ws:\/\//, "http://")
      .replace(/\/devtools\/.*$/, "");
    const targets = (await (
      await fetch(`${httpBase}/json/list`)
    ).json()) as Array<{
      type: string;
      url: string;
      webSocketDebuggerUrl: string;
    }>;
    const target = targets.find(
      (t) => t.type === "page" && t.url.startsWith(CDP_TARGET_URL),
    );
    if (target === undefined)
      throw new Error(`no page at ${CDP_TARGET_URL}; open it first`);
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener(
        "error",
        () => reject(new Error("CDP socket failed")),
        { once: true },
      );
    });
    return new Page(socket);
  }

  send(method: string, params: Json): Promise<Json> {
    const id = this.nextId++;
    const promise = new Promise<Json>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.socket.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  async evaluate<T>(expression: string): Promise<T> {
    const result = (await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })) as { result?: { value?: T }; exceptionDetails?: { text: string } };
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result?.value as T;
  }

  close() {
    this.socket.close();
  }
}

/** The knobs the tuner is allowed to move, and the bounds it must stay inside. */
type Knob = {
  readonly path: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
};

/**
 * ⚑ **What is and is not tunable, and why.**
 *
 * LAW 2 fixes the key light's *direction* (12 o'clock, 18° behind the viewer)
 * and the fill's *ratio* (22%); neither appears here. What is left free is
 * everything the law does not state: how far away the lights are, how bright
 * the key is, where the fill sits in azimuth and elevation, how the room's
 * profile registers to the surfaces that reflect it, and the curvatures §12.0
 * does not give. Tuning a value the spec states would be fitting the
 * measurement to the model instead of the model to the measurement.
 */
const ROOM_KNOBS: ReadonlyArray<Knob> = [
  { path: "envRoom.elevHalfSpanDeg", min: 5, max: 60, step: 1.0 },
  { path: "envRoom.exposure", min: 0.3, max: 2.2, step: 0.03 },
  { path: "envRoom.profileContrast", min: 0.6, max: 3.5, step: 0.04 },
  { path: "envRoom.profileSharpenAmount", min: 0, max: 4, step: 0.08 },
  { path: "envRoom.profileSharpenSigma", min: 0.004, max: 0.09, step: 0.004 },
  { path: "envRoom.profileSharpenAmount2", min: 0, max: 4, step: 0.08 },
  { path: "envRoom.profileSharpenSigma2", min: 0.002, max: 0.04, step: 0.002 },
  // §5.2 L3 puts the blob upper-**left**; the bounds keep it a sky rather than
  // letting the search park a searchlight on the sampled column.
  { path: "envRoom.sky.intensity", min: 0, max: 3, step: 0.08 },
  { path: "envRoom.sky.sizeDeg", min: 10, max: 60, step: 3 },
  { path: "envRoom.sky.azimuthDeg", min: -70, max: -12, step: 4 },
  { path: "envRoom.sky.elevationDeg", min: 12, max: 70, step: 4 },
  { path: "envRoom.azimuthVariation", min: 0, max: 0.6, step: 0.04 },
  { path: "envRoom.horizon.opacity", min: 0, max: 1, step: 0.05 },
  { path: "envRoom.horizon.widthDeg", min: 0.3, max: 6, step: 0.3 },
  // Per-band pre-exposure is part of EnvRoomParams specifically to invert the
  // roughness + PMREM convolution. Keep it close to unity: this corrects the
  // radiance entering the real steel reflection rather than painting steel.
  ...Array.from({ length: 11 }, (_, index) => ({
    path: `envRoom.stopExposure.${index}`,
    min: 0.85,
    max: 1.15,
    step: 0.01,
  })),
  { path: "cameraDistance", min: 700, max: 3000, step: 40 },
];
const FRONT_KNOBS: ReadonlyArray<Knob> = [
  // LAW 2 leaves the key's distance and strength free; its direction is fixed.
  // The closed-form two-colour solve puts the shared key in the far-field and
  // therefore in the tens of millions of candela. The former 6M ceiling made
  // the saved 19.6M seed immovable: both candidate directions were rejected.
  {
    path: "lightRig.key.intensity",
    min: 20_000,
    max: 80_000_000,
    step: 1_000_000,
  },
  // ⚑ The lower bound matters. §4.2's dead zone at 62% is `#0A0B0D`, which in
  // linear light is *below* the material's own albedo under unit irradiance —
  // so the middle of the face has to be genuinely dark while both edges are
  // bright. That is a statement about **falloff**, and falloff is distance: a
  // light far enough away to be effectively directional cannot produce it.
  { path: "lightRig.key.distance", min: 180, max: 6000, step: 120 },
  { path: "lightRig.fill.azimuthDeg", min: -80, max: -10, step: 4 },
  { path: "lightRig.fill.elevationDeg", min: -75, max: -8, step: 4 },
  { path: "lightRig.fill.distance", min: 150, max: 2400, step: 30 },
  // ⚑ The one §12.3-silent material parameter, and the reason it is here is a
  // finding rather than a convenience — see `decisions/w4.md` W4-D5. The steel
  // is deliberately absent: it stays at 1.0, so the room is still authored to
  // be what the mirror reads as §4.4 and nothing rescales that.
  {
    path: "materials.bodyBlack.envMapIntensity",
    min: 0.005,
    max: 1,
    step: 0.03,
  },
  {
    path: "materials.bodyWhite.envMapIntensity",
    min: 0.005,
    max: 1,
    step: 0.03,
  },
  {
    path: "materials.wheelRingBlack.envMapIntensity",
    min: 0.005,
    max: 1,
    step: 0.03,
  },
  {
    path: "materials.wheelRingWhite.envMapIntensity",
    min: 0.005,
    max: 1,
    step: 0.03,
  },
  {
    path: "materials.selectBlack.envMapIntensity",
    min: 0.005,
    max: 1,
    step: 0.03,
  },
  {
    path: "materials.selectWhite.envMapIntensity",
    min: 0.005,
    max: 1,
    step: 0.03,
  },
  { path: "materials.bodyBlack.albedoScale", min: 0.2, max: 1, step: 0.05 },
  { path: "materials.bodyBlack.roughness", min: 0.2, max: 0.8, step: 0.025 },
  { path: "materials.bodyBlack.clearcoatRoughness", min: 0.03, max: 0.2, step: 0.01 },
  { path: "materials.bodyBlack.reflectivity", min: 0.35, max: 0.85, step: 0.025 },
  { path: "materials.bodyBlack.specularIntensity", min: 0, max: 1, step: 0.05 },
  { path: "materials.bodyBlack.sheen", min: 0, max: 0.6, step: 0.05 },
  // Three 0.185.1 feeds this uniform to both Charlie direct sheen and the
  // integrated IBL sheen BRDF. It is uniform material response, not a map.
  { path: "materials.bodyBlack.sheenRoughness", min: 0.1, max: 1, step: 0.1 },
  { path: "materials.bodyBlack.subsurfaceDistortion", min: 0.05, max: 0.4, step: 0.02 },
  { path: "materials.bodyBlack.subsurfaceAttenuation", min: 0, max: 0.08, step: 0.004 },
  { path: "materials.bodyBlack.subsurfacePower", min: 1, max: 6, step: 0.25 },
  { path: "materials.bodyBlack.subsurfaceScale", min: 0, max: 3, step: 0.1 },
  { path: "materials.bodyWhite.albedoScale", min: 0.7, max: 1.15, step: 0.025 },
  { path: "materials.bodyWhite.roughness", min: 0.2, max: 0.7, step: 0.025 },
  { path: "materials.bodyWhite.clearcoatRoughness", min: 0.03, max: 0.2, step: 0.01 },
  { path: "materials.bodyWhite.reflectivity", min: 0.35, max: 0.7, step: 0.025 },
  { path: "materials.bodyWhite.specularIntensity", min: 0, max: 1, step: 0.05 },
  { path: "materials.wheelRingBlack.clearcoat", min: 0.3, max: 1, step: 0.05 },
  { path: "materials.selectBlack.roughness", min: 0.08, max: 0.5, step: 0.02 },
  { path: "materials.selectBlack.clearcoat", min: 0.3, max: 1, step: 0.05 },
  { path: "materials.selectBlack.clearcoatRoughness", min: 0.02, max: 0.12, step: 0.01 },
  { path: "materials.selectBlack.specularIntensity", min: 0.1, max: 1, step: 0.05 },
  { path: "materials.selectBlack.transmission", min: 0.15, max: 0.65, step: 0.025 },
  { path: "materials.selectBlack.thickness", min: 0.6, max: 2.4, step: 0.05 },
  { path: "materials.selectBlack.attenuationDistance", min: 0.25, max: 4, step: 0.1 },
  { path: "materials.selectWhite.roughness", min: 0.08, max: 0.5, step: 0.02 },
  { path: "materials.selectWhite.clearcoat", min: 0.3, max: 1, step: 0.05 },
  { path: "materials.selectWhite.clearcoatRoughness", min: 0.02, max: 0.12, step: 0.01 },
  { path: "materials.selectWhite.specularIntensity", min: 0.1, max: 1, step: 0.05 },
  { path: "materials.selectWhite.transmission", min: 0.15, max: 0.65, step: 0.025 },
  { path: "materials.wheelRingBlack.roughness", min: 0.2, max: 0.7, step: 0.025 },
  { path: "materials.wheelRingBlack.clearcoatRoughness", min: 0.05, max: 0.35, step: 0.025 },
  ...["bodyBlack", "bodyWhite"].flatMap((surface) =>
    Array.from({ length: 8 }, (_, knot) => ({
      path: `opticalProfiles.${surface}.${knot}.1`, min: -10, max: 10, step: 0.5,
    })),
  ),
  ...["bodyBlackLateral", "bodyWhiteLateral"].flatMap((surface) =>
    Array.from({ length: 8 }, (_, knot) => ({
      path: `opticalProfiles.${surface}.${knot}.1`, min: -12, max: 12, step: 0.5,
    })),
  ),
  ...["bodyBlackRoughness", "bodyWhiteRoughness"].flatMap((surface) =>
    Array.from({ length: 5 }, (_, knot) => ({
      path: `opticalProfiles.${surface}.${knot}.1`, min: 0.1, max: 1, step: 0.05,
    })),
  ),
  ...["wheelBlack", "selectBlack", "selectWhite"].flatMap((surface) =>
    Array.from({ length: 4 }, (_, knot) => ({
      path: `opticalProfiles.${surface}.${knot}.1`, min: -12, max: 12, step: 0.5,
    })),
  ),
  ...["wheelWhite"].flatMap((surface) =>
    Array.from({ length: 4 }, (_, knot) => ({
      path: `opticalProfiles.${surface}.${knot}.1`, min: -12, max: 12, step: 0.5,
    })),
  ),
  // The depths §12.0 does not state.
  { path: "form.ringDishTiltDeg", min: 0, max: 26, step: 0.8 },
  { path: "form.ringDishExponent", min: 1.2, max: 8, step: 0.3 },
  { path: "form.selectDomeTiltDeg", min: 0, max: 26, step: 0.8 },
  { path: "form.selectDomeExponent", min: 1.2, max: 8, step: 0.3 },
  { path: "form.recessDepth", min: 0.5, max: 14, step: 0.5 },
  { path: "form.selectProud", min: 0.5, max: 8, step: 0.4 },
  // §4.2 stop 0 ("top edge") and stop 7 ("bottom edge caustic") are rolled-edge
  // phenomena, not face phenomena — §5.1 L7 calls stop 0 a 1px inner stroke on
  // the top edge. How much of the edge catches the key is the bevel's size.
  // Keep a positive core between the two 5G lid bevels. `frontCoreDepth`
  // enforces the same invariant in production; the tuner should not spend
  // candidates on geometry that cannot exist.
  { path: "form.frontBevel", min: 2.2, max: 6.9, step: 0.4 },
  // One smooth cylindrical crown over the whole front plate. This is the
  // macro-geometry degree D-067 leaves open, not a stop-local normal profile.
  { path: "form.bodyCrown", min: -30, max: 30, step: 2 },
  { path: "form.topEdgeCrown", min: -3, max: 3, step: 0.5 },
  { path: "form.bottomEdgeCrown", min: -3, max: 3, step: 0.5 },
  { path: "form.edgeCrownExtent", min: 18, max: 36, step: 3 },
  { path: "form.seamWidth", min: 1, max: 9, step: 0.4 },
];

const SETTLE_MS = 30;

/**
 * Apply a patch, let React commit, then sample the canonical front/rear views.
 *
 * ⚑ The wait is not superstition. `setParams` notifies a `useSyncExternalStore`
 * subscriber, and React's commit is asynchronous; sampling in the same task
 * measures the *previous* scene and reports it as the new one's score. That
 * failure is silent and it makes a tuner converge on nothing.
 */
const SCORE_EXPR = (patchJson: string, views: string, settleMs: number) => `
(async () => {
  const patch = ${patchJson};
  const set = (obj, path, value) => {
    const parts = path.split('.');
    let node = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      node[parts[i]] = Array.isArray(node[parts[i]]) ? [...node[parts[i]]] : { ...node[parts[i]] };
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
  };
  const base = JSON.parse(JSON.stringify(window.__deviceCalibration.getParams()));
  for (const [path, value] of Object.entries(patch)) set(base, path, value);
  const surfaces = [];
  for (const view of ${views}) {
    const { colourway, face } = view;
    const sampleBase = { ...base, colourway };
    delete sampleBase.pose;
    delete sampleBase.probeFace;
    delete sampleBase.orientation;
    window.__deviceCalibration.setParams({ ...sampleBase, face });
    await new Promise((r) => setTimeout(r, ${settleMs}));
    surfaces.push(...window.__deviceCalibration.sample());
  }
  return JSON.stringify(surfaces);
})()
`;

type Result = {
  surface: string;
  token: string;
  at: number;
  expectedHex: string;
  expectedLuma: number;
  measuredLuma: number;
  measuredRgb: [number, number, number];
  delta: number;
  pass: boolean;
};

type View = {
  readonly name: string;
  readonly colourway: "black" | "white";
  readonly face: "front" | "back";
  readonly pose: "front" | "rear";
  readonly verification: "canonical-luminance";
};

type ReportView = View & {
  readonly results: Array<Result>;
  readonly summary: {
    readonly total: number;
    readonly passing: number;
    readonly failing: number;
    readonly failingTokens: Array<string>;
    readonly worstAbsDelta: number;
    readonly rms: number;
  };
};

/**
 * ⚑ **Two stages, because the two halves of the object are driven by different
 * things** (D-057). The steel's profile comes from the room; the polycarbonate
 * and the wheel are lit. Scoring all forty-three stops together lets the search
 * trade the eleven steel stops away for the thirty-two front ones — which it
 * did, parking a 3.0-intensity blob nine degrees wide directly on the steel's
 * sampled column. Stage one fixes the room against the steel alone; stage two
 * freezes it and lights the front.
 */
const CANONICAL_REPORT_VIEWS: ReadonlyArray<View> = Object.freeze([
  {
    name: "front-black",
    colourway: "black",
    face: "front",
    pose: "front",
    verification: "canonical-luminance",
  },
  {
    name: "front-white",
    colourway: "white",
    face: "front",
    pose: "front",
    verification: "canonical-luminance",
  },
  {
    name: "rear-steel",
    colourway: "black",
    face: "back",
    pose: "rear",
    verification: "canonical-luminance",
  },
]);

const VIEWS = {
  room: CANONICAL_REPORT_VIEWS.filter((view) => view.face === "back"),
  front: CANONICAL_REPORT_VIEWS.filter((view) => view.face === "front"),
  all: CANONICAL_REPORT_VIEWS,
} as const;

function serializeViews(views: ReadonlyArray<View>): string {
  return JSON.stringify(
    views.map((view) => ({ colourway: view.colourway, face: view.face })),
  );
}

function summarizeResults(results: ReadonlyArray<Result>): ReportView["summary"] {
  let passing = 0;
  let worstAbsDelta = 0;
  let sumSquared = 0;
  const failingTokens: Array<string> = [];
  for (const result of results) {
    if (result.pass) passing += 1;
    else failingTokens.push(result.token);
    worstAbsDelta = Math.max(worstAbsDelta, Math.abs(result.delta));
    sumSquared += result.delta ** 2;
  }
  return {
    total: results.length,
    passing,
    failing: results.length - passing,
    failingTokens,
    worstAbsDelta,
    rms: Math.sqrt(sumSquared / Math.max(1, results.length)),
  };
}

async function measureViews(
  page: Page,
  patch: Record<string, number>,
  views: ReadonlyArray<View>,
  settleMs = SETTLE_MS,
): Promise<Array<ReportView>> {
  const rows: Array<ReportView> = [];
  for (const view of views) {
    const results = await score(page, patch, serializeViews([view]), settleMs);
    rows.push({
      ...view,
      results,
      summary: summarizeResults(results),
    });
  }
  return rows;
}

async function score(
  page: Page,
  patch: Record<string, number>,
  views: string,
  settleMs = SETTLE_MS,
): Promise<Array<Result>> {
  try {
    const raw = await page.evaluate<string>(
      SCORE_EXPR(JSON.stringify(patch), views, settleMs),
    );
    return JSON.parse(raw) as Array<Result>;
  } catch {
    // A candidate that moves a recess wall over a target is not evidence; the
    // strict D-067 probe throws. Give that candidate an unambiguously losing
    // score and continue instead of weakening the identity assertion.
    return [
      {
        surface: "invalid-geometry",
        token: "raycast-identity",
        at: 0,
        expectedHex: "#000000",
        expectedLuma: 0,
        measuredLuma: 255,
        measuredRgb: [255, 255, 255],
        delta: 255,
        pass: false,
      },
    ];
  }
}

const APPLY_EXPR = (patchJson: string) => `
(() => {
  const patch = ${patchJson};
  const set = (obj, path, value) => {
    const parts = path.split('.');
    let node = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      node[parts[i]] = Array.isArray(node[parts[i]]) ? [...node[parts[i]]] : { ...node[parts[i]] };
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
  };
  window.__deviceCalibration.reset();
  const base = JSON.parse(JSON.stringify(window.__deviceCalibration.getParams()));
  for (const [path, value] of Object.entries(patch)) set(base, path, value);
  window.__deviceCalibration.setParams(base);
})()
`;

async function resetAndApply(
  page: Page,
  patch: Readonly<Record<string, number>>,
): Promise<void> {
  await page.evaluate(APPLY_EXPR(JSON.stringify(patch)));
  // Environment-map creation and PMREM compilation happen after React commits.
  await sleep(1000);
}

/**
 * The objective.
 *
 * ⚑ Not plain RMS. The gate is per-stop `|delta| ≤ 4`, so a rig that is 3 units
 * off on forty stops passes and one that is 12 off on a single stop does not.
 * Squared error alone would happily trade the second for the first. The
 * objective therefore minimizes squared distance outside the admissible band.
 * That loss is exactly zero if and only if every sampled row passes, while
 * remaining smooth enough to guide a search that is still far from the band.
 * Failure count, worst miss and MSE break ties only after gate distance.
 */
type Objective = {
  readonly invalid: boolean;
  readonly gateLoss: number;
  readonly failures: number;
  readonly worstOver: number;
  readonly meanSquared: number;
};

function objective(results: ReadonlyArray<Result>): Objective {
  const invalid = results.some(
    (result) => result.surface === "invalid-geometry",
  );
  let failures = 0;
  let gateLoss = 0;
  let worstOver = 0;
  let total = 0;
  for (const result of results) {
    const over = Math.max(0, Math.abs(result.delta) - 4);
    if (!result.pass) failures += 1;
    gateLoss += over * over;
    worstOver = Math.max(worstOver, over);
    total += result.delta ** 2;
  }
  return {
    invalid,
    gateLoss,
    failures,
    worstOver,
    meanSquared: total / Math.max(1, results.length),
  };
}

/** The acceptance contract is zero distance outside every row's ±4 band. */
function improves(candidate: Objective, incumbent: Objective): boolean {
  if (candidate.invalid !== incumbent.invalid) return !candidate.invalid;
  if (candidate.invalid) return false;
  if (Math.abs(candidate.gateLoss - incumbent.gateLoss) > 1e-6) {
    return candidate.gateLoss < incumbent.gateLoss;
  }
  if (candidate.failures !== incumbent.failures) {
    return candidate.failures < incumbent.failures;
  }
  if (candidate.worstOver !== incumbent.worstOver) {
    return candidate.worstOver < incumbent.worstOver;
  }
  return candidate.meanSquared < incumbent.meanSquared - 1e-6;
}

function objectiveLabel(value: Objective): string {
  if (value.invalid) return "invalid geometry";
  return `${value.failures} fail, gate-loss ${value.gateLoss.toFixed(1)}, ${(value.worstOver + 4).toFixed(1)} worst, mse ${value.meanSquared.toFixed(2)}`;
}

function getPath(object: Json, path: string): number {
  let node: unknown = object;
  for (const part of path.split(".")) node = (node as Json)[part];
  return node as number;
}

async function main() {
  const [command, arg, arg2] = process.argv.slice(2);
  const session =
    process.env.DEVICE_CALIBRATION_SESSION ?? "device-calibration";
  const browserWs = (
    await Bun.$`bunx agent-browser --session ${session} get cdp-url`.text()
  ).trim();
  const page = await Page.attach(browserWs);

  await page.evaluate(`(async () => {
    const deadline = performance.now() + 10000;
    while (window.__deviceCalibration === undefined) {
      if (performance.now() > deadline) throw new Error('device calibration API did not mount');
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  })()`);

  const params = JSON.parse(
    await page.evaluate<string>(
      "JSON.stringify(window.__deviceCalibration.getParams())",
    ),
  );
  const savedDocument = await Bun.file(
    process.env.DEVICE_CALIBRATION_SEED ??
      "packages/device/calibration/rig.json",
  )
    .json()
    .catch(() => ({}) as Record<string, number>);
  const saved = (
    "params" in savedDocument ? savedDocument.params : savedDocument
  ) as Record<string, number>;

  const allKnobs = [...ROOM_KNOBS, ...FRONT_KNOBS];
  // The checkpoint is authoritative even for keys this tuner is not currently
  // allowed to move. Movable knobs are clamped below; frozen keys still need
  // to be applied so a fresh session reproduces the saved render exactly.
  const start: Record<string, number> = { ...saved };
  for (const knob of allKnobs) {
    const value = saved[knob.path] ?? getPath(params as Json, knob.path);
    start[knob.path] = Math.max(knob.min, Math.min(knob.max, value));
  }

  await resetAndApply(page, start);

  if (command === "report") {
    const canonical = await measureViews(page, {}, VIEWS.all, 500);
    const report = `${JSON.stringify(
      {
        params: start,
        verificationRule:
          "D-064: canonical luminance stop tables apply only to the front and rear reference poses; rotated poses require physical-continuity validation instead.",
        canonical,
      },
      null,
      2,
    )}\n`;
    if (arg) await Bun.write(arg, report);
    else console.log(report);
    page.close();
    return;
  }

  const stage: CalibrationStage =
    command === "room" || command === "search-room"
      ? "room"
      : command?.startsWith("body-black") || command?.startsWith("search-body-black")
        ? "body-black"
        : command?.startsWith("body-white") || command?.startsWith("search-body-white")
          ? "body-white"
          : command?.startsWith("select-black") || command?.startsWith("search-select-black")
            ? "select-black"
            : command?.startsWith("select-white") || command?.startsWith("search-select-white")
              ? "select-white"
              : command?.startsWith("wheel-black") || command?.startsWith("search-wheel-black")
                ? "wheel-black"
                : command?.startsWith("wheel-white") || command?.startsWith("search-wheel-white")
                  ? "wheel-white"
      : command === "front" || command === "search-front"
        ? "front"
        : "all";
  const knobs =
    stage === "room"
      ? ROOM_KNOBS
      : stage === "body-black"
        ? FRONT_KNOBS.filter(
            (knob) =>
              command?.includes("sheen-roughness")
                ? knob.path === "materials.bodyBlack.sheenRoughness"
              : command?.includes("profile")
                ? knob.path.startsWith("opticalProfiles.bodyBlack")
                : command?.includes("scalar")
                  ? knob.path.startsWith("materials.bodyBlack.")
                : knob.path.startsWith("materials.bodyBlack.") ||
                  knob.path.startsWith("opticalProfiles.bodyBlack"),
          )
        : stage === "body-white"
          ? FRONT_KNOBS.filter(
              (knob) =>
                knob.path.startsWith("materials.bodyWhite.") ||
                knob.path.startsWith("opticalProfiles.bodyWhite"),
            )
          : stage === "select-black"
            ? FRONT_KNOBS.filter(
                (knob) =>
                  knob.path.startsWith("materials.selectBlack.") ||
                  knob.path.startsWith("opticalProfiles.selectBlack."),
              )
            : stage === "select-white"
              ? FRONT_KNOBS.filter(
                  (knob) =>
                    knob.path.startsWith("materials.selectWhite.") ||
                    knob.path.startsWith("opticalProfiles.selectWhite."),
                )
              : stage === "wheel-black"
                ? FRONT_KNOBS.filter(
                    (knob) =>
                      knob.path.startsWith("materials.wheelRingBlack.") ||
                      knob.path.startsWith("opticalProfiles.wheelBlack."),
                  )
                : stage === "wheel-white"
                  ? FRONT_KNOBS.filter(
                      (knob) =>
                        knob.path.startsWith("materials.wheelRingWhite.") ||
                        knob.path.startsWith("opticalProfiles.wheelWhite."),
                    )
              : stage === "front"
                ? FRONT_KNOBS
                : allKnobs;
  const views =
    stage === "room"
      ? serializeViews(VIEWS.room)
      : stage === "front"
        ? serializeViews(VIEWS.front)
        : serializeViews(VIEWS.all);
  const targetSurface =
    stage === "body-black" ||
    stage === "body-white" ||
    stage === "select-black" ||
    stage === "select-white"
    || stage === "wheel-black" || stage === "wheel-white"
      ? stage === "wheel-black"
        ? "wheel-ring-black"
        : stage === "wheel-white"
          ? "wheel-ring-white"
          : stage
      : null;
  const scoreStage = async (patch: Record<string, number>, settleMs: number) => {
    const guardedStage = stage === "front" || targetSurface !== null;
    const results = await score(
      page,
      patch,
      guardedStage ? serializeViews(VIEWS.all) : views,
      settleMs,
    );
    const steel = results.filter((result) => result.surface === "steel-back");
    const whiteWheel = results.filter((result) => result.surface === "wheel-ring-white");
    if (
      !command?.includes("sensitivity") &&
      ((guardedStage &&
        (steel.length !== 11 || steel.some((result) => !result.pass))) ||
        (targetSurface !== null &&
          targetSurface !== "wheel-ring-white" &&
          (whiteWheel.length !== 4 ||
            whiteWheel.some((result) => !result.pass))))
    ) {
      return [
        {
          surface: "invalid-geometry",
          token: "frozen-surface-regressed",
          at: 0,
          expectedHex: "#000000",
          expectedLuma: 0,
          measuredLuma: 255,
          measuredRgb: [255, 255, 255] as [number, number, number],
          delta: 255,
          pass: false,
        },
      ];
    }
    if (targetSurface === null) return results;
    return results.filter((result) => result.surface === targetSurface);
  };
  const iterations = Number(arg ?? 40);
  let scale = Number(arg2 ?? 4);

  let best = ownedPatch(stage, start);
  const settleMs = stage === "room" || stage === "all" ? 500 : targetSurface !== null ? 100 : SETTLE_MS;
  let bestResults = await scoreStage(best, settleMs);
  let bestScore = objective(bestResults);
  console.error(`[${stage}] start ${objectiveLabel(bestScore)}`);

  if (command === "sheen-roughness-sweep") {
    const rows = [];
    for (const sheenRoughness of [1, 0.9, 0.7, 0.4, 0.1]) {
      rows.push({
        sheenRoughness,
        results: await scoreStage(
          { ...best, "materials.bodyBlack.sheenRoughness": sheenRoughness },
          100,
        ),
      });
    }
    const output = JSON.stringify(parseSheenRoughnessArchive({
      schema: "webpod-sheen-roughness-sweep-v1",
      semantics: "Three 0.185.1 uniform Charlie/IBL sheen roughness",
      baseline: bestResults,
      rows,
    }));
    if (arg) await Bun.write(arg, `${output}\n`);
    else console.log(output);
    page.close();
    return;
  }

  if (command === "edge-crown-sweep") {
    const rows = [];
    for (let extent = 18; extent <= 36; extent += 3) {
      for (let depth = 0.5; depth <= 3; depth += 0.5) {
        const candidate = {
          ...best,
          "form.topEdgeCrown": depth,
          "form.bottomEdgeCrown": -depth,
          "form.edgeCrownExtent": extent,
        };
        rows.push({ extent, depth, results: await scoreStage(candidate, 100) });
      }
    }
    const output = JSON.stringify(parseEdgeCrownArchive({
      schema: "webpod-edge-crown-sweep-v1",
      baseline: bestResults,
      constraints: {
        bodyWidth: 330,
        bodyHeight: 552,
        cornerRadius: 26,
        frontThickness: 14,
        maxDepth: 3,
        extent: { min: 18, max: 36, step: 3 },
      },
      rows,
    }));
    if (arg) await Bun.write(arg, `${output}\n`);
    else console.log(output);
    page.close();
    return;
  }

  if (command?.includes("sensitivity")) {
    const factor = Number(arg ?? 1);
    const rows = [];
    for (const knob of knobs) {
      const center = best[knob.path];
      if (center === undefined) continue;
      for (const direction of [-1, 1]) {
        const next = center + direction * knob.step * factor;
        if (next < knob.min - 1e-9 || next > knob.max + 1e-9) continue;
        const candidate = { ...best, [knob.path]: next };
        const measured = await scoreStage(candidate, settleMs);
        rows.push({
          path: knob.path,
          direction,
          amount: next - center,
          response: measured.map((result, index) => ({
            token: result.token,
            measuredLuma: result.measuredLuma,
            deltaFromBaseline:
              result.measuredLuma - (bestResults[index]?.measuredLuma ?? result.measuredLuma),
          })),
        });
      }
    }
    console.log(JSON.stringify({ baseline: bestResults, sensitivities: rows }, null, 2));
    page.close();
    return;
  }

  if (command?.startsWith("search")) {
    const random = seededRandom(0x57a4c);
    const attempts = Number(arg ?? 5000);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const candidate = { ...best };
      const temperature = Math.max(0.08, 1 - attempt / attempts);
      const moves = 2 + Math.floor(random() * 5);
      for (let move = 0; move < moves; move += 1) {
        const knob = knobs[Math.floor(random() * knobs.length)];
        if (knob === undefined) continue;
        const current = candidate[knob.path];
        if (current === undefined) continue;
        const span = (knob.max - knob.min) * temperature * 0.3;
        candidate[knob.path] = Math.max(
          knob.min,
          Math.min(knob.max, current + (random() * 2 - 1) * span),
        );
      }
      const results = await scoreStage(candidate, settleMs);
      const value = objective(results);
      if (improves(value, bestScore)) {
        best = candidate;
        bestScore = value;
        bestResults = results;
        await Bun.write(
          "packages/device/calibration/rig.json",
          `${JSON.stringify(mergeOwned(stage, saved, best), null, 2)}\n`,
        );
        console.error(
          `[${stage}] search ${attempt}/${attempts} ${objectiveLabel(bestScore)}`,
        );
        if (bestResults.every((result) => result.pass)) break;
      }
    }
    console.log(
      JSON.stringify({ params: best, results: bestResults }, null, 2),
    );
    page.close();
    return;
  }

  // Coordinate descent with a shrinking step. Deliberately simple: the space is
  // smooth in every knob and the expensive part is the round trip, so the win is
  // in taking few well-chosen samples rather than in the algorithm.
  for (let pass = 0; pass < iterations; pass++) {
    let improved = false;
    for (const knob of knobs) {
      for (const direction of [1, -1]) {
        const candidate = { ...best };
        const currentValue = candidate[knob.path];
        if (currentValue === undefined) continue;
        const next = currentValue + direction * knob.step * scale;
        if (next < knob.min || next > knob.max) continue;
        candidate[knob.path] = next;
        const results = await scoreStage(candidate, settleMs);
        const value = objective(results);
        if (improves(value, bestScore)) {
          best = candidate;
          bestScore = value;
          bestResults = results;
          improved = true;
          break;
        }
      }
    }
    console.error(
      `[${stage}] pass ${pass} scale ${scale} ${objectiveLabel(bestScore)}`,
    );
    await Bun.write(
      "packages/device/calibration/rig.json",
      JSON.stringify(mergeOwned(stage, saved, best), null, 2),
    );
    if (!improved) {
      if (scale <= 0.0625) break;
      scale /= 2;
    }
    await sleep(1);
  }

  await Bun.write(
    "packages/device/calibration/rig.json",
    JSON.stringify(mergeOwned(stage, saved, best), null, 2),
  );
  console.log(JSON.stringify({ params: best, results: bestResults }, null, 2));
  page.close();
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

await main();
