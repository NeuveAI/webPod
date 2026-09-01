import { expect, test } from "bun:test";

import { DEFAULT_STUDIO_ENVIRONMENT } from "./StudioEnvironment";

test("studio lighting is a PMREM RoomEnvironment and contains no view-locked shading hook", async () => {
  const source = await Bun.file(new URL("./StudioEnvironment.tsx", import.meta.url)).text();
  expect(source).toContain("new RoomEnvironment()")
  expect(source).toContain("new PMREMGenerator(gl)")
  expect(source).toContain("generator.fromScene(room, sigma)")
  expect(source).toContain("target.dispose()")
  expect(source).not.toMatch(/camera(?:Position|Direction)|viewMatrix|vUv|outgoingLight\s*\+=/)
  expect(DEFAULT_STUDIO_ENVIRONMENT).toEqual({ sigma: 0.04, intensity: 0.34 });
  expect(DEFAULT_STUDIO_ENVIRONMENT.intensity).toBeLessThan(0.5);
});
