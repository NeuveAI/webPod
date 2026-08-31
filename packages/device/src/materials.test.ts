import { describe, expect, test } from "bun:test";
import { Texture } from "three";

import { DEFAULT_DEVICE_FORM } from "./form";
import { DEFAULT_LIGHT_RIG } from "./light-rig";
import { DEFAULT_DEVICE_MATERIALS } from "./materials";
import {
  createBlackPolycarbonateMaterial,
  createCoverGlassMaterial,
  patchBlackPolycarbonateShader,
  patchGlassShader,
} from "./physical-materials";

describe("§12.3 device material contract", () => {
  test("polycarbonate keeps the specified base response", () => {
    expect(DEFAULT_DEVICE_MATERIALS.bodyBlack).toMatchObject({
      albedoScale: 1,
      color: "#11161C",
      roughness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.035,
      reflectivity: 0.6,
      sheen: 0.16,
      sheenColor: "#748395",
      sheenRoughness: 0.7,
      specularIntensity: 0.42,
      envMapIntensity: 0.33,
      subsurfaceColor: "#6B7888",
      subsurfaceDistortion: 0.18,
      subsurfaceAttenuation: 0.028,
      subsurfacePower: 3.5,
      subsurfaceScale: 1.65,
    });
    expect(DEFAULT_DEVICE_MATERIALS.bodyWhite).toMatchObject({
      color: "#F4F7FA",
      albedoScale: 0.74,
      roughness: 0.24,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      reflectivity: 0.62,
      specularIntensity: 0.54,
      envMapIntensity: 0.28,
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
      mirrorGain / 3,
    );
    expect(DEFAULT_DEVICE_MATERIALS.bodyWhite.envMapIntensity).toBeLessThan(
      mirrorGain / 3,
    );
  });

  test("wheel, Select, glass and screen keep their physical distinctions", () => {
    expect(DEFAULT_DEVICE_MATERIALS.wheelRingBlack).toMatchObject({
      color: "#1D2128",
      roughness: 0.28,
      clearcoat: 0.72,
      clearcoatRoughness: 0.1,
      envMapIntensity: 0.06,
    });
    expect(DEFAULT_DEVICE_MATERIALS.selectBlack).toMatchObject({
      transmission: 0.46,
      thickness: 1.48,
      ior: 1.52,
      roughness: 0.11,
      clearcoat: 1,
      clearcoatRoughness: 0.035,
      specularIntensity: 0.46,
    });
    expect(DEFAULT_DEVICE_MATERIALS.rearInlay).toMatchObject({
      color: "#11161E",
      roughness: 0.58,
      clearcoat: 0.24,
      clearcoatRoughness: 0.26,
      envMapIntensity: 0.18,
    });
    expect(DEFAULT_DEVICE_MATERIALS.coverGlass).toMatchObject({
      transmission: 0.98,
      thickness: 0.08,
      ior: 1.52,
      roughness: 0,
      clearcoat: 1,
      opacity: 1,
      transparent: false,
    });
    expect(DEFAULT_DEVICE_MATERIALS.screen).toEqual({
      color: "#0B0D11",
      toneMapped: false,
    });
  });

  test("the Pencil-first white wheel remains visibly below the pearl body", () => {
    expect(DEFAULT_DEVICE_MATERIALS.wheelRingWhite.color).toBe("#E7EDF3");
    expect(DEFAULT_DEVICE_MATERIALS.wheelRingWhite.albedoScale).toBeLessThan(
      DEFAULT_DEVICE_MATERIALS.bodyWhite.albedoScale ?? 0,
    );
    expect(DEFAULT_DEVICE_MATERIALS.wheelRingWhite.roughness).toBeGreaterThan(
      DEFAULT_DEVICE_MATERIALS.bodyWhite.roughness,
    );
    expect(DEFAULT_DEVICE_FORM.recessDepth).toBe(2.25);
    expect(DEFAULT_DEVICE_MATERIALS.selectWhite.specularIntensity).toBeGreaterThan(
      DEFAULT_DEVICE_MATERIALS.bodyWhite.specularIntensity ?? 0,
    );
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
    expect(material.transmission).toBe(0.98);
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

  test("black polycarbonate integrates bounded transport into every direct light", () => {
    const material = createBlackPolycarbonateMaterial(
      DEFAULT_DEVICE_MATERIALS.bodyBlack,
      new Texture(),
    );
    expect(material.transparent).toBe(false);
    expect(material.transmission).toBe(0);
    expect(material.specularIntensity).toBe(0.42);
    expect(material.sheenColor.getHexString()).toBe("748395");

    const shader = {
      vertexShader: "",
      fragmentShader:
        "#include <common>\nreflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );\nvec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
    };
    patchBlackPolycarbonateShader(shader);
    expect(shader.fragmentShader).toContain("directLight.direction")
    expect(shader.fragmentShader).toContain("directLight.color")
    expect(shader.fragmentShader).toContain("webpodSssAttenuation")
    expect(shader.fragmentShader).not.toContain("webpodSssAmbient")
    expect(shader.fragmentShader).not.toContain("webpodSssLightDirection")
    expect(shader.fragmentShader).toContain(
      "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
    )
    expect(shader.fragmentShader).not.toContain("+ webpodSubsurface")
    expect(shader.fragmentShader).not.toContain("emissiveMap");
    material.dispose();
  });

  test("the seam is a restrained blue-gray boundary, not mirror-back material", () => {
    expect(DEFAULT_DEVICE_MATERIALS.chromeSeam).toMatchObject({
      color: "#A6AFBA",
      metalness: 0.35,
      roughness: 0.32,
      envMapIntensity: 0.25,
    });
    expect(DEFAULT_DEVICE_MATERIALS.chromeSeam.envMapIntensity).toBeLessThan(
      DEFAULT_DEVICE_MATERIALS.steelBack.envMapIntensity ?? 0,
    );
    expect(DEFAULT_DEVICE_MATERIALS.chromeSeamBlack).toMatchObject({
      color: "#252A31",
      metalness: 0.2,
      roughness: 0.24,
      specularIntensity: 0.34,
      envMapIntensity: 0.38,
    });
    expect(DEFAULT_DEVICE_MATERIALS.chromeSeamBlack.color).not.toBe(
      DEFAULT_DEVICE_MATERIALS.chromeSeam.color,
    );
  });
});

describe("LAW 2 light rig", () => {
  test("keeps one 18° key and one 22% lower-left fill", () => {
    expect(DEFAULT_LIGHT_RIG.key.tiltTowardViewerDeg).toBe(18);
    expect(DEFAULT_LIGHT_RIG.key.distance).toBeGreaterThan(1_000);
    expect(DEFAULT_LIGHT_RIG.key.intensity).toBe(11_000_000);
    expect(DEFAULT_LIGHT_RIG.fill.azimuthDeg).toBeLessThan(0);
    expect(DEFAULT_LIGHT_RIG.fill.elevationDeg).toBeLessThan(0);
    expect(DEFAULT_LIGHT_RIG.fill.intensityRatio).toBe(0.22);
    expect(DEFAULT_LIGHT_RIG.fill.color).toBe("#D7DEE7");
  });
});
