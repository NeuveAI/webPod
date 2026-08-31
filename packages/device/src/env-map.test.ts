import { describe, expect, test } from "bun:test";

import { DEFAULT_ENV_ROOM } from "./env-map";

describe("mirror room defaults", () => {
  test("the shipped room carries the tuned per-band steel compensation", () => {
    expect(DEFAULT_ENV_ROOM.elevHalfSpanDeg).toBe(14.8756);
    expect(DEFAULT_ENV_ROOM.exposure).toBe(1.18);
    expect(DEFAULT_ENV_ROOM.profileContrast).toBe(0.9906);
    expect(DEFAULT_ENV_ROOM.stopExposure).toEqual([
      1,
      0.99,
      0.99,
      0.99,
      1.01,
      1.01,
      1,
      1.01,
      1.01,
      1.01,
      0.99,
    ]);
  });
});
