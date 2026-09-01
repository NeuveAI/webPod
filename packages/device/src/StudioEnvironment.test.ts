import { expect, test } from "bun:test";

test("studio lighting is a PMREM RoomEnvironment and contains no view-locked shading hook", async () => {
  const source = await Bun.file(new URL("./StudioEnvironment.tsx", import.meta.url)).text();
  expect(source).toContain("new RoomEnvironment()")
  expect(source).toContain("new PMREMGenerator(gl)")
  expect(source).toContain("generator.fromScene(room, sigma)")
  expect(source).toContain("target.dispose()")
  expect(source).not.toMatch(/camera(?:Position|Direction)|viewMatrix|vUv|outgoingLight\s*\+=/)
});
