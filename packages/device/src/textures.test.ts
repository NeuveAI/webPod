import { describe, expect, test } from "bun:test";
import { RGBAFormat } from "three";

import {
  createMicroNoiseRoughnessMap,
  createSteelAnisotropyMap,
  wheelDecalLayout,
} from "./textures";

describe("deterministic physical textures", () => {
  test("roughness noise is byte-stable for the default seed", () => {
    const first = createMicroNoiseRoughnessMap(0.02, 16);
    const second = createMicroNoiseRoughnessMap(0.02, 16);
    expect(Array.from(first.image.data as Uint8Array)).toEqual(
      Array.from(second.image.data as Uint8Array),
    );
    first.dispose();
    second.dispose();
  });

  test("roughness noise populates the green channel consumed by Three", async () => {
    const texture = createMicroNoiseRoughnessMap(0.02, 16);
    expect(texture.format).toBe(RGBAFormat);
    const data = texture.image.data as Uint8Array;
    expect(data.length).toBe(16 * 16 * 4);
    for (let index = 0; index < data.length; index += 4) {
      const green = data[index + 1] ?? 0;
      expect(green).toBeGreaterThanOrEqual(250);
      expect(green).toBeLessThanOrEqual(255);
      expect(data[index]).toBe(green);
      expect(data[index + 2]).toBe(green);
      expect(data[index + 3]).toBe(255);
      expect(0.26 * green / 255).toBeGreaterThan(0.25);
    }
    const shader = await Bun.file(new URL('../node_modules/three/src/renderers/shaders/ShaderChunk/roughnessmap_fragment.glsl.js', import.meta.url)).text();
    expect(shader).toContain('roughnessFactor *= texelRoughness.g');
    texture.dispose();
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

  test("wheel transport decals match the measured optical boxes", () => {
    const decal = wheelDecalLayout(81);
    expect(decal.menu).toEqual({ x: -22, y: -88, width: 44, height: 14 });
    expect(decal.previous).toEqual({ x: -91, y: -6.5, width: 20, height: 13 });
    expect(decal.next).toEqual({ x: 71, y: -6.5, width: 20, height: 13 });
    expect(decal.previous.width / 206).toBeCloseTo(22 / 235, 2);
    expect(decal.previous.height / 206).toBeCloseTo(14 / 235, 2);
    expect(decal.previous.width).toBeGreaterThan(13);
  });

  test("play and pause have a real inter-symbol gap", () => {
    const { playPause } = wheelDecalLayout(81);
    const playRight = playPause.play.x + playPause.play.width;
    expect(playPause.pauseLeft.x - playRight).toBe(playPause.interSymbolGap);
    expect(playPause.interSymbolGap).toBe(3.5);
    expect(
      playPause.pauseRight.x -
        (playPause.pauseLeft.x + playPause.pauseLeft.width),
    ).toBe(2);
    expect(
      playPause.pauseRight.x + playPause.pauseRight.width - playPause.bounds.x,
    ).toBe(playPause.bounds.width);
  });
});
