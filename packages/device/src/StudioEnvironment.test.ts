import { expect, test } from "bun:test";

import { DEFAULT_DEVICE_MATERIALS } from "./materials";
import {
  DEFAULT_STUDIO_ENVIRONMENT,
  effectiveStudioEnvironmentIntensity,
} from "./StudioEnvironment";

test("studio lighting is a PMREM RoomEnvironment and contains no view-locked shading hook", async () => {
  const source = await Bun.file(new URL("./StudioEnvironment.tsx", import.meta.url)).text();
  expect(source).toContain("new RoomEnvironment()");
  expect(source).toContain("new PMREMGenerator(gl)");
  expect(source).toContain("generator.fromScene(room, sigma)");
  expect(source).toContain("target.dispose()");
  expect(source).not.toMatch(/camera(?:Position|Direction)|viewMatrix|vUv|outgoingLight\s*\+=/);
  expect(DEFAULT_STUDIO_ENVIRONMENT).toEqual({ sigma: 0.04, intensity: 0.2 });
  expect(DEFAULT_STUDIO_ENVIRONMENT.intensity).toBeLessThan(0.25);
});

test("the striped calibration map belongs only to the mirror-steel rear", async () => {
  const source = await Bun.file(new URL("./Device.tsx", import.meta.url)).text();
  const canvasSource = await Bun.file(
    new URL("./DeviceCanvas.tsx", import.meta.url),
  ).text();
  expect(source.match(/envMap=\{env\}/g)).toHaveLength(1);
  expect(source).toMatch(/name="steel-back"[\s\S]*?envMap=\{env\}/);
  expect(source).toContain("useStudioEnvironmentSnapshot()");
  expect(source).toContain("envMap: studio.texture");
  expect(source).toContain("effectiveStudioEnvironmentIntensity(");
  expect(source).toContain("const env = envMap ?? builtEnv");
  expect(canvasSource).not.toContain("resolvedEnvMap");
});

test("front materials explicitly retain per-surface gain under installed Three", async () => {
  const rendererSource = await Bun.file(
    new URL("../node_modules/three/src/renderers/WebGLRenderer.js", import.meta.url),
  ).text();
  expect(rendererSource).toContain(
    "material.envMap === null && scene.environment !== null",
  );
  expect(rendererSource).toContain(
    "m_uniforms.envMapIntensity.value = scene.environmentIntensity",
  );

  const room = DEFAULT_STUDIO_ENVIRONMENT.intensity;
  expect(
    effectiveStudioEnvironmentIntensity(
      DEFAULT_DEVICE_MATERIALS.bodyBlack.envMapIntensity,
      room,
    ),
  ).toBeCloseTo(0.008, 12);
  expect(
    effectiveStudioEnvironmentIntensity(
      DEFAULT_DEVICE_MATERIALS.bodyWhite.envMapIntensity,
      room,
    ),
  ).toBeCloseTo(0.0024, 12);
  expect(
    effectiveStudioEnvironmentIntensity(
      DEFAULT_DEVICE_MATERIALS.coverGlass.envMapIntensity,
      room,
    ),
  ).toBeCloseTo(0.16, 12);
  expect(effectiveStudioEnvironmentIntensity(undefined, room)).toBe(room);
});
