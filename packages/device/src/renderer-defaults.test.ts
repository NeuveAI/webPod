import { describe, expect, test } from "bun:test";
import { AgXToneMapping, NoToneMapping } from "three";

import {
  applyDeviceRendererDefaults,
  DEVICE_TRANSMISSION_RESOLUTION_SCALE,
} from "./renderer-defaults";

describe("device renderer defaults", () => {
  test("keeps the transmission pass on the native drawing-buffer grid", () => {
    const renderer = { transmissionResolutionScale: 12, toneMapping: NoToneMapping as number, toneMappingExposure: 2 };
    applyDeviceRendererDefaults(renderer);
    expect(renderer.toneMapping).toBe(AgXToneMapping);
    expect(renderer.toneMappingExposure).toBe(1);
    expect(DEVICE_TRANSMISSION_RESOLUTION_SCALE).toBe(1);
    expect(renderer.transmissionResolutionScale).toBe(1);
    expect(renderer.transmissionResolutionScale).not.toBeGreaterThan(1);
  });
});
