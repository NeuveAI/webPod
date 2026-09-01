import { describe, expect, test } from "bun:test";
import { Vector3 } from "three";

import {
  CONTROL_TRAVEL,
  WHEEL_REST_NORMAL_ATTRIBUTE,
  type WheelReadabilitySample,
} from "./control-physics";
import { DEVICE_LAYOUT, PX_PER_MM } from "./layout";
import {
  patchWheelGrazingShader,
  WHEEL_GRAZING_RESPONSE,
  WheelGrazingResponse,
  wheelGrazingPose,
} from "./wheel-readability";

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
      tangentOffsetMm: 7.5,
      surfaceLiftMm: 1.2,
      rangeMm: 16,
      innerConeDeg: 20,
      outerConeDeg: 42,
      normalSlopeStartDeg: 1,
      normalSlopeFullDeg: 1.35,
      peakLinearIrradiance: 0.06,
      color: "#FFF9F2",
    });
    expect(CONTROL_TRAVEL.wheelMm).toBe(0.08);
  });

  test("the low grazing source follows all four contact angles in model space", () => {
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

      expect(source.distanceTo(point) / PX_PER_MM).toBeCloseTo(
        expectedDistanceMm,
        8,
      );
      expect(grazingAngleDeg).toBeLessThan(10);
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
    expect(overdriven.irradiance).toBeLessThan(0.25);
    expect(rest.range).toBe(WHEEL_GRAZING_RESPONSE.rangeMm * PX_PER_MM);
    expect(rest.innerConeCos).toBeGreaterThan(rest.outerConeCos);
    expect(WHEEL_GRAZING_RESPONSE.outerConeDeg).toBeLessThan(45);
    expect(WHEEL_GRAZING_RESPONSE.normalSlopeStartDeg).toBeGreaterThan(0);
    expect(WHEEL_GRAZING_RESPONSE.normalSlopeFullDeg).toBeLessThan(1.5);
  });

  test("the wheel-only physical shader has no UV, camera, or time-locked proxy", () => {
    const uniforms: Record<string, { value: unknown }> = {};
    const shader = {
      uniforms,
      vertexShader:
        "#include <common>\nvoid main() {\n#include <project_vertex>\n}",
      fragmentShader:
        "#include <common>\nvoid main() {\n#include <lights_fragment_begin>\n}",
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
    expect(shader.fragmentShader).toContain("RE_Direct(");
    expect(shader.fragmentShader).toContain("geometryNormal");
    expect(shader.fragmentShader).toContain("webpodWheelNormalRim");
    expect(shader.fragmentShader).not.toContain("directDiffuse");
    expect(shader.fragmentShader).not.toMatch(
      /cameraPosition|vUv|webpod.*(?:Time|Random)|frontFacing/i,
    );
    expect(shader.vertexShader).toContain("modelViewMatrix");
    expect(shader.vertexShader).toContain(
      `attribute vec3 ${WHEEL_REST_NORMAL_ATTRIBUTE}`,
    );
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
      "controlPhysics?.attachWheel(ringGeometry, wheelGrazingResponse)",
    );
    expect(device.match(/createWheelGrazingMaterial\(/g)).toHaveLength(1);
    expect(device).not.toContain("attachSelect(selectGeometry, wheelGrazingResponse)");
    expect(scope).not.toMatch(/useFrame\(|setInterval\(/);
    expect(readability).not.toMatch(
      /useFrame\(|requestAnimationFrame\(|setInterval\(/,
    );
  });
});
