import { hexLuma255, luma255 } from "../src/colour";
import { STEEL_STOPS } from "../src/env-map";
import {
  BODY_BLACK_STOPS,
  BODY_WHITE_STOPS,
  LUMINANCE_TOLERANCE,
  SELECT_BLACK_STOPS,
  SELECT_WHITE_STOPS,
  WHEEL_BLACK_STOPS,
  WHEEL_WHITE_STOPS,
  type ProbeResult,
  type ProbeSurface,
} from "../src/luminance-probe";

const SHEEN_VALUES = [1, 0.9, 0.7, 0.4, 0.1] as const;
const CROWN_EXTENTS = [18, 21, 24, 27, 30, 33, 36] as const;
const CROWN_DEPTHS = [0.5, 1, 1.5, 2, 2.5, 3] as const;
const CROWN_EXTENT_SET = new Set<number>(CROWN_EXTENTS);
const CROWN_DEPTH_SET = new Set<number>(CROWN_DEPTHS);
const RESULT_COUNT = 43;
const ARITHMETIC_EPSILON = 1e-9;
const RESULT_KEYS = [
  "surface",
  "token",
  "at",
  "expectedHex",
  "expectedLuma",
  "measuredLuma",
  "measuredRgb",
  "measuredSamples",
  "delta",
  "pass",
] as const;

type CanonicalMeasurement = {
  readonly surface: ProbeSurface;
  readonly token: string;
  readonly at: number;
  readonly expectedHex: string;
  readonly sampleCount: 1 | 2;
};

function stopMeasurements(
  surface: ProbeSurface,
  stops: ReadonlyArray<{ readonly at: number; readonly color: string; readonly token: string }>,
): Array<CanonicalMeasurement> {
  return stops.map((stop) => ({
    surface,
    token: stop.token,
    at: stop.at,
    expectedHex: stop.color,
    sampleCount: stop.at === 0 || stop.at === 1 ? 1 : 2,
  }));
}

/** The route's canonical black-front, white-front, steel-back measurement order. */
export const CANONICAL_MEASUREMENTS: ReadonlyArray<CanonicalMeasurement> = [
  ...stopMeasurements("body-black", BODY_BLACK_STOPS).map((row) => ({ ...row, sampleCount: 2 as const })),
  ...stopMeasurements("wheel-ring-black", WHEEL_BLACK_STOPS),
  ...stopMeasurements("select-black", SELECT_BLACK_STOPS),
  ...stopMeasurements("body-white", BODY_WHITE_STOPS).map((row) => ({ ...row, sampleCount: 2 as const })),
  ...stopMeasurements("wheel-ring-white", WHEEL_WHITE_STOPS),
  ...stopMeasurements("select-white", SELECT_WHITE_STOPS),
  ...STEEL_STOPS.map((stop, index) => ({
    surface: "steel-back" as const,
    token: `--steel-${index}`,
    at: stop.at,
    expectedHex: stop.color,
    sampleCount: 1 as const,
  })),
];

export type MeasurementSummary = {
  readonly count: number;
  readonly passing: number;
  readonly rms: number;
  readonly worst: number;
};

type SheenRow = {
  readonly sheenRoughness: number;
  readonly results: ReadonlyArray<ProbeResult>;
};

export type SheenRoughnessArchive = {
  readonly schema: "webpod-sheen-roughness-sweep-v1";
  readonly semantics: string;
  readonly baseline: ReadonlyArray<ProbeResult>;
  readonly rows: ReadonlyArray<SheenRow>;
};

type CrownRow = {
  readonly extent: number;
  readonly depth: number;
  readonly results: ReadonlyArray<ProbeResult>;
};

export type EdgeCrownArchive = {
  readonly schema: "webpod-edge-crown-sweep-v1";
  readonly baseline: ReadonlyArray<ProbeResult>;
  readonly constraints: {
    readonly bodyWidth: 330;
    readonly bodyHeight: 552;
    readonly cornerRadius: 26;
    readonly frontThickness: 14;
    readonly maxDepth: 3;
    readonly extent: { readonly min: 18; readonly max: 36; readonly step: 3 };
  };
  readonly rows: ReadonlyArray<CrownRow>;
};

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: ReadonlyArray<string>, label: string) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new TypeError(`${label} keys must be exactly ${expected.join(", ")}`);
  }
}

function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be finite`);
  }
  return value;
}

function bounded(value: unknown, min: number, max: number, label: string): number {
  const parsed = finite(value, label);
  if (parsed < min || parsed > max) throw new TypeError(`${label} must be within ${min}..${max}`);
  return parsed;
}

function rgb(value: unknown, label: string): readonly [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) throw new TypeError(`${label} must be an RGB triple`);
  return [bounded(value[0], 0, 255, `${label}[0]`), bounded(value[1], 0, 255, `${label}[1]`), bounded(value[2], 0, 255, `${label}[2]`)];
}

function close(actual: number, expected: number, label: string): void {
  if (Math.abs(actual - expected) > ARITHMETIC_EPSILON) {
    throw new TypeError(`${label} does not match its canonical/recomputed value`);
  }
}

/** Recomputes every aggregate used by the calibration reports from admitted rows. */
export function summarizeMeasurements(results: ReadonlyArray<ProbeResult>): MeasurementSummary {
  let passing = 0;
  let squared = 0;
  let worst = 0;
  for (const result of results) {
    if (result.pass) passing += 1;
    squared += result.delta ** 2;
    worst = Math.max(worst, Math.abs(result.delta));
  }
  return {
    count: results.length,
    passing,
    rms: results.length === 0 ? 0 : Math.sqrt(squared / results.length),
    worst,
  };
}

function results(value: unknown, label: string): ReadonlyArray<ProbeResult> {
  if (!Array.isArray(value) || value.length !== RESULT_COUNT) {
    throw new TypeError(`${label} must contain exactly ${RESULT_COUNT} measurements`);
  }
  for (const [index, candidate] of value.entries()) {
    const row = record(candidate, `${label}[${index}]`);
    exactKeys(row, RESULT_KEYS, `${label}[${index}]`);
    const canonical = CANONICAL_MEASUREMENTS[index];
    if (canonical === undefined) throw new TypeError(`${label}[${index}] has no canonical coordinate`);
    if (row.surface !== canonical.surface || row.token !== canonical.token) {
      throw new TypeError(`${label}[${index}] must match canonical surface/token identity`);
    }
    const at = bounded(row.at, 0, 1, `${label}[${index}].at`);
    close(at, canonical.at, `${label}[${index}].at`);
    if (row.expectedHex !== canonical.expectedHex) {
      throw new TypeError(`${label}[${index}].expectedHex must match the canonical stop`);
    }
    const expectedLuma = bounded(row.expectedLuma, 0, 255, `${label}[${index}].expectedLuma`);
    close(expectedLuma, hexLuma255(canonical.expectedHex), `${label}[${index}].expectedLuma`);
    const measuredLuma = bounded(row.measuredLuma, 0, 255, `${label}[${index}].measuredLuma`);
    const measuredRgb = rgb(row.measuredRgb, `${label}[${index}].measuredRgb`);
    close(measuredLuma, luma255(...measuredRgb), `${label}[${index}].measuredLuma`);
    if (!Array.isArray(row.measuredSamples) || row.measuredSamples.length !== canonical.sampleCount) {
      throw new TypeError(`${label}[${index}].measuredSamples must contain exactly ${canonical.sampleCount} samples`);
    }
    const samples = row.measuredSamples.map((sample, sampleIndex) => rgb(sample, `${label}[${index}].measuredSamples[${sampleIndex}]`));
    const averaged = samples.reduce<[number, number, number]>(
      (sum, sample) => [sum[0] + sample[0] / samples.length, sum[1] + sample[1] / samples.length, sum[2] + sample[2] / samples.length],
      [0, 0, 0],
    );
    for (let channel = 0; channel < 3; channel += 1) {
      close(measuredRgb[channel] ?? Number.NaN, averaged[channel] ?? Number.NaN, `${label}[${index}].measuredRgb[${channel}]`);
    }
    const delta = finite(row.delta, `${label}[${index}].delta`);
    close(delta, measuredLuma - expectedLuma, `${label}[${index}].delta`);
    const recomputedPass = Math.abs(delta) <= LUMINANCE_TOLERANCE + ARITHMETIC_EPSILON;
    if (row.pass !== recomputedPass) throw new TypeError(`${label}[${index}].pass must match the canonical ±${LUMINANCE_TOLERANCE} gate`);
  }
  const parsed = value as ReadonlyArray<ProbeResult>;
  const summary = summarizeMeasurements(parsed);
  if (summary.count !== RESULT_COUNT || !Number.isFinite(summary.rms) || !Number.isFinite(summary.worst)) {
    throw new TypeError(`${label} aggregate summary is invalid`);
  }
  return parsed;
}

/** Parses the five-value uniform sheen experiment and rejects partial archives. */
export function parseSheenRoughnessArchive(value: unknown): SheenRoughnessArchive {
  const root = record(value, "sheen archive");
  exactKeys(root, ["schema", "semantics", "baseline", "rows"], "sheen archive");
  if (root.schema !== "webpod-sheen-roughness-sweep-v1") throw new TypeError("unknown sheen schema");
  if (typeof root.semantics !== "string" || root.semantics.length === 0) throw new TypeError("sheen semantics must be text");
  const baseline = results(root.baseline, "sheen baseline");
  if (!Array.isArray(root.rows) || root.rows.length !== SHEEN_VALUES.length) throw new TypeError("sheen archive must contain five rows");
  const rows = root.rows.map((candidate, index) => {
    const row = record(candidate, `sheen row ${index}`);
    exactKeys(row, ["sheenRoughness", "results"], `sheen row ${index}`);
    const sheenRoughness = finite(row.sheenRoughness, `sheen row ${index}.sheenRoughness`);
    if (sheenRoughness !== SHEEN_VALUES[index]) throw new TypeError("sheen values must be complete and ordered");
    return { sheenRoughness, results: results(row.results, `sheen row ${index}.results`) };
  });
  return { schema: root.schema, semantics: root.semantics, baseline, rows };
}

/** Parses the full 7×6 crown grid and rejects missing or duplicated candidates. */
export function parseEdgeCrownArchive(value: unknown): EdgeCrownArchive {
  const root = record(value, "crown archive");
  exactKeys(root, ["schema", "baseline", "constraints", "rows"], "crown archive");
  if (root.schema !== "webpod-edge-crown-sweep-v1") throw new TypeError("unknown crown schema");
  const baseline = results(root.baseline, "crown baseline");
  const constraints = record(root.constraints, "crown constraints");
  exactKeys(constraints, ["bodyWidth", "bodyHeight", "cornerRadius", "frontThickness", "maxDepth", "extent"], "crown constraints");
  const extent = record(constraints.extent, "crown extent constraints");
  exactKeys(extent, ["min", "max", "step"], "crown extent constraints");
  if (constraints.bodyWidth !== 330 || constraints.bodyHeight !== 552 || constraints.cornerRadius !== 26 || constraints.frontThickness !== 14 || constraints.maxDepth !== 3 || extent.min !== 18 || extent.max !== 36 || extent.step !== 3) {
    throw new TypeError("crown constraints differ from the reviewed physical envelope");
  }
  if (!Array.isArray(root.rows) || root.rows.length !== CROWN_EXTENTS.length * CROWN_DEPTHS.length) throw new TypeError("crown archive must contain 42 rows");
  const seen = new Set<string>();
  const rows = root.rows.map((candidate, index) => {
    const row = record(candidate, `crown row ${index}`);
    exactKeys(row, ["extent", "depth", "results"], `crown row ${index}`);
    const crownExtent = finite(row.extent, `crown row ${index}.extent`);
    const depth = finite(row.depth, `crown row ${index}.depth`);
    if (!CROWN_EXTENT_SET.has(crownExtent) || !CROWN_DEPTH_SET.has(depth)) throw new TypeError("crown row lies outside the reviewed grid");
    const key = `${crownExtent}:${depth}`;
    if (seen.has(key)) throw new TypeError(`duplicate crown row ${key}`);
    seen.add(key);
    return { extent: crownExtent, depth, results: results(row.results, `crown row ${index}.results`) };
  });
  return {
    schema: root.schema,
    baseline,
    constraints: { bodyWidth: 330, bodyHeight: 552, cornerRadius: 26, frontThickness: 14, maxDepth: 3, extent: { min: 18, max: 36, step: 3 } },
    rows,
  };
}
