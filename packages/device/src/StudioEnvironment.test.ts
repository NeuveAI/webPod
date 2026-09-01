import { expect, test } from "bun:test";

import { DEFAULT_STUDIO_ENVIRONMENT } from "./StudioEnvironment";

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
  expect(source.match(/envMap=\{env\}/g)).toHaveLength(1);
  expect(source).toMatch(/name="steel-back"[\s\S]*?envMap=\{env\}/);
  expect(source).toContain("createBlackPolycarbonateMaterial(materials.bodyBlack, null)");
  expect(source).toContain("createPolycarbonateMaterial(materials.bodyWhite, null)");
  expect(source).toContain("createCoverGlassMaterial(materials.coverGlass, null)");
});
