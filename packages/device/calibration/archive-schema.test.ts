import { describe, expect, test } from "bun:test";
import type { ProbeResult } from "../src/luminance-probe";
import {
  parseEdgeCrownArchive,
  parseSheenRoughnessArchive,
  summarizeMeasurements,
  type EdgeCrownArchive,
  type SheenRoughnessArchive,
} from "./archive-schema";

type MutableResult = { -readonly [Key in keyof ProbeResult]: ProbeResult[Key] };
type MutableSheenArchive = {
  schema: SheenRoughnessArchive["schema"];
  semantics: string;
  baseline: Array<MutableResult>;
  rows: Array<{ sheenRoughness: number; results: Array<MutableResult> }>;
};
type MutableCrownArchive = {
  schema: EdgeCrownArchive["schema"];
  baseline: Array<MutableResult>;
  constraints: {
    bodyWidth: number;
    bodyHeight: number;
    cornerRadius: number;
    frontThickness: number;
    maxDepth: number;
    extent: { min: number; max: number; step: number };
  };
  rows: Array<{ extent: number; depth: number; results: Array<MutableResult> }>;
};

const ARCHIVE_ROOT = new URL("../../../docs", import.meta.url);

async function sourceWithSchema(schema: string): Promise<unknown> {
  const matches: Array<unknown> = [];
  const glob = new Bun.Glob("**/*.json");
  for await (const path of glob.scan({ cwd: ARCHIVE_ROOT.pathname, absolute: true })) {
    const candidate: unknown = await Bun.file(path).json().catch(() => null);
    if (typeof candidate === "object" && candidate !== null && "schema" in candidate && candidate.schema === schema) {
      matches.push(candidate);
    }
  }
  if (matches.length !== 1) throw new Error(`expected exactly one committed ${schema} archive, found ${matches.length}`);
  return matches[0];
}

async function reviewedArchives(): Promise<{ sheen: SheenRoughnessArchive; crown: EdgeCrownArchive }> {
  const sheenSource = await sourceWithSchema("webpod-sheen-roughness-sweep-v1");
  const crownSource = await sourceWithSchema("webpod-edge-crown-sweep-v1");
  return {
    sheen: parseSheenRoughnessArchive(sheenSource),
    crown: parseEdgeCrownArchive(crownSource),
  };
}

function mutableSheen(source: SheenRoughnessArchive): MutableSheenArchive {
  return structuredClone(source) as MutableSheenArchive;
}

function mutableCrown(source: EdgeCrownArchive): MutableCrownArchive {
  return structuredClone(source) as MutableCrownArchive;
}

function first<T>(values: Array<T>, label: string): T {
  const value = values[0];
  if (value === undefined) throw new Error(`${label} must not be empty`);
  return value;
}

function second<T>(values: Array<T>, label: string): T {
  const value = values[1];
  if (value === undefined) throw new Error(`${label} must contain a second value`);
  return value;
}

describe("calibration archive measurement integrity", () => {
  test("parses both committed archives and recomputes their reviewed aggregates", async () => {
    const { sheen, crown } = await reviewedArchives();
    expect(sheen.rows).toHaveLength(5);
    expect(crown.rows).toHaveLength(42);
    const sheenBaseline = summarizeMeasurements(sheen.baseline);
    expect(sheenBaseline).toMatchObject({ count: 43, passing: 24, worst: 22.4129 });
    expect(sheenBaseline.rms).toBeCloseTo(8.729602094291078, 12);
    const crownBaseline = summarizeMeasurements(crown.baseline);
    expect(crownBaseline).toMatchObject({ count: 43, passing: 24, worst: 22.4129 });
    expect(crownBaseline.rms).toBeCloseTo(8.729602094291078, 12);
    for (const row of [...sheen.rows, ...crown.rows]) {
      const summary = summarizeMeasurements(row.results);
      expect(summary.count).toBe(43);
      expect(Number.isFinite(summary.rms)).toBe(true);
      expect(Number.isFinite(summary.worst)).toBe(true);
      expect(summary.passing).toBe(row.results.filter((result) => result.pass).length);
      expect(summary.worst).toBe(Math.max(...row.results.map((result) => Math.abs(result.delta))));
    }
  });

  test("rejects the reviewer's exact duplicated black-row, rogue-key, delta/pass fabrication", async () => {
    const { sheen, crown } = await reviewedArchives();
    const fabricatedSheen = mutableSheen(sheen);
    const fabricatedCrown = mutableCrown(crown);
    for (const set of [fabricatedSheen.baseline, ...fabricatedSheen.rows.map((row) => row.results)]) {
      const copied = Object.assign(structuredClone(first(set, "sheen measurements")), {
        rogue: "accepted",
        delta: 999,
        pass: true,
      });
      set.splice(0, set.length, ...Array.from({ length: 43 }, () => structuredClone(copied)));
    }
    for (const set of [fabricatedCrown.baseline, ...fabricatedCrown.rows.map((row) => row.results)]) {
      const copied = Object.assign(structuredClone(first(set, "crown measurements")), {
        rogue: "accepted",
        delta: 999,
        pass: true,
      });
      set.splice(0, set.length, ...Array.from({ length: 43 }, () => structuredClone(copied)));
    }
    expect(() => parseSheenRoughnessArchive(fabricatedSheen)).toThrow("keys must be exactly");
    expect(() => parseEdgeCrownArchive(fabricatedCrown)).toThrow("keys must be exactly");
  });

  test("rejects undeclared result fields and inconsistent delta/pass claims", async () => {
    const { sheen } = await reviewedArchives();
    const rogue = mutableSheen(sheen);
    Object.assign(first(rogue.baseline, "baseline"), { rogue: "accepted" });
    expect(() => parseSheenRoughnessArchive(rogue)).toThrow("keys must be exactly");

    const delta = mutableSheen(sheen);
    first(delta.baseline, "baseline").delta = 999;
    expect(() => parseSheenRoughnessArchive(delta)).toThrow("delta does not match");

    const pass = mutableSheen(sheen);
    const passRow = first(pass.baseline, "baseline");
    passRow.pass = !passRow.pass;
    expect(() => parseSheenRoughnessArchive(pass)).toThrow("pass must match");
  });

  test("rejects non-finite, out-of-range, and internally inconsistent colour measurements", async () => {
    const { sheen } = await reviewedArchives();
    for (const badValue of [Number.NaN, Number.POSITIVE_INFINITY, -1, 256]) {
      const invalid = mutableSheen(sheen);
      first(invalid.baseline, "baseline").measuredRgb = [badValue, 0, 0];
      expect(() => parseSheenRoughnessArchive(invalid)).toThrow();
    }
    const wrongAverage = mutableSheen(sheen);
    first(wrongAverage.baseline, "baseline").measuredRgb = [0, 0, 0];
    expect(() => parseSheenRoughnessArchive(wrongAverage)).toThrow("measuredLuma does not match");

    const wrongSampleCount = mutableSheen(sheen);
    first(wrongSampleCount.baseline, "baseline").measuredSamples = [[0, 0, 0]];
    expect(() => parseSheenRoughnessArchive(wrongSampleCount)).toThrow("exactly 2 samples");
  });

  test("rejects changed coordinate identity, expected stop semantics, and cardinality", async () => {
    const { sheen, crown } = await reviewedArchives();
    const identity = mutableSheen(sheen);
    identity.baseline[1] = structuredClone(first(identity.baseline, "baseline"));
    expect(() => parseSheenRoughnessArchive(identity)).toThrow("canonical surface/token identity");

    const coordinate = mutableSheen(sheen);
    first(coordinate.baseline, "baseline").at = 0.5;
    expect(() => parseSheenRoughnessArchive(coordinate)).toThrow("canonical/recomputed");

    const expected = mutableSheen(sheen);
    first(expected.baseline, "baseline").expectedHex = "#000000";
    expect(() => parseSheenRoughnessArchive(expected)).toThrow("canonical stop");

    const deletedMeasurement = mutableSheen(sheen);
    first(deletedMeasurement.rows, "sheen rows").results.pop();
    expect(() => parseSheenRoughnessArchive(deletedMeasurement)).toThrow("exactly 43");

    const deletedCrown = mutableCrown(crown);
    deletedCrown.rows.pop();
    expect(() => parseEdgeCrownArchive(deletedCrown)).toThrow("42 rows");
  });

  test("rejects incomplete, reordered, duplicate, and out-of-grid sweep coordinates", async () => {
    const { sheen, crown } = await reviewedArchives();
    const reorderedSheen = mutableSheen(sheen);
    const sheenFirst = first(reorderedSheen.rows, "sheen rows");
    const sheenSecond = second(reorderedSheen.rows, "sheen rows");
    reorderedSheen.rows[0] = sheenSecond;
    reorderedSheen.rows[1] = sheenFirst;
    expect(() => parseSheenRoughnessArchive(reorderedSheen)).toThrow("complete and ordered");

    const duplicateCrown = mutableCrown(crown);
    duplicateCrown.rows[1] = structuredClone(first(duplicateCrown.rows, "crown rows"));
    expect(() => parseEdgeCrownArchive(duplicateCrown)).toThrow("duplicate crown row");

    const outOfGrid = mutableCrown(crown);
    first(outOfGrid.rows, "crown rows").extent = 19;
    expect(() => parseEdgeCrownArchive(outOfGrid)).toThrow("outside the reviewed grid");

    const changedConstraint = mutableCrown(crown);
    changedConstraint.constraints.cornerRadius = 27;
    expect(() => parseEdgeCrownArchive(changedConstraint)).toThrow("physical envelope");
  });
});
