import { describe, expect, test } from "bun:test";
import { ShaderChunk, Texture } from "three";

import { DEFAULT_DEVICE_FORM } from "./form";
import { DEFAULT_LIGHT_RIG } from "./light-rig";
import { hexLuma255 } from "./colour";
import {
  DEFAULT_DEVICE_MATERIALS,
  DEFAULT_WHEEL_COLOURWAYS,
} from "./materials";
import {
  createBlackPolycarbonateMaterial,
  createPolycarbonateMaterial,
  createCoverGlassMaterial,
  patchBlackPolycarbonateShader,
  patchGlassShader,
} from "./physical-materials";

describe("§12.3 device material contract", () => {
  test("Classic faceplate and Select share one opaque brushed aluminum finish", () => {
    for (const [body, select] of [
      [DEFAULT_DEVICE_MATERIALS.bodyBlack, DEFAULT_DEVICE_MATERIALS.selectBlack],
      [DEFAULT_DEVICE_MATERIALS.bodyWhite, DEFAULT_DEVICE_MATERIALS.selectWhite],
    ] as const) {
      expect(body).toBe(select);
      expect(body.metalness).toBe(1);
      expect(body.clearcoat).toBe(0);
      expect(body.transmission).toBe(0);
      expect(body.sheen).toBe(0);
      expect(body.subsurfaceScale ?? 0).toBe(0);
      expect(body.roughness).toBeGreaterThan(0.4);
      expect(body.anisotropy).toBeGreaterThan(0);
    }
  });

  test("polished steel has a tighter lobe than the aluminum front", () => {
    expect(DEFAULT_DEVICE_MATERIALS.steelBack.metalness).toBe(1);
    expect(DEFAULT_DEVICE_MATERIALS.steelBack.roughness).toBeLessThan(
      DEFAULT_DEVICE_MATERIALS.bodyBlack.roughness / 2,
    );
  });

  test("wheel plastic stays matte while the independent screen cover stays clear", () => {
    for (const wheel of [DEFAULT_WHEEL_COLOURWAYS.black, DEFAULT_WHEEL_COLOURWAYS.white]) {
      expect(wheel.ring.metalness).toBe(0);
      expect(wheel.ring.roughness).toBeGreaterThan(0.7);
      expect(wheel.ring.clearcoat).toBe(0);
      expect(wheel.ring.color).not.toBe(wheel.select.color);
    }
    expect(DEFAULT_DEVICE_MATERIALS.coverGlass).toMatchObject({
      transmission: 0, thickness: 0.2, ior: 1.5, roughness: 0.08,
      clearcoat: 1, clearcoatRoughness: 0.06, specularIntensity: 1,
      color: "#000000", opacity: 0.2, transparent: true, envMapIntensity: 1.1,
    });
    expect(DEFAULT_DEVICE_MATERIALS.screen).toEqual({ color: "#0B0D11", toneMapped: false });
  });

  test("black and silver wheel legends contrast with their plastic rings", () => {
    expect(hexLuma255(DEFAULT_WHEEL_COLOURWAYS.black.labelColor)).toBeGreaterThan(
      hexLuma255(DEFAULT_WHEEL_COLOURWAYS.black.ring.color) + 100,
    );
    expect(hexLuma255(DEFAULT_WHEEL_COLOURWAYS.white.labelColor)).toBeLessThan(
      hexLuma255(DEFAULT_WHEEL_COLOURWAYS.white.ring.color) - 100,
    );
  });

  test("instantiated cover glass stays reflective without resampling the LCD", () => {
    const material = createCoverGlassMaterial(
      DEFAULT_DEVICE_MATERIALS.coverGlass,
      new Texture(),
    );
    expect(material.transmission).toBe(0);
    expect(material.opacity).toBe(0.2);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.roughness).toBe(0.08);
    expect(material.envMapIntensity).toBe(1.1);
    const shader = {
      vertexShader: "#include <common>\n#include <begin_vertex>",
      fragmentShader: "#include <common>\n#include <opaque_fragment>",
    };
    const beforeVertex = shader.vertexShader;
    const beforeFragment = shader.fragmentShader;
    patchGlassShader(shader, { width: 284, height: 216 });
    expect(shader.vertexShader).toBe(beforeVertex);
    expect(shader.fragmentShader).toBe(beforeFragment);
    expect(shader.fragmentShader).not.toContain("glassEdgeCool");
    expect(shader.fragmentShader).not.toContain("glassEdgeWarm");
    expect(shader.fragmentShader).not.toContain("vWebpodGlassUv");
    expect(shader.fragmentShader).not.toContain("outgoingLight +=");
    material.dispose();
  });

  test("the legacy transport helper still patches every direct light", () => {
    const material = createBlackPolycarbonateMaterial(
      DEFAULT_DEVICE_MATERIALS.bodyBlack,
      new Texture(),
    );
    expect(material.transparent).toBe(false);
    expect(material.transmission).toBe(0);
    expect(material.metalness).toBe(1);
    expect(material.sheen).toBe(0);

    const shader = {
      vertexShader: "",
      fragmentShader:
        "#include <common>\nreflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );\nvec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
    };
    patchBlackPolycarbonateShader(shader);
    expect(shader.fragmentShader).toContain("directLight.direction");
    expect(shader.fragmentShader).toContain("directLight.color");
    expect(shader.fragmentShader).toContain("webpodSssAttenuation");
    expect(shader.fragmentShader).not.toContain("webpodSssAmbient");
    expect(shader.fragmentShader).not.toContain("webpodSssLightDirection");
    expect(shader.fragmentShader).toContain(
      "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
    );
    expect(shader.fragmentShader).not.toContain("+ webpodSubsurface");
    expect(shader.fragmentShader).not.toContain("emissiveMap");
    material.dispose();
  });

  test("polycarbonate transport patches Three's installed direct and area-light chunks", () => {
    const shader = {
      vertexShader: "",
      fragmentShader:
        "#include <common>\n#include <lights_physical_pars_fragment>",
    };
    patchBlackPolycarbonateShader(shader);
    expect(ShaderChunk.lights_physical_pars_fragment).toContain(
      "RE_Direct_RectArea_Physical",
    );
    expect(shader.fragmentShader).not.toContain(
      "#include <lights_physical_pars_fragment>",
    );
    expect(shader.fragmentShader).toContain("webpodScatteringHalf");
    expect(shader.fragmentShader).toContain("webpodAreaScatteringHalf");
    expect(shader.fragmentShader).toContain("webpodAreaIrradiance");
    expect(shader.fragmentShader).toContain("LTC_Evaluate");
  });

  test("silver aluminum does not install the legacy plastic scattering shader", () => {
    const material = createPolycarbonateMaterial(
      DEFAULT_DEVICE_MATERIALS.bodyWhite,
      new Texture(),
    );
    expect(material.metalness).toBe(1);
    expect(material.sheen).toBe(0);
    expect(material.onBeforeCompile).toBeDefined();
    expect(material.customProgramCacheKey?.()).not.toContain("webpod-polycarbonate");

    const shader = {
      vertexShader: "",
      fragmentShader:
        "#include <common>\nreflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );",
    };
    patchBlackPolycarbonateShader(shader);
    expect(shader.fragmentShader).toContain("webpodSssColor");
    expect(shader.fragmentShader).toContain("directLight.color");
    material.dispose();
  });

  test("the seam is a restrained blue-gray boundary, not mirror-back material", () => {
    expect(DEFAULT_DEVICE_MATERIALS.chromeSeam).toMatchObject({
      color: "#A6AFBA",
      metalness: 0.35,
      roughness: 0.4986,
      envMapIntensity: 0.045,
    });
    expect(DEFAULT_DEVICE_MATERIALS.chromeSeam.envMapIntensity).toBeLessThan(
      DEFAULT_DEVICE_MATERIALS.steelBack.envMapIntensity ?? 0,
    );
    expect(DEFAULT_DEVICE_MATERIALS.chromeSeamBlack).toMatchObject({
      color: "#252A31",
      metalness: 0.2,
      roughness: 0.5398,
      specularIntensity: 0.1774,
      envMapIntensity: 0.0363,
    });
    expect(DEFAULT_DEVICE_MATERIALS.chromeSeamBlack.color).not.toBe(
      DEFAULT_DEVICE_MATERIALS.chromeSeam.color,
    );
  });

  test("plastic cavities stay matte while the clear window reflects the studio", () => {
    expect(DEFAULT_DEVICE_MATERIALS.displayWell.envMapIntensity).toBeLessThan(0.02);
    expect(DEFAULT_DEVICE_MATERIALS.wheelWellBlack.envMapIntensity).toBeLessThan(0.02);
    expect(DEFAULT_DEVICE_MATERIALS.wheelWellWhite.envMapIntensity).toBeLessThan(0.02);
    expect(DEFAULT_DEVICE_MATERIALS.wheelRingBlack.envMapIntensity).toBeLessThan(0.02);
    expect(DEFAULT_DEVICE_MATERIALS.wheelRingWhite.envMapIntensity).toBeLessThan(0.05);
    expect(DEFAULT_DEVICE_MATERIALS.coverGlass.envMapIntensity).toBeGreaterThan(DEFAULT_DEVICE_MATERIALS.bodyBlack.envMapIntensity ?? 0);
    expect(Math.abs(DEFAULT_DEVICE_FORM.topEdgeCrown)).toBeLessThan(1.5);
    expect(Math.abs(DEFAULT_DEVICE_FORM.bottomEdgeCrown)).toBeLessThan(1.6);
    expect(DEFAULT_DEVICE_FORM.edgeCrownExtent).toBeLessThan(24);
    expect(DEFAULT_DEVICE_MATERIALS.coverGlass.transmission).toBe(0);
    expect(DEFAULT_DEVICE_MATERIALS.coverGlass.ior).toBe(1.5);

    // Regression against the rejected striped/shimmery front pass.
    expect(DEFAULT_DEVICE_MATERIALS.bodyBlack.envMapIntensity).not.toBe(0.162);
    expect(DEFAULT_DEVICE_MATERIALS.bodyWhite.envMapIntensity).not.toBe(0.1127);
    expect(DEFAULT_DEVICE_MATERIALS.selectBlack.envMapIntensity).not.toBe(0.4475);
    expect(DEFAULT_DEVICE_MATERIALS.selectWhite.envMapIntensity).not.toBe(0.4785);
    expect(DEFAULT_DEVICE_FORM.topEdgeCrown).not.toBe(2);
    expect(DEFAULT_DEVICE_FORM.bottomEdgeCrown).not.toBe(-2.5);
  });
});

describe("three-light product studio", () => {
  test("has an elevated key, broad lower-left fill and tall rear strip with distinct roles", () => {
    const { key, kick, rim } = DEFAULT_LIGHT_RIG;
    expect([key.enabled, kick.enabled, rim.enabled]).toEqual([true, true, true]);
    expect(key.viewerAzimuthDeg).toBeGreaterThan(0);
    expect(key.descentDeg).toBeGreaterThan(25);
    expect(kick.viewerAzimuthDeg).toBeLessThan(0);
    expect(kick.elevationDeg).toBeLessThan(0);
    expect(kick.powerRatio).toBeGreaterThan(0);
    expect(kick.powerRatio).toBeLessThan(1);
    expect(kick.emitter.width).toBeGreaterThan(key.emitter.width);
    expect(rim.position[2]).toBeLessThan(0);
    expect(rim.emitter.height / rim.emitter.width).toBeGreaterThan(4);
    expect(rim.powerRatio).toBeGreaterThan(0);
    expect(rim.powerRatio).toBeLessThan(kick.powerRatio);
  });
});
