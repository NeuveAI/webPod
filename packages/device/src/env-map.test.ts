import { describe, expect, test } from "bun:test";

import { DEFAULT_ENV_ROOM } from "./env-map";

describe("mirror room defaults", () => {
  test("the shipped room retains room structure with radiance headroom", () => {
    expect(DEFAULT_ENV_ROOM.elevHalfSpanDeg).toBe(14.8756);
    expect(DEFAULT_ENV_ROOM.exposure).toBe(0.78);
    expect(DEFAULT_ENV_ROOM.profileSharpenAmount).toBe(0);
    expect(DEFAULT_ENV_ROOM.profileSharpenAmount2).toBe(0);
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
