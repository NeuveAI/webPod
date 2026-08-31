import { describe, expect, test } from "bun:test";
import { CanvasTexture, LinearFilter } from "three";

import {
  BACK_COMPOSITION_LAYOUT,
  createMicroNoiseRoughnessMap,
  createSteelAnisotropyMap,
  tuneEtchedTextTexture,
} from "./textures";

describe("deterministic physical textures", () => {
  test("the back composition preserves Pencil's native inlay hierarchy", () => {
    expect(BACK_COMPOSITION_LAYOUT).toMatchObject({
      width: 330,
      height: 552,
      inlay: { x: 22, y: 150, width: 286, height: 296, radius: 14 },
      legalY: 456,
      serialY: 473,
      liveY: 492,
    });
  });

  test("the back composition texture stays sharp enough for the etched rear copy", () => {
    if (typeof OffscreenCanvas !== "function") return;
    const texture = tuneEtchedTextTexture(
      new CanvasTexture(new OffscreenCanvas(660, 1104)),
    );
    expect(texture.generateMipmaps).toBe(false);
    expect(texture.minFilter).toBe(LinearFilter);
    expect(texture.magFilter).toBe(LinearFilter);
    expect(texture.anisotropy).toBe(8);
    texture.dispose();
  });

  test("roughness noise is byte-stable for the default seed", () => {
    const first = createMicroNoiseRoughnessMap(0.02, 16);
    const second = createMicroNoiseRoughnessMap(0.02, 16);
    expect(Array.from(first.image.data as Uint8Array)).toEqual(
      Array.from(second.image.data as Uint8Array),
    );
    first.dispose();
    second.dispose();
  });

  test("steel grain encodes horizontal direction and bounded strength", () => {
    const texture = createSteelAnisotropyMap(16);
    const data = texture.image.data as Uint8Array;
    for (let offset = 0; offset < data.length; offset += 4) {
      expect(data[offset]).toBe(255);
      expect(data[offset + 1]).toBe(128);
      expect(data[offset + 2]).toBeGreaterThanOrEqual(230);
      expect(data[offset + 2]).toBeLessThanOrEqual(255);
    }
    texture.dispose();
  });
});
