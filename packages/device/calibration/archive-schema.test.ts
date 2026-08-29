import { describe, expect, test } from "bun:test";
import type { ProbeResult } from "../src/luminance-probe";
import { parseEdgeCrownArchive, parseSheenRoughnessArchive } from "./archive-schema";

function measurements(): Array<ProbeResult> {
  return Array.from({ length: 43 }, (_, index) => ({
    surface: "body-black",
    token: `row-${index}`,
    at: index / 42,
    expectedHex: "#000000",
    expectedLuma: 0,
    measuredLuma: 0,
    measuredRgb: [0, 0, 0],
    measuredSamples: [[0, 0, 0]],
    delta: 0,
    pass: true,
  }));
}

function sheenArchive() {
  return {
    schema: "webpod-sheen-roughness-sweep-v1",
    semantics: "Three uniform sheen roughness",
    baseline: measurements(),
    rows: [1, 0.9, 0.7, 0.4, 0.1].map((sheenRoughness) => ({ sheenRoughness, results: measurements() })),
  };
}

function crownArchive() {
  return {
    schema: "webpod-edge-crown-sweep-v1",
    baseline: measurements(),
    constraints: { bodyWidth: 330, bodyHeight: 552, cornerRadius: 26, frontThickness: 14, maxDepth: 3, extent: { min: 18, max: 36, step: 3 } },
    rows: [18, 21, 24, 27, 30, 33, 36].flatMap((extent) => [0.5, 1, 1.5, 2, 2.5, 3].map((depth) => ({ extent, depth, results: measurements() }))),
  };
}

describe("calibration archive schemas", () => {
  test("accepts the complete reviewed sheen and crown shapes", () => {
    expect(parseSheenRoughnessArchive(sheenArchive()).rows).toHaveLength(5);
    expect(parseEdgeCrownArchive(crownArchive()).rows).toHaveLength(42);
  });

  test("rejects a deleted sheen result and a deleted crown candidate", () => {
    const sheen = sheenArchive();
    sheen.rows[0]?.results.pop();
    expect(() => parseSheenRoughnessArchive(sheen)).toThrow("exactly 43");
    const crown = crownArchive();
    crown.rows.pop();
    expect(() => parseEdgeCrownArchive(crown)).toThrow("42 rows");
  });

  test("rejects a duplicate crown candidate and an unreviewed constraint", () => {
    const duplicate = crownArchive();
    const first = duplicate.rows.at(0);
    if (first === undefined) throw new Error("fixture must contain a first row");
    duplicate.rows[1] = first;
    expect(() => parseEdgeCrownArchive(duplicate)).toThrow("duplicate crown row");
    const changed = crownArchive();
    changed.constraints.cornerRadius = 27;
    expect(() => parseEdgeCrownArchive(changed)).toThrow("physical envelope");
  });
});
