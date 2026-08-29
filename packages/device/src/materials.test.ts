import { describe, expect, test } from "bun:test";
import { Texture } from "three";

import { DEFAULT_LIGHT_RIG } from "./light-rig";
import { DEFAULT_DEVICE_MATERIALS } from "./materials";
import {
  bodyClearcoatShader,
  createCoverGlassMaterial,
  patchBodyClearcoatShader,
  patchGlassShader,
} from "./physical-materials";

describe("§12.3 device material contract", () => {
  test("zero clearcoat profile is byte-identical and cache-key neutral", () => {
    expect(bodyClearcoatShader([[0, 0], [1, 0]], -1, 1)).toEqual({});
  });

  test("body clearcoat patch fails closed when Three's chunk seam changes", () => {
    expect(() => patchBodyClearcoatShader(
      { vertexShader: "#include <begin_vertex>", fragmentShader: "changed" },
      [[0, 5], [1, -5]], -1, 1,
    )).toThrow("three@0.185.1 clearcoat shader seam changed");
  });

  test("body clearcoat patch leaves diffuse and roughness untouched", () => {
    const shader = {
      vertexShader: "#include <common>\n#include <begin_vertex>",
      fragmentShader: "#include <common>\n#include <clearcoat_normal_fragment_begin>",
    };
    patchBodyClearcoatShader(shader, [[0, 8], [1, -8]], -2, 2);
    expect(shader.fragmentShader).toContain("clearcoatNormal = normalize");
    expect(shader.fragmentShader).not.toContain("diffuseColor =");
    expect(shader.fragmentShader).not.toContain("material.roughness =");
  });
  test("polycarbonate keeps the specified base response", () => {
    expect(DEFAULT_DEVICE_MATERIALS.bodyBlack).toMatchObject({
      albedoScale: 1,
      color: "#0C0D0F",
      roughness: 0.28,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      reflectivity: 0.55,
      sheen: 0.15,
      sheenColor: "#6E4A2E",
    });
    expect(DEFAULT_DEVICE_MATERIALS.bodyWhite).toMatchObject({
      color: "#E2E5E8",
      roughness: 0.34,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      reflectivity: 0.5,
    });
  });

  test("mirror steel remains room-driven while front surfaces do not (D-057)", () => {
    const mirrorGain = DEFAULT_DEVICE_MATERIALS.steelBack.envMapIntensity ?? 0;

    expect(DEFAULT_DEVICE_MATERIALS.steelBack).toMatchObject({
      color: "#C4CBD2",
      metalness: 1,
      roughness: 0.08,
      anisotropy: 0.75,
      anisotropyRotation: 0,
      envMapIntensity: 1,
    });
    expect(DEFAULT_DEVICE_MATERIALS.bodyBlack.envMapIntensity).toBeLessThan(
      mirrorGain / 4,
    );
    expect(DEFAULT_DEVICE_MATERIALS.bodyWhite.envMapIntensity).toBeLessThan(
      mirrorGain / 4,
    );
  });

  test("wheel, Select, glass and screen keep their physical distinctions", () => {
    expect(DEFAULT_DEVICE_MATERIALS.wheelRingBlack).toMatchObject({
      color: "#23262B",
      roughness: 0.42,
      clearcoat: 0.6,
    });
    expect(DEFAULT_DEVICE_MATERIALS.selectBlack).toMatchObject({
      transmission: 0.35,
      thickness: 1.2,
      ior: 1.52,
      roughness: 0.18,
      clearcoat: 1,
    });
    expect(DEFAULT_DEVICE_MATERIALS.coverGlass).toMatchObject({
      transmission: 0.92,
      thickness: 0.6,
      ior: 1.52,
      roughness: 0.02,
      clearcoat: 1,
      opacity: 1,
      transparent: false,
    });
    expect(DEFAULT_DEVICE_MATERIALS.screen).toEqual({
      color: "#0B0D11",
      toneMapped: false,
    });
  });

  test("instantiated cover glass obeys transmission and carries two-hue dispersion", () => {
    const material = createCoverGlassMaterial(
      DEFAULT_DEVICE_MATERIALS.coverGlass,
      new Texture(),
      {
        width: 284,
        height: 216,
      },
    );
    expect(material.transmission).toBe(0.92);
    expect(material.opacity).toBe(1);
    expect(material.transparent).toBe(false);
    const shader = {
      vertexShader: "#include <common>\n#include <begin_vertex>",
      fragmentShader: "#include <common>\n#include <opaque_fragment>",
    };
    patchGlassShader(shader, { width: 284, height: 216 });
    expect(shader.fragmentShader).toContain("glassEdgeCool");
    expect(shader.fragmentShader).toContain("glassEdgeWarm");
    expect(shader.fragmentShader).toContain("webpodFresnel");
    material.dispose();
  });

  test("the seam is chrome rather than mirror-back material", () => {
    expect(DEFAULT_DEVICE_MATERIALS.chromeSeam).toMatchObject({
      color: "#98A1AA",
      metalness: 1,
      roughness: 0.18,
      envMapIntensity: 0.8,
    });
    expect(DEFAULT_DEVICE_MATERIALS.chromeSeam.envMapIntensity).toBeLessThan(
      DEFAULT_DEVICE_MATERIALS.steelBack.envMapIntensity ?? 0,
    );
  });
});

describe("LAW 2 light rig", () => {
  test("keeps one 18° key and one 22% lower-left fill", () => {
    expect(DEFAULT_LIGHT_RIG.key.tiltTowardViewerDeg).toBe(18);
    expect(DEFAULT_LIGHT_RIG.key.distance).toBeGreaterThan(1_000);
    expect(DEFAULT_LIGHT_RIG.fill.azimuthDeg).toBeLessThan(0);
    expect(DEFAULT_LIGHT_RIG.fill.elevationDeg).toBeLessThan(0);
    expect(DEFAULT_LIGHT_RIG.fill.intensityRatio).toBe(0.22);
  });
});
