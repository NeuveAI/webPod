import { describe, expect, test } from "bun:test";
import { ShaderChunk, Vector3 } from "three";

import {
  CONTROL_TRAVEL,
  WHEEL_CONTACT_FOOTPRINT_MM,
  WHEEL_REST_NORMAL_ATTRIBUTE,
  type WheelReadabilitySample,
} from "./control-physics";
import { DEVICE_LAYOUT, PX_PER_MM } from "./layout";
import {
  assertWheelGrazingShaderStructure,
  createWheelGrazingMaterial,
  patchWheelGrazingShader,
  WHEEL_GRAZING_RESPONSE,
  WheelGrazingResponse,
  wheelGrazingPose,
} from "./wheel-readability";
import { DEFAULT_WHEEL_COLOURWAYS } from "./materials";

const { wheel } = DEVICE_LAYOUT;

function sampleAt(
  angleDeg: number,
  engagement = 1,
): WheelReadabilitySample {
  const radius = (wheel.selectLipR + wheel.outerR) / 2;
  const angle = (angleDeg * Math.PI) / 180;
  return {
    point: {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      z: 2,
    },
    normal: { x: 0, y: 0, z: 1 },
    engagement,
  };
}

function numberUniform(
  uniforms: Record<string, { value: unknown }>,
  name: string,
): number {
  const value = uniforms[name]?.value;
  if (typeof value !== "number") {
    throw new Error(`expected numeric shader uniform ${name}`);
  }
  return value;
}

describe("wheel contact grazing readability", () => {
  test("the bounded calibration is explicit and does not increase travel", () => {
    expect(WHEEL_GRAZING_RESPONSE).toEqual({
      tangentOffsetMm: 8,
      surfaceLiftMm: 1.5,
      rangeMm: 12,
      innerConeDeg: 8,
      outerConeDeg: 18,
      normalSlopeStartDeg: 0.65,
      normalSlopeFullDeg: 0.9,
      peakLinearIrradiance: 40,
      color: "#FFFFFF",
    });
    expect(CONTROL_TRAVEL.wheelMm).toBe(0.08);
  });

  test("the contact-local source follows all four angles in model space", () => {
    for (const angleDeg of [0, 90, 180, 270]) {
      const sample = sampleAt(angleDeg);
      const pose = wheelGrazingPose(sample);
      const point = new Vector3(
        sample.point.x,
        sample.point.y,
        sample.point.z,
      );
      const source = new Vector3(
        pose.position.x,
        pose.position.y,
        pose.position.z,
      );
      const direction = new Vector3(
        pose.direction.x,
        pose.direction.y,
        pose.direction.z,
      );
      const expectedDistanceMm = Math.hypot(
        WHEEL_GRAZING_RESPONSE.tangentOffsetMm,
        WHEEL_GRAZING_RESPONSE.surfaceLiftMm,
      );
      const grazingAngleDeg =
        (Math.atan2(
          WHEEL_GRAZING_RESPONSE.surfaceLiftMm,
          WHEEL_GRAZING_RESPONSE.tangentOffsetMm,
        ) *
          180) /
        Math.PI;
      const outerConeRadiusMm =
        Math.tan(
          (WHEEL_GRAZING_RESPONSE.outerConeDeg * Math.PI) / 180,
        ) * expectedDistanceMm;

      expect(source.distanceTo(point) / PX_PER_MM).toBeCloseTo(
        expectedDistanceMm,
        8,
      );
      expect(grazingAngleDeg).toBeLessThan(15);
      expect(outerConeRadiusMm).toBeLessThan(
        WHEEL_CONTACT_FOOTPRINT_MM.radial,
      );
      expect(direction.dot(point.clone().sub(source).normalize())).toBeCloseTo(
        1,
        8,
      );
      expect(pose.target).toEqual(sample.point);
      expect(pose.normal).toEqual(sample.normal);
      expect(Math.hypot(source.x, source.y)).toBeLessThan(wheel.outerR);
      expect(Math.hypot(source.x, source.y)).toBeGreaterThan(wheel.selectLipR);
    }
  });

  test("rest is dark and every optical value remains inside its literal bound", () => {
    const rest = wheelGrazingPose(sampleAt(0, 0));
    const overdriven = wheelGrazingPose(sampleAt(90, 8));
    const negative = wheelGrazingPose(sampleAt(180, -3));

    expect(rest.irradiance).toBe(0);
    expect(negative.irradiance).toBe(0);
    expect(overdriven.irradiance).toBe(
      WHEEL_GRAZING_RESPONSE.peakLinearIrradiance,
    );
    expect(overdriven.irradiance).toBeLessThanOrEqual(40);
    expect(rest.range).toBe(WHEEL_GRAZING_RESPONSE.rangeMm * PX_PER_MM);
    expect(rest.innerConeCos).toBeGreaterThan(rest.outerConeCos);
    expect(WHEEL_GRAZING_RESPONSE.outerConeDeg).toBeLessThan(45);
    expect(WHEEL_GRAZING_RESPONSE.normalSlopeStartDeg).toBeGreaterThan(0);
    expect(WHEEL_GRAZING_RESPONSE.normalSlopeFullDeg).toBeLessThan(1);
  });

  test("every optical output is spatially gated and material-BRDF evaluated", () => {
    const uniforms: Record<string, { value: unknown }> = {};
    const baselineFragmentShader =
      "#include <common>\nvoid main() {\n#include <lights_fragment_begin>\n}";
    const shader = {
      uniforms,
      vertexShader:
        "#include <common>\nvoid main() {\n#include <project_vertex>\n}",
      fragmentShader: baselineFragmentShader,
    };
    const response = new WheelGrazingResponse();
    response.install(shader);

    expect(numberUniform(shader.uniforms, "webpodWheelGrazingIrradiance")).toBe(
      0,
    );
    response.update(sampleAt(90));
    expect(numberUniform(shader.uniforms, "webpodWheelGrazingIrradiance")).toBe(
      WHEEL_GRAZING_RESPONSE.peakLinearIrradiance,
    );
    response.clear();
    expect(numberUniform(shader.uniforms, "webpodWheelGrazingIrradiance")).toBe(
      0,
    );
    expect(shader.fragmentShader).not.toContain("RE_Direct(");
    expect(shader.fragmentShader).not.toContain("directDiffuse");
    expect(shader.fragmentShader).toContain(
      "reflectedLight.directSpecular += webpodWheelIncidentIrradiance * BRDF_GGX_Multiscatter( webpodWheelLightDirection, geometryViewDir, geometryNormal, material );",
    );
    expect(shader.fragmentShader).toContain(
      "clearcoatSpecularDirect += webpodWheelClearcoatIrradiance * BRDF_GGX_Clearcoat( webpodWheelLightDirection, geometryViewDir, geometryClearcoatNormal, material );",
    );
    // Load-bearing against the reviewer's exact broad-front-light plant: a
    // plain geometryNormal term no longer satisfies this assertion.
    expect(shader.fragmentShader).toContain(
      "length( geometryNormal - webpodWheelRestNormal )",
    );
    expect(shader.fragmentShader).toContain("webpodWheelNormalRim");
    expect(shader.fragmentShader).toContain(
      "webpodWheelCone * webpodWheelRangeWindow * webpodWheelRangeWindow * webpodWheelNormalRim",
    );
    expect(() =>
      assertWheelGrazingShaderStructure(
        shader.fragmentShader,
        baselineFragmentShader,
      ),
    ).not.toThrow();
    expect(shader.fragmentShader).not.toMatch(
      /cameraPosition|vUv|webpod.*(?:Time|Random)|frontFacing/i,
    );
    expect(shader.vertexShader).toContain("modelViewMatrix");
    expect(shader.vertexShader).toContain(
      `attribute vec3 ${WHEEL_REST_NORMAL_ATTRIBUTE}`,
    );
  });

  test("fails closed on any raw or incompletely-gated optical addition", () => {
    const baselineFragmentShader =
      "#include <common>\nvoid main() {\n#include <lights_fragment_begin>\n}";
    const shader = {
      uniforms: {},
      vertexShader:
        "#include <common>\nvoid main() {\n#include <project_vertex>\n}",
      fragmentShader: baselineFragmentShader,
    };
    patchWheelGrazingShader(shader);

    const plants = [
      shader.fragmentShader.replace(
        "// webpod-wheel-material-specular-end",
        "reflectedLight.directSpecular += webpodWheelGrazingColor * webpodWheelGrazingIrradiance;\n// webpod-wheel-material-specular-end",
      ),
      shader.fragmentShader.replace(
        "// webpod-wheel-material-specular-end",
        "reflectedLight.directSpecular.rgb += webpodWheelGrazingColor * webpodWheelGrazingIrradiance;\n// webpod-wheel-material-specular-end",
      ),
      shader.fragmentShader.replace(
        "// webpod-wheel-material-specular-end",
        "clearcoatSpecularDirect.zyx += webpodWheelGrazingColor.rgb;\n// webpod-wheel-material-specular-end",
      ),
      shader.fragmentShader.replace(
        "// webpod-wheel-material-specular-end",
        "totalEmissiveRadiance.pts += webpodWheelGrazingColor.stp;\n// webpod-wheel-material-specular-end",
      ),
      shader.fragmentShader.replace(
        "webpodWheelCone * webpodWheelRangeWindow * webpodWheelRangeWindow * webpodWheelNormalRim",
        "webpodWheelRangeWindow * webpodWheelRangeWindow * webpodWheelNormalRim",
      ),
      shader.fragmentShader.replace(
        "webpodWheelCone * webpodWheelRangeWindow * webpodWheelRangeWindow * webpodWheelNormalRim",
        "webpodWheelCone * webpodWheelNormalRim",
      ),
      shader.fragmentShader.replace(
        "webpodWheelCone * webpodWheelRangeWindow * webpodWheelRangeWindow * webpodWheelNormalRim",
        "webpodWheelCone * webpodWheelRangeWindow * webpodWheelRangeWindow",
      ),
      shader.fragmentShader.replace(
        " * BRDF_GGX_Multiscatter( webpodWheelLightDirection, geometryViewDir, geometryNormal, material )",
        "",
      ),
      shader.fragmentShader.replace(
        " * BRDF_GGX_Clearcoat( webpodWheelLightDirection, geometryViewDir, geometryClearcoatNormal, material )",
        "",
      ),
      shader.fragmentShader.replace(
        "float webpodWheelDotNL = saturate( dot( geometryNormal, webpodWheelLightDirection ) );",
        "float webpodWheelDotNL = 1.0;",
      ),
      shader.fragmentShader.replace(
        "float webpodWheelDotNLcc = saturate( dot( geometryClearcoatNormal, webpodWheelLightDirection ) );",
        "float webpodWheelDotNLcc = 1.0;",
      ),
      shader.fragmentShader.replace(
        "// webpod-wheel-material-specular-end",
        "totalEmissiveRadiance += webpodWheelGrazingColor;\n// webpod-wheel-material-specular-end",
      ),
    ];

    for (const plant of plants) {
      expect(() =>
        assertWheelGrazingShaderStructure(plant, baselineFragmentShader),
      ).toThrow(
        "wheel grazing response must be fully gated and material-BRDF evaluated",
      );
    }
  });

  test("black and white evaluate through their distinct physical finishes", () => {
    const black = createWheelGrazingMaterial(
      DEFAULT_WHEEL_COLOURWAYS.black.ring,
      null,
      new WheelGrazingResponse(),
    );
    const white = createWheelGrazingMaterial(
      DEFAULT_WHEEL_COLOURWAYS.white.ring,
      null,
      new WheelGrazingResponse(),
    );

    expect(black.roughness).toBe(0.44);
    expect(white.roughness).toBe(0.8);
    expect(black.clearcoat).toBe(0.08);
    expect(white.clearcoat).toBe(0.035);
    expect(black.roughness).not.toBe(white.roughness);
    expect(black.clearcoat).not.toBe(white.clearcoat);
    expect(ShaderChunk.lights_physical_pars_fragment).toContain(
      "vec3 BRDF_GGX_Multiscatter",
    );
    expect(ShaderChunk.lights_physical_pars_fragment).toContain(
      "vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );",
    );
    expect(ShaderChunk.lights_physical_pars_fragment).toContain(
      "float roughness = material.roughness;",
    );

    black.dispose();
    white.dispose();
  });

  test("fails closed if Three removes either physical shader seam", () => {
    for (const [vertexShader, fragmentShader] of [
      ["void main() {}", "void main() {}"],
      [
        "#include <common>\nvoid main() {}",
        "#include <common>\n#include <lights_fragment_begin>",
      ],
      [
        "#include <common>\n#include <project_vertex>",
        "#include <common>\nvoid main() {}",
      ],
    ]) {
      expect(() =>
        patchWheelGrazingShader({
          uniforms: {},
          vertexShader: vertexShader ?? "",
          fragmentShader: fragmentShader ?? "",
        }),
      ).toThrow(
        "Three physical shader changed; wheel grazing response was not installed",
      );
    }
  });

  test("production binds the response to the wheel and nowhere else", async () => {
    const device = await Bun.file(
      new URL("./Device.tsx", import.meta.url),
    ).text();
    const scope = await Bun.file(
      new URL("./ControlPhysicsScope.tsx", import.meta.url),
    ).text();
    const readability = await Bun.file(
      new URL("./wheel-readability.ts", import.meta.url),
    ).text();

    expect(device).toContain(
      "ringGeometry,\n        wheelGrazingResponse,\n        wheelRestSurface,\n        wheelGapGeometry,",
    );
    expect(device.match(/createWheelGrazingMaterial\(/g)).toHaveLength(1);
    expect(device).not.toContain("attachSelect(selectGeometry, wheelGrazingResponse)");
    expect(scope).not.toMatch(/useFrame\(|setInterval\(/);
    expect(readability).not.toMatch(
      /useFrame\(|requestAnimationFrame\(|setInterval\(/,
    );
  });
});
