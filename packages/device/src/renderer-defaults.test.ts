import { describe, expect, test } from "bun:test";

import {
  applyDeviceRendererDefaults,
  DEVICE_TRANSMISSION_RESOLUTION_SCALE,
} from "./renderer-defaults";

describe("device renderer defaults", () => {
  test("raises the transmission pass above the base viewport resolution", () => {
    const renderer = { transmissionResolutionScale: 1 };
    applyDeviceRendererDefaults(renderer);
    expect(DEVICE_TRANSMISSION_RESOLUTION_SCALE).toBe(12);
    expect(renderer.transmissionResolutionScale).toBe(12);
    expect(renderer.transmissionResolutionScale).toBeGreaterThan(8);
  });
});
