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
  test("polycarbonate keeps the specified base response", () => {
    expect(DEFAULT_DEVICE_MATERIALS.bodyBlack).toMatchObject({
      albedoScale: 0.34,
      color: "#11161C",
      roughness: 0.68,
      metalness: 0,
      clearcoat: 0.32,
      clearcoatRoughness: 0.46,
      reflectivity: 0.38,
      sheen: 0.15,
      sheenColor: "#6E4A2E",
      sheenRoughness: 1,
      specularIntensity: 0.16,
      envMapIntensity: 0.008,
      subsurfaceColor: "#5C6876",
      subsurfaceDistortion: 0.2214,
      subsurfaceAttenuation: 0.1,
      subsurfacePower: 1,
      subsurfaceScale: 1.4,
    });
    expect(DEFAULT_DEVICE_MATERIALS.bodyWhite).toMatchObject({
      color: "#F4F7FA",
      albedoScale: 0.6494,
      roughness: 0.78,
      clearcoat: 0.12,
      clearcoatRoughness: 0.5,
      reflectivity: 0.1718,
      sheen: 0.0914,
      sheenColor: "#F2F6FA",
      sheenRoughness: 0.985,
      specularIntensity: 0.08,
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
      color: "#24292F",
      albedoScale: 0.62,
      roughness: 0.44,
      metalness: 0,
      clearcoat: 0.08,
      clearcoatRoughness: 0.56,
      envMapIntensity: 0.006,
    });
    expect(DEFAULT_DEVICE_MATERIALS.selectBlack).toMatchObject({
      color: "#11151A",
      albedoScale: 0.78,
      transmission: 0.03,
      thickness: 1,
      ior: 1.52,
      attenuationColor: "#BAC4CE",
      attenuationDistance: 1.4,
      roughness: 0.5,
      clearcoat: 0.08,
      clearcoatRoughness: 0.46,
      specularIntensity: 0.08,
      envMapIntensity: 0.006,
    });
    expect(DEFAULT_DEVICE_MATERIALS.selectWhite.envMapIntensity).toBe(0.006);
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

  test("OEM black and white wheel assemblies are separate calibrations, not inversions", () => {
    expect(DEFAULT_WHEEL_COLOURWAYS.black).toMatchObject({
      ring: { color: "#24292F", roughness: 0.44 },
      select: { color: "#11151A", roughness: 0.5 },
      labelColor: "#B9BFC7",
    });
    expect(DEFAULT_WHEEL_COLOURWAYS.white).toMatchObject({
      ring: { color: "#DEE3E7", roughness: 0.8 },
      select: { color: "#F7F8F7", roughness: 0.6 },
      labelColor: "#7B838E",
    });
    expect(DEFAULT_DEVICE_MATERIALS.wheelRingWhite.color).toBe("#DEE3E7");
    expect(DEFAULT_DEVICE_MATERIALS.wheelRingWhite.roughness).toBeGreaterThan(
      DEFAULT_DEVICE_MATERIALS.wheelRingBlack.roughness,
    );
    expect(DEFAULT_DEVICE_FORM.recessDepth).toBe(1);
    expect(DEFAULT_DEVICE_FORM.bodyCrown).toBe(1.2);
    expect(DEFAULT_DEVICE_FORM.bodyCrossCrown).toBe(1.2);
    expect(DEFAULT_DEVICE_FORM.topEdgeCrown).toBe(0);
    expect(DEFAULT_DEVICE_FORM.bottomEdgeCrown).toBe(0);
    expect(DEFAULT_DEVICE_FORM.edgeCrownExtent).toBe(20);
    expect(DEFAULT_DEVICE_MATERIALS.selectWhite.envMapIntensity).toBeGreaterThan(
      DEFAULT_DEVICE_MATERIALS.bodyWhite.envMapIntensity ?? 0,
    );
    expect(DEFAULT_DEVICE_MATERIALS.selectWhite.clearcoat).toBeLessThan(
      DEFAULT_DEVICE_MATERIALS.bodyWhite.clearcoat ?? 0,
    );
    expect(hexLuma255(DEFAULT_DEVICE_MATERIALS.wheelLabelBlack)).toBeGreaterThan(
      hexLuma255(DEFAULT_DEVICE_MATERIALS.wheelRingBlack.color) + 100,
    );
    const whiteInk = hexLuma255(DEFAULT_DEVICE_MATERIALS.wheelLabelWhite);
    expect(whiteInk).toBeGreaterThan(hexLuma255("#5E646D"));
    expect(whiteInk).toBeLessThan(
      hexLuma255(DEFAULT_DEVICE_MATERIALS.wheelRingWhite.color) - 45,
    );
    expect(DEFAULT_DEVICE_MATERIALS.wheelLabelWhite).not.toBe(
      DEFAULT_DEVICE_MATERIALS.wheelLabelBlack,
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
    expect(material.specularIntensity).toBe(0.16);
    expect(material.sheenColor.getHexString()).toBe("6e4a2e");

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

  test("white polycarbonate keeps depth in the direct-light transport path", () => {
    const material = createPolycarbonateMaterial(
      DEFAULT_DEVICE_MATERIALS.bodyWhite,
      new Texture(),
    );
    expect(material.specularIntensity).toBe(0.08);
    expect(material.sheenColor.getHexString()).toBe("f2f6fa");
    expect(material.onBeforeCompile).toBeDefined();
    expect(material.customProgramCacheKey?.()).toContain("webpod-polycarbonate");

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

describe("owner two-light studio rig", () => {
  test("locks explicit key, kick, softness, ratio and linear exposure values", () => {
    expect(DEFAULT_LIGHT_RIG.exposure).toBe(0.92);
    expect(DEFAULT_LIGHT_RIG.key.viewerAzimuthDeg).toBe(45);
    expect(DEFAULT_LIGHT_RIG.key.descentDeg).toBe(40);
    expect(DEFAULT_LIGHT_RIG.key.distance).toBe(720);
    expect(DEFAULT_LIGHT_RIG.key.power).toBe(9_000_000);
    expect(DEFAULT_LIGHT_RIG.key.emitter).toEqual({ width: 520, height: 380 });
    expect(DEFAULT_LIGHT_RIG.key.color).toBe("#FFF9F2");
    expect(DEFAULT_LIGHT_RIG.kick.viewerAzimuthDeg).toBe(-120);
    expect(DEFAULT_LIGHT_RIG.kick.elevationDeg).toBe(-10);
    expect(DEFAULT_LIGHT_RIG.kick.distance).toBe(650);
    expect(DEFAULT_LIGHT_RIG.kick.target).toEqual([-110, -210, -20]);
    expect(DEFAULT_LIGHT_RIG.kick.powerRatio).toBe(0.03);
    expect(DEFAULT_LIGHT_RIG.kick.emitter).toEqual({ width: 85, height: 300 });
    expect(DEFAULT_LIGHT_RIG.kick.color).toBe("#DCE7F2");
  });
});
