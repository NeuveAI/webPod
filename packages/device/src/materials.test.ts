import { describe, expect, test } from "bun:test";
import { Texture } from "three";

import { DEFAULT_DEVICE_FORM } from "./form";
import { DEFAULT_LIGHT_RIG } from "./light-rig";
import { DEFAULT_DEVICE_MATERIALS } from "./materials";
import {
  createBlackPolycarbonateMaterial,
  createPolycarbonateMaterial,
  createCoverGlassMaterial,
  patchBlackPolycarbonateShader,
  patchGlassShader,
} from "./physical-materials";

describe("§12.3 device material contract", () => {
  test("polycarbonate keeps the specified base response", () => {
    expect(DEFAULT_DEVICE_MATERIALS.bodyBlack).toMatchObject({
      albedoScale: 0.2,
      color: "#11161C",
      roughness: 0.7824,
      metalness: 0,
      clearcoat: 0.3384,
      clearcoatRoughness: 0.2817,
      reflectivity: 0.4215,
      sheen: 0.15,
      sheenColor: "#6E4A2E",
      sheenRoughness: 1,
      specularIntensity: 0.0945,
      envMapIntensity: 0.0184,
      subsurfaceColor: "#5C6876",
      subsurfaceDistortion: 0.2214,
      subsurfaceAttenuation: 0.0715,
      subsurfacePower: 1,
      subsurfaceScale: 1.2642,
    });
    expect(DEFAULT_DEVICE_MATERIALS.bodyWhite).toMatchObject({
      color: "#F4F7FA",
      albedoScale: 0.6494,
      roughness: 0.8468,
      clearcoat: 0.0187,
      clearcoatRoughness: 0.7612,
      reflectivity: 0.1718,
      sheen: 0.0914,
      sheenColor: "#F2F6FA",
      sheenRoughness: 0.985,
      specularIntensity: 0.0416,
      envMapIntensity: 0.0024,
      subsurfaceColor: "#F4FAFF",
      subsurfaceDistortion: 0.1824,
      subsurfaceAttenuation: 0.0479,
      subsurfacePower: 1,
      subsurfaceScale: 1.0416,
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
      albedoScale: 0.6094,
      roughness: 0.3692,
      metalness: 0,
      clearcoat: 0.1009,
      clearcoatRoughness: 0.5013,
      envMapIntensity: 0.0061,
    });
    expect(DEFAULT_DEVICE_MATERIALS.selectBlack).toMatchObject({
      transmission: 0.6015,
      thickness: 1.2321,
      ior: 1.52,
      attenuationColor: "#C0CCD8",
      attenuationDistance: 1.2728,
      roughness: 0.1305,
      clearcoat: 0.6287,
      clearcoatRoughness: 0.0798,
      specularIntensity: 0.3479,
      envMapIntensity: 0.0353,
    });
    expect(DEFAULT_DEVICE_MATERIALS.selectWhite.envMapIntensity).toBe(0.0093);
    expect(DEFAULT_DEVICE_MATERIALS.rearInlay).toMatchObject({
      color: "#11161E",
      roughness: 0.58,
      clearcoat: 0.24,
      clearcoatRoughness: 0.26,
      envMapIntensity: 0.18,
    });
    expect(DEFAULT_DEVICE_MATERIALS.holdIndicator).toMatchObject({
      color: "#F16A24",
      roughness: 0.62,
      metalness: 0,
    });
    expect(DEFAULT_DEVICE_MATERIALS.coverGlass).toMatchObject({
      transmission: 0,
      thickness: 0.2,
      ior: 1.5,
      roughness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      specularIntensity: 0.35,
      attenuationColor: "#F5F8FC",
      attenuationDistance: 48,
      opacity: 0.12,
      transparent: true,
      envMapIntensity: 0.16,
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
    expect(DEFAULT_DEVICE_FORM.recessDepth).toBe(4.25);
    expect(DEFAULT_DEVICE_FORM.topEdgeCrown).toBe(1.1);
    expect(DEFAULT_DEVICE_FORM.bottomEdgeCrown).toBe(-1.35);
    expect(DEFAULT_DEVICE_FORM.edgeCrownExtent).toBe(20);
    expect(DEFAULT_DEVICE_MATERIALS.selectWhite.envMapIntensity).toBeGreaterThan(
      DEFAULT_DEVICE_MATERIALS.bodyWhite.envMapIntensity ?? 0,
    );
    expect(DEFAULT_DEVICE_MATERIALS.selectWhite.clearcoatRoughness).toBeLessThan(
      DEFAULT_DEVICE_MATERIALS.bodyWhite.clearcoatRoughness ?? 0,
    );
  });

  test("instantiated cover glass stays reflective without resampling the LCD", () => {
    const material = createCoverGlassMaterial(
      DEFAULT_DEVICE_MATERIALS.coverGlass,
      new Texture(),
    );
    expect(material.transmission).toBe(0);
    expect(material.opacity).toBe(0.12);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.roughness).toBe(0.08);
    expect(material.envMapIntensity).toBe(0.16);
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

  test("black polycarbonate integrates bounded transport into every direct light", () => {
    const material = createBlackPolycarbonateMaterial(
      DEFAULT_DEVICE_MATERIALS.bodyBlack,
      new Texture(),
    );
    expect(material.transparent).toBe(false);
    expect(material.transmission).toBe(0);
    expect(material.specularIntensity).toBe(0.0945);
    expect(material.sheenColor.getHexString()).toBe("6e4a2e");

    const shader = {
      vertexShader: "",
      fragmentShader:
        "#include <common>\nreflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );\nvec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
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

  test("white polycarbonate keeps depth in the direct-light transport path", () => {
    const material = createPolycarbonateMaterial(
      DEFAULT_DEVICE_MATERIALS.bodyWhite,
      new Texture(),
    );
    expect(material.specularIntensity).toBe(0.0416);
    expect(material.sheenColor.getHexString()).toBe("f2f6fa");
    expect(material.onBeforeCompile).toBeDefined();
    expect(material.customProgramCacheKey?.()).toContain("webpod-polycarbonate");

    const shader = {
      vertexShader: "",
      fragmentShader:
        "#include <common>\nreflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );",
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

  test("front dielectrics keep the room as a whisper, not as chrome banding", () => {
    expect(DEFAULT_DEVICE_MATERIALS.bodyBlack.envMapIntensity).toBeLessThan(0.05);
    expect(DEFAULT_DEVICE_MATERIALS.bodyWhite.envMapIntensity).toBeLessThan(0.02);
    expect(DEFAULT_DEVICE_MATERIALS.displayWell.envMapIntensity).toBeLessThan(0.02);
    expect(DEFAULT_DEVICE_MATERIALS.wheelWellBlack.envMapIntensity).toBeLessThan(0.02);
    expect(DEFAULT_DEVICE_MATERIALS.wheelWellWhite.envMapIntensity).toBeLessThan(0.02);
    expect(DEFAULT_DEVICE_MATERIALS.wheelRingBlack.envMapIntensity).toBeLessThan(0.02);
    expect(DEFAULT_DEVICE_MATERIALS.wheelRingWhite.envMapIntensity).toBeLessThan(0.05);
    expect(DEFAULT_DEVICE_MATERIALS.selectBlack.envMapIntensity).toBeLessThan(0.05);
    expect(DEFAULT_DEVICE_MATERIALS.selectWhite.envMapIntensity).toBeLessThan(0.05);
    expect(DEFAULT_DEVICE_MATERIALS.coverGlass.envMapIntensity).toBeLessThan(0.2);
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

describe("LAW 2 light rig", () => {
  test("keeps one 18° key and one 22% lower-left fill", () => {
    expect(DEFAULT_LIGHT_RIG.key.tiltTowardViewerDeg).toBe(18);
    expect(DEFAULT_LIGHT_RIG.key.distance).toBe(1_824.8831);
    expect(DEFAULT_LIGHT_RIG.key.intensity).toBe(25_400_000);
    expect(DEFAULT_LIGHT_RIG.fill.azimuthDeg).toBeLessThan(0);
    expect(DEFAULT_LIGHT_RIG.fill.azimuthDeg).toBe(-44.2187);
    expect(DEFAULT_LIGHT_RIG.fill.elevationDeg).toBeLessThan(0);
    expect(DEFAULT_LIGHT_RIG.fill.elevationDeg).toBe(-74.1022);
    expect(DEFAULT_LIGHT_RIG.fill.distance).toBe(730.2214);
    expect(DEFAULT_LIGHT_RIG.fill.intensityRatio).toBe(0.22);
    expect(DEFAULT_LIGHT_RIG.fill.color).toBe("#D7DEE7");
  });
});
