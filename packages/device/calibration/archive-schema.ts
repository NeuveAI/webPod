import type { ProbeResult } from "../src/luminance-probe";

const SHEEN_VALUES = [1, 0.9, 0.7, 0.4, 0.1] as const;
const CROWN_EXTENTS = [18, 21, 24, 27, 30, 33, 36] as const;
const CROWN_DEPTHS = [0.5, 1, 1.5, 2, 2.5, 3] as const;
const CROWN_EXTENT_SET = new Set<number>(CROWN_EXTENTS);
const CROWN_DEPTH_SET = new Set<number>(CROWN_DEPTHS);
const RESULT_COUNT = 43;

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

function rgb(value: unknown, label: string): readonly [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) throw new TypeError(`${label} must be an RGB triple`);
  return [finite(value[0], `${label}[0]`), finite(value[1], `${label}[1]`), finite(value[2], `${label}[2]`)];
}

function results(value: unknown, label: string): ReadonlyArray<ProbeResult> {
  if (!Array.isArray(value) || value.length !== RESULT_COUNT) {
    throw new TypeError(`${label} must contain exactly ${RESULT_COUNT} measurements`);
  }
  for (const [index, candidate] of value.entries()) {
    const row = record(candidate, `${label}[${index}]`);
    for (const key of ["surface", "token", "expectedHex"] as const) {
      if (typeof row[key] !== "string") throw new TypeError(`${label}[${index}].${key} must be text`);
    }
    for (const key of ["at", "expectedLuma", "measuredLuma", "delta"] as const) {
      finite(row[key], `${label}[${index}].${key}`);
    }
    rgb(row.measuredRgb, `${label}[${index}].measuredRgb`);
    if (!Array.isArray(row.measuredSamples) || row.measuredSamples.length === 0) throw new TypeError(`${label}[${index}].measuredSamples must be non-empty`);
    row.measuredSamples.forEach((sample, sampleIndex) => rgb(sample, `${label}[${index}].measuredSamples[${sampleIndex}]`));
    if (typeof row.pass !== "boolean") throw new TypeError(`${label}[${index}].pass must be boolean`);
  }
  return value as ReadonlyArray<ProbeResult>;
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
