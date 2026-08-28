/**
 * The acceptance criterion, as code.
 *
 * > *"Tune the light rig and env map until a vertical luminance sample through
 * > the render matches the stop table within ±4 units."* — §12.3
 *
 * ⚑ This module does **not** render anything and does not know what a
 * framebuffer is. It answers one question — *where on the object does §4.2
 * stop 3 live, and what value should it read?* — and grades the answers a
 * caller brings back. Keeping it renderer-free is what lets the same targets
 * be checked against a WebGL readback today and against something else later,
 * and it keeps the gate from sharing an implementation with the thing it
 * gates.
 *
 * **How a 180deg CSS gradient becomes a sample point.** §4.2, §4.3 and §4.5
 * define their stops as percentages down the *element's bounding box*, and
 * §4.4 the same at 168deg. So a stop's position is a **row**, not a point: any
 * pixel on that row that is on the right surface carries the same specified
 * value. That matters because the obvious column — straight down the middle —
 * is blocked by the glass and the wheel for two thirds of the body's height.
 * Each target therefore states its row exactly and picks its column as the
 * outermost exposed point on that row.
 *
 * ⚑ **Every target is sampled as a mirrored pair and averaged.** The render is
 * not laterally symmetric: LAW 2's fill comes from the lower-left and §5.2 L3's
 * sky blob sits upper-left. A single column would read one side of that
 * asymmetry and grade a real, specified property of the light rig as error.
 * Averaging `±x` is what makes the measurement a *vertical* sample of a
 * gradient that is defined as a function of `y` alone.
 */
import { hexLuma255, luma255 } from "./colour";
import { DEVICE_LAYOUT } from "./layout";
import { STEEL_STOPS } from "./env-map";

/** Which surface a target sits on, and therefore which render it is read from. */
export type ProbeSurface =
  | "body-black"
  | "body-white"
  | "steel-back"
  | "wheel-ring-black"
  | "wheel-ring-white"
  | "select-black"
  | "select-white";

/** A sample the caller must read, in body-local coordinates. */
export type ProbeTarget = {
  readonly surface: ProbeSurface;
  /** The spec section and token this row comes from, for the evidence table. */
  readonly token: string;
  /** Position down the surface's bounding box, 0..1, as the spec states it. */
  readonly at: number;
  /** The value the stop table says this row reads at. */
  readonly expectedHex: string;
  /** Row, in body-local coordinates (+y up, origin at the face centre). */
  readonly y: number;
  /** Depth of the surface at this row — the sample is projected at this `z`. */
  readonly z: number;
  /**
   * Columns to read and average. Two entries for a mirrored pair, one where
   * the surface is only exposed on the axis.
   */
  readonly xs: ReadonlyArray<number>;
};

/** What the caller brings back: the sRGB bytes at each target's columns. */
export type ProbeReading = {
  readonly target: ProbeTarget;
  /** One `[r, g, b]` triple per entry in `target.xs`, 0..255. */
  readonly samples: ReadonlyArray<readonly [number, number, number]>;
};

export type ProbeResult = {
  readonly surface: ProbeSurface;
  readonly token: string;
  readonly at: number;
  readonly expectedHex: string;
  readonly expectedLuma: number;
  readonly measuredLuma: number;
  /** Averaged sRGB bytes, for the hue check the ±4 gate does not make. */
  readonly measuredRgb: readonly [number, number, number];
  /** Raw mirrored samples; retained so the acceptance average cannot hide asymmetry. */
  readonly measuredSamples: ReadonlyArray<readonly [number, number, number]>;
  /** `measured − expected`. The gate is `|delta| ≤ 4`. */
  readonly delta: number;
  readonly pass: boolean;
};

/** §12.3's tolerance. */
export const LUMINANCE_TOLERANCE = 4;

const { body, wheel } = DEVICE_LAYOUT;
const HALF_W = body.width / 2;
const HALF_H = body.height / 2;

type Stop = {
  readonly at: number;
  readonly color: string;
  readonly token: string;
};

/** §4.2 — glossy black polycarbonate. */
export const BODY_BLACK_STOPS: ReadonlyArray<Stop> = [
  { at: 0.0, color: "#3E4147", token: "--poly-k-0" },
  { at: 0.05, color: "#262A2E", token: "--poly-k-1" },
  { at: 0.19, color: "#16181C", token: "--poly-k-2" },
  { at: 0.44, color: "#0C0D0F", token: "--poly-k-3" },
  { at: 0.62, color: "#0A0B0D", token: "--poly-k-4" },
  { at: 0.81, color: "#121417", token: "--poly-k-5" },
  { at: 0.93, color: "#1E2126", token: "--poly-k-6" },
  { at: 1.0, color: "#32363C", token: "--poly-k-7" },
];

/** §4.3 — white polycarbonate. */
export const BODY_WHITE_STOPS: ReadonlyArray<Stop> = [
  { at: 0.0, color: "#FFFFFF", token: "--poly-w-0" },
  { at: 0.06, color: "#FBFAF8", token: "--poly-w-1" },
  { at: 0.21, color: "#F0F1F3", token: "--poly-w-2" },
  { at: 0.47, color: "#E2E5E8", token: "--poly-w-3" },
  { at: 0.64, color: "#DBDFE4", token: "--poly-w-4" },
  { at: 0.82, color: "#E6E9EC", token: "--poly-w-5" },
  { at: 0.94, color: "#F3F5F7", token: "--poly-w-6" },
  { at: 1.0, color: "#FDFEFE", token: "--poly-w-7" },
];

/** §4.5 — click wheel ring, both variants. */
export const WHEEL_BLACK_STOPS: ReadonlyArray<Stop> = [
  { at: 0.0, color: "#14161A", token: "--wheel-k-0" },
  { at: 0.38, color: "#1E2126", token: "--wheel-k-1" },
  { at: 0.62, color: "#23262B", token: "--wheel-k-2" },
  { at: 1.0, color: "#2C3037", token: "--wheel-k-3" },
];

export const WHEEL_WHITE_STOPS: ReadonlyArray<Stop> = [
  { at: 0.0, color: "#DCDFE2", token: "--wheel-w-0" },
  { at: 0.38, color: "#E6E8EA", token: "--wheel-w-1" },
  { at: 0.62, color: "#E9EBED", token: "--wheel-w-2" },
  { at: 1.0, color: "#F2F4F6", token: "--wheel-w-3" },
];

/**
 * §4.5 — the translucent Select plug.
 *
 * ⚑ The tokens carry alpha (88–96%) over the ring beneath. The plug and the
 * ring are within a few units of each other at every stop, so compositing the
 * stated alpha over the stated ring value moves the target by under one unit —
 * `#1B1E23` at 90% over `#23262B` reads 27.8/30.8/35.8 against 27/30/35. The
 * alpha is therefore dropped rather than modelled, and this note is the
 * justification, not an oversight.
 */
export const SELECT_BLACK_STOPS: ReadonlyArray<Stop> = [
  { at: 0.0, color: "#3A3E45", token: "--select-k-0" },
  { at: 0.34, color: "#262A30", token: "--select-k-1" },
  { at: 0.7, color: "#1B1E23", token: "--select-k-2" },
  { at: 1.0, color: "#2A2E34", token: "--select-k-3" },
];

export const SELECT_WHITE_STOPS: ReadonlyArray<Stop> = [
  { at: 0.0, color: "#FFFFFF", token: "--select-w-0" },
  { at: 0.34, color: "#F1F3F5", token: "--select-w-1" },
  { at: 0.7, color: "#E4E7EA", token: "--select-w-2" },
  { at: 1.0, color: "#EFF1F4", token: "--select-w-3" },
];

/** Half-width of a superellipse rounded rect at height `y`. */
export function silhouetteHalfWidth(
  y: number,
  halfW: number,
  halfH: number,
  r: number,
  n: number,
): number {
  const ay = Math.abs(y);
  const straight = halfH - r;
  if (ay <= straight) return halfW;
  const v = Math.min(r, ay - straight);
  const u = r * Math.max(0, 1 - (v / r) ** n) ** (1 / n);
  return halfW - r + u;
}

export type TargetOptions = {
  /** How far inside a silhouette edge a sample must sit to clear antialiasing. */
  readonly edgeInset: number;
  /** Depth of the polycarbonate and glass faces. */
  readonly frontFaceZ: number;
  /** Depth of the steel back's face. */
  readonly backFaceZ: number;
  /** How far the polycarbonate front is inset from the silhouette (§5.6). */
  readonly seamWidth: number;
  /** Depth of the ring at the sampled radius, and of the Select plug's face. */
  readonly ringZ: (radius: number) => number;
  readonly selectZ: (radius: number) => number;
};

/**
 * Body targets — §4.2 and §4.3.
 *
 * The column is the outermost exposed polycarbonate on the row: `edgeInset`
 * inside the front shell's own silhouette, and pushed further out if the glass
 * window or the wheel recess reaches that far. A row where nothing is exposed
 * would be a spec that cannot be measured; none of the sixteen stops is.
 */
function bodyTargets(
  surface: "body-black" | "body-white",
  stops: ReadonlyArray<Stop>,
  options: TargetOptions,
): Array<ProbeTarget> {
  const { glass } = DEVICE_LAYOUT;
  const seam = options.seamWidth;
  const inset = options.edgeInset;
  return stops.map((stop) => {
    const rawY = HALF_H - stop.at * body.height;
    const limit = HALF_H - seam - inset;
    const y = Math.min(limit, Math.max(-limit, rawY));
    const half = silhouetteHalfWidth(
      y,
      HALF_W - seam,
      HALF_H - seam,
      body.cornerR - seam,
      body.exponent,
    );
    let x = half - inset;
    // Push clear of the glass window and the wheel opening if they reach here.
    if (Math.abs(y - glass.centerY) <= glass.height / 2 + inset) {
      x = Math.max(x, glass.width / 2 + inset);
    }
    const dy = y - wheel.centerY;
    if (Math.abs(dy) <= wheel.outerR + inset) {
      const reach = Math.sqrt(
        Math.max(0, (wheel.outerR + inset) ** 2 - dy ** 2),
      );
      x = Math.max(x, reach);
    }
    x = Math.min(x, half - inset);
    return {
      surface,
      token: stop.token,
      at: stop.at,
      expectedHex: stop.color,
      y,
      z: options.frontFaceZ,
      xs: [x, -x],
    };
  });
}

/**
 * Steel targets — §4.4.
 *
 * ⚑ **§4.4's gradient is `168deg`, and that changes what "a stop" means.** For
 * a CSS linear-gradient at any non-axial angle, a stop is not a row: it is a
 * line **perpendicular to the gradient axis**, and the 0% and 100% lines pass
 * through opposite *corners* of the bounding box, not through the middle of the
 * top and bottom edges. Sampling `--steel-0` straight down the middle would
 * read whatever sits at 3.7% instead — a 20-unit error handed to the rig tuner
 * as if it were the rig's fault, on the one surface §10.4 calls the highest-risk
 * element in the design.
 *
 * So each stop's iso-line is intersected with the plate and the sample is taken
 * at the midpoint of that chord. The two endpoint stops sit within a corner
 * radius of the silhouette, so their iso-lines are clamped to the furthest the
 * plate actually reaches; the clamp is reported by `at` staying at the spec's
 * value while the geometry moves, which is the honest way round — the target is
 * the stop, and the plate is where it has to be read.
 */
function steelTargets(options: TargetOptions): Array<ProbeTarget> {
  const inset = options.edgeInset;
  // §4.4: `168deg`. In CSS, angles run clockwise from "to top" in a y-down
  // space; in this module's y-up frame the 0% → 100% direction is therefore
  // (sin θ, −cos θ).
  const theta = (168 * Math.PI) / 180;
  // CSS angles are measured clockwise from "to top" in a **y-down** space, so
  // the 0% → 100% direction is (sin θ, −cos θ) *there*. This module's frame is
  // y-**up**, which flips the second component back to +cos θ. ⚑ Getting this
  // sign wrong does not fail — it silently grades the plate against §4.4 read
  // bottom-to-top, which looks like a rig that cannot converge.
  const ux = Math.sin(theta);
  const uy = Math.cos(theta);
  // The gradient line's length is the box's extent projected onto it — the
  // definition CSS uses, and the reason 168deg is not just 180deg rotated.
  const length =
    Math.abs(body.width * Math.sin(theta)) +
    Math.abs(body.height * Math.cos(theta));

  const halfW = HALF_W - inset;
  const halfH = HALF_H - inset;
  const extent = Math.abs(halfW * ux) + Math.abs(halfH * uy);

  return STEEL_STOPS.map((stop, index) => {
    const wanted = (stop.at - 0.5) * length;
    const c = Math.min(extent, Math.max(-extent, wanted));
    const point = chordMidpoint(ux, uy, c, halfW, halfH);
    // ⚑ The chord is computed against the bounding box, and the silhouette is
    // a superellipse: at the endpoint stops the chord degenerates to a *corner*
    // of the box, which is 5px outside the plate. Sampling there reads the room
    // behind the device and grades it as a 120-unit miss on `--steel-0`. Clamp
    // the column into the silhouette on the same row.
    const reach = silhouetteHalfWidth(
      point.y,
      halfW,
      halfH,
      body.cornerR - inset,
      body.exponent,
    );
    point.x = Math.min(reach, Math.max(-reach, point.x));
    return {
      surface: "steel-back" as const,
      token: `--steel-${index}`,
      at: stop.at,
      expectedHex: stop.color,
      y: point.y,
      z: options.backFaceZ,
      xs: [point.x],
    };
  });
}

/**
 * Midpoint of the chord `p·u = c` across the axis-aligned box `±halfW × ±halfH`.
 *
 * The line is guaranteed to cross the box because `c` is clamped to the box's
 * own projected extent before this is called.
 */
function chordMidpoint(
  ux: number,
  uy: number,
  c: number,
  halfW: number,
  halfH: number,
): { x: number; y: number } {
  const hits: Array<{ x: number; y: number }> = [];
  const push = (x: number, y: number) => {
    if (Math.abs(x) <= halfW + 1e-6 && Math.abs(y) <= halfH + 1e-6)
      hits.push({ x, y });
  };
  if (Math.abs(uy) > 1e-9) {
    push(-halfW, (c - ux * -halfW) / uy);
    push(halfW, (c - ux * halfW) / uy);
  }
  if (Math.abs(ux) > 1e-9) {
    push((c - uy * -halfH) / ux, -halfH);
    push((c - uy * halfH) / ux, halfH);
  }
  if (hits.length === 0) return { x: 0, y: 0 };
  let sumX = 0;
  let sumY = 0;
  for (const hit of hits) {
    sumX += hit.x;
    sumY += hit.y;
  }
  return { x: sumX / hits.length, y: sumY / hits.length };
}

/** Ring targets — §4.5, over the wheel's own bounding box. */
function ringTargets(
  surface: "wheel-ring-black" | "wheel-ring-white",
  stops: ReadonlyArray<Stop>,
  options: TargetOptions,
): Array<ProbeTarget> {
  const inset = options.edgeInset;
  // A radius that clears the Select plug, the printed label band (§12.0's
  // measured r 77–79) and the ring's own rim.
  const preferredR = (wheel.labelBandOuterR + (wheel.outerR - inset)) / 2;
  return stops.map((stop) => {
    const rawDy = wheel.outerR - stop.at * wheel.outerR * 2;
    const maxDy = wheel.outerR - inset;
    const dy = Math.min(maxDy, Math.max(-maxDy, rawDy));
    const radius = Math.max(Math.abs(dy), Math.min(preferredR, maxDy));
    const x = Math.sqrt(Math.max(0, radius ** 2 - dy ** 2));
    return {
      surface,
      token: stop.token,
      at: stop.at,
      expectedHex: stop.color,
      y: wheel.centerY + dy,
      z: options.ringZ(radius),
      xs: x > 1 ? [x, -x] : [0],
    };
  });
}

/** Select targets — §4.5, over the plug's own bounding box. */
function selectTargets(
  surface: "select-black" | "select-white",
  stops: ReadonlyArray<Stop>,
  options: TargetOptions,
): Array<ProbeTarget> {
  const inset = options.edgeInset;
  const maxR = wheel.selectR - inset;
  return stops.map((stop) => {
    const rawDy = wheel.selectR - stop.at * wheel.selectR * 2;
    const dy = Math.min(maxR, Math.max(-maxR, rawDy));
    const radius = Math.max(Math.abs(dy), Math.min(maxR * 0.7, maxR));
    const x = Math.sqrt(Math.max(0, radius ** 2 - dy ** 2));
    return {
      surface,
      token: stop.token,
      at: stop.at,
      expectedHex: stop.color,
      y: wheel.centerY + dy,
      z: options.selectZ(radius),
      xs: x > 1 ? [x, -x] : [0],
    };
  });
}

/** Every target for one colourway's front, plus the steel back. */
export function probeTargets(
  colourway: "black" | "white",
  face: "front" | "back",
  options: TargetOptions,
): Array<ProbeTarget> {
  if (face === "back") return steelTargets(options);
  return colourway === "black"
    ? [
        ...bodyTargets("body-black", BODY_BLACK_STOPS, options),
        ...ringTargets("wheel-ring-black", WHEEL_BLACK_STOPS, options),
        ...selectTargets("select-black", SELECT_BLACK_STOPS, options),
      ]
    : [
        ...bodyTargets("body-white", BODY_WHITE_STOPS, options),
        ...ringTargets("wheel-ring-white", WHEEL_WHITE_STOPS, options),
        ...selectTargets("select-white", SELECT_WHITE_STOPS, options),
      ];
}

/** Grade a set of readings against §12.3's ±4. */
export function evaluate(
  readings: ReadonlyArray<ProbeReading>,
): Array<ProbeResult> {
  return readings.map((reading) => {
    const n = reading.samples.length || 1;
    let r = 0;
    let g = 0;
    let b = 0;
    for (const sample of reading.samples) {
      r += sample[0];
      g += sample[1];
      b += sample[2];
    }
    const rgb: [number, number, number] = [r / n, g / n, b / n];
    const measured = luma255(rgb[0], rgb[1], rgb[2]);
    const expected = hexLuma255(reading.target.expectedHex);
    const delta = measured - expected;
    return {
      surface: reading.target.surface,
      token: reading.target.token,
      at: reading.target.at,
      expectedHex: reading.target.expectedHex,
      expectedLuma: expected,
      measuredLuma: measured,
      measuredRgb: rgb,
      measuredSamples: reading.samples,
      delta,
      // Colour-space arithmetic can put an exact boundary a few ULPs beyond 4.
      // This epsilon admits that representation error, not a visible deviation.
      pass: Math.abs(delta) <= LUMINANCE_TOLERANCE + 1e-9,
    };
  });
}

/** Root-mean-square delta — the scalar the rig tuner minimises. */
export function rmsDelta(results: ReadonlyArray<ProbeResult>): number {
  if (results.length === 0) return 0;
  let sum = 0;
  for (const result of results) sum += result.delta ** 2;
  return Math.sqrt(sum / results.length);
}
