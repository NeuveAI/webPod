import { expect, test } from "bun:test";

import { DEFAULT_DEVICE_MATERIALS } from "./materials";
import {
  DEFAULT_STUDIO_ENVIRONMENT,
  effectiveStudioEnvironmentIntensity,
} from "./StudioEnvironment";

test("studio lighting is a PMREM diffusion-card studio and contains no view-locked shading hook", async () => {
  const source = await Bun.file(new URL("./StudioEnvironment.tsx", import.meta.url)).text();
  expect(source).toContain("createProductStudioEnvironment()");
  expect(source).toContain("new PMREMGenerator(gl)");
  expect(source).toContain("generator.fromScene(room.scene, sigma)");
  expect(source).toContain("target.dispose()");
  expect(source).not.toMatch(/camera(?:Position|Direction)|viewMatrix|vUv|outgoingLight\s*\+=/);
  expect(DEFAULT_STUDIO_ENVIRONMENT).toEqual({ sigma: 0.04, intensity: 0.2 });
  expect(DEFAULT_STUDIO_ENVIRONMENT.intensity).toBeLessThan(0.25);
});

test("the legacy calibration map is opt-in while production shares one studio", async () => {
  const source = await Bun.file(new URL("./Device.tsx", import.meta.url)).text();
  const canvasSource = await Bun.file(
    new URL("./DeviceCanvas.tsx", import.meta.url),
  ).text();
  expect(source.match(/envMap=\{env\}/g)).toHaveLength(1);
  expect(source).toMatch(/name="steel-back"[\s\S]*?envMap=\{env\}/);
  expect(source).toContain("useStudioEnvironmentSnapshot()");
  expect(source).toContain("envMap: studio.texture");
  expect(source).toContain("effectiveStudioEnvironmentIntensity(");
  expect(source).toContain("const env = envMap !== undefined ? envMap : builtEnv ?? studio.texture");
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
  ).toBeCloseTo(0.8, 12);
  expect(
    effectiveStudioEnvironmentIntensity(
      DEFAULT_DEVICE_MATERIALS.bodyWhite.envMapIntensity,
      room,
    ),
  ).toBeCloseTo(0.8, 12);
  expect(
    effectiveStudioEnvironmentIntensity(
      DEFAULT_DEVICE_MATERIALS.coverGlass.envMapIntensity,
      room,
    ),
  ).toBeCloseTo(0.16, 12);
  expect(effectiveStudioEnvironmentIntensity(undefined, room)).toBe(room);
});

test("three fixed reflection cards have finite transforms and dispose every owned resource", async () => {
  const { createProductStudioEnvironment } = await import("./product-studio");
  const { Mesh } = await import("three");
  const studio = createProductStudioEnvironment();
  expect(studio.scene.children.map((child) => child.name)).toEqual([
    "key-diffusion", "fill-diffusion", "rim-diffusion",
  ]);
  let disposed = 0;
  for (const child of studio.scene.children) {
    expect(child).toBeInstanceOf(Mesh);
    if (!(child instanceof Mesh)) throw new Error("Expected diffusion card");
    expect([...child.position.toArray(), ...child.quaternion.toArray()].every(Number.isFinite)).toBe(true);
    child.geometry.addEventListener("dispose", () => { disposed += 1; });
    child.material.addEventListener("dispose", () => { disposed += 1; });
  }
  studio.dispose();
  expect(disposed).toBe(6);
  const route = await Bun.file("apps/web/src/routes/[_]spike.device.tsx").text();
  expect(route).toContain("studioEnvironment={undefined}");
  expect(route).not.toContain('lighting === "combined" ? undefined : null');
});
