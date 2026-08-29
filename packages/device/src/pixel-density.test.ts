import { describe, expect, test } from "bun:test";

import { resolveCanvasPixelRatio } from "./pixel-density";

describe("canvas physical-pixel density", () => {
  test.each([
    [330, 552, 330, 552, 1],
    [330, 552, 660, 1104, 2],
    [330, 552, 990, 1656, 3],
    [275, 460, 550, 920, 2],
  ])("maps a %ipx by %ipx CSS canvas to its physical box", (
    cssWidth,
    cssHeight,
    inlineSize,
    blockSize,
    expected,
  ) => {
    expect(resolveCanvasPixelRatio({
      cssWidth,
      cssHeight,
      devicePixelBox: { inlineSize, blockSize },
      fallbackDevicePixelRatio: 1,
    })).toBe(expected);
  });

  test("uses browser DPR when the physical box API is unavailable", () => {
    expect(resolveCanvasPixelRatio({
      cssWidth: 330,
      cssHeight: 552,
      fallbackDevicePixelRatio: 2.5,
    })).toBe(2.5);
  });

  test("does not let a CSS-sized emulation box override a higher browser DPR", () => {
    expect(resolveCanvasPixelRatio({
      cssWidth: 330,
      cssHeight: 552,
      devicePixelBox: { inlineSize: 330, blockSize: 552 },
      fallbackDevicePixelRatio: 3,
    })).toBe(3);
  });

  test("clamps expensive or invalid device scales to the supported 1–3 range", () => {
    expect(resolveCanvasPixelRatio({ cssWidth: 330, cssHeight: 552, fallbackDevicePixelRatio: 4 })).toBe(3);
    expect(resolveCanvasPixelRatio({ cssWidth: 0, cssHeight: 0, fallbackDevicePixelRatio: 0 })).toBe(1);
  });
});
