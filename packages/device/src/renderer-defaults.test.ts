import { describe, expect, test } from "bun:test";

import {
  applyDeviceRendererDefaults,
  DEVICE_TRANSMISSION_RESOLUTION_SCALE,
} from "./renderer-defaults";

describe("device renderer defaults", () => {
  test("keeps the transmission pass on the native drawing-buffer grid", () => {
    const renderer = { transmissionResolutionScale: 12 };
    applyDeviceRendererDefaults(renderer);
    expect(DEVICE_TRANSMISSION_RESOLUTION_SCALE).toBe(1);
    expect(renderer.transmissionResolutionScale).toBe(1);
    expect(renderer.transmissionResolutionScale).not.toBeGreaterThan(1);
  });
});
