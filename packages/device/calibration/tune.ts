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
  { path: "form.seamWidth", min: 1, max: 9, step: 0.4 },
];

const SETTLE_MS = 30;

/**
 * Apply a patch, let React commit, then sample both colourways and the back.
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
  for (const [colourway, face] of ${views}) {
    window.__deviceCalibration.setParams({ ...base, colourway, face });
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

/**
 * ⚑ **Two stages, because the two halves of the object are driven by different
 * things** (D-057). The steel's profile comes from the room; the polycarbonate
 * and the wheel are lit. Scoring all forty-three stops together lets the search
 * trade the eleven steel stops away for the thirty-two front ones — which it
 * did, parking a 3.0-intensity blob nine degrees wide directly on the steel's
 * sampled column. Stage one fixes the room against the steel alone; stage two
 * freezes it and lights the front.
 */
const VIEWS = {
  room: "[['black', 'back']]",
  front: "[['black', 'front'], ['white', 'front']]",
  all: "[['black', 'front'], ['white', 'front'], ['black', 'back']]",
} as const;

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

/**
 * The objective.
 *
 * ⚑ Not plain RMS. The gate is per-stop `|delta| ≤ 4`, so a rig that is 3 units
 * off on forty stops passes and one that is 12 off on a single stop does not.
 * Squared error alone would happily trade the second for the first. The
 * objective therefore orders candidates by failed-stop count, then worst miss,
 * then mean squared error. A prettier red curve can never outrank one with
 * fewer failed rows.
 */
type Objective = {
  readonly invalid: boolean;
  readonly failures: number;
  readonly worstOver: number;
  readonly meanSquared: number;
};

function objective(results: ReadonlyArray<Result>): Objective {
  const invalid = results.some(
    (result) => result.surface === "invalid-geometry",
  );
  let failures = 0;
  let worstOver = 0;
  let total = 0;
  for (const result of results) {
    const over = Math.max(0, Math.abs(result.delta) - 4);
    if (!result.pass) failures += 1;
    worstOver = Math.max(worstOver, over);
    total += result.delta ** 2;
  }
  return {
    invalid,
    failures,
    worstOver,
    meanSquared: total / Math.max(1, results.length),
  };
}

/** The acceptance contract is lexicographic: pass rows before polishing rows. */
function improves(candidate: Objective, incumbent: Objective): boolean {
  if (candidate.invalid !== incumbent.invalid) return !candidate.invalid;
  if (candidate.invalid) return false;
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
  return `${value.failures} fail, ${(value.worstOver + 4).toFixed(1)} worst, mse ${value.meanSquared.toFixed(2)}`;
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
  const start: Record<string, number> = {};
  for (const knob of allKnobs) {
    const value = saved[knob.path] ?? getPath(params as Json, knob.path);
    start[knob.path] = Math.max(knob.min, Math.min(knob.max, value));
  }

  if (command === "report") {
    const results = await score(page, start, VIEWS.all, 500);
    const report = `${JSON.stringify({ params: start, results }, null, 2)}\n`;
    if (arg) await Bun.write(arg, report);
    else console.log(report);
    page.close();
    return;
  }

  const stage =
    command === "room" || command === "search-room"
      ? "room"
      : command === "front" || command === "search-front"
        ? "front"
        : "all";
  const knobs =
    stage === "room" ? ROOM_KNOBS : stage === "front" ? FRONT_KNOBS : allKnobs;
  const views =
    stage === "room" ? VIEWS.room : stage === "front" ? VIEWS.front : VIEWS.all;
  const iterations = Number(arg ?? 40);
  let scale = Number(arg2 ?? 4);

  let best = { ...start };
  const settleMs = stage === "room" || stage === "all" ? 500 : SETTLE_MS;
  let bestResults = await score(page, best, views, settleMs);
  let bestScore = objective(bestResults);
  console.error(`[${stage}] start ${objectiveLabel(bestScore)}`);

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
      const results = await score(page, candidate, views, settleMs);
      const value = objective(results);
      if (improves(value, bestScore)) {
        best = candidate;
        bestScore = value;
        bestResults = results;
        await Bun.write(
          "packages/device/calibration/rig.json",
          `${JSON.stringify(best, null, 2)}\n`,
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
        const results = await score(page, candidate, views, settleMs);
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
      JSON.stringify(best, null, 2),
    );
    if (!improved) {
      if (scale <= 0.0625) break;
      scale /= 2;
    }
    await sleep(1);
  }

  await Bun.write(
    "packages/device/calibration/rig.json",
    JSON.stringify(best, null, 2),
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
