import { expect, test } from "bun:test";

test("the live device is solid geometry rather than a front-pose lighting proxy", async () => {
  const [device, shader] = await Promise.all([
    Bun.file(new URL("./Device.tsx", import.meta.url)).text(),
    Bun.file(new URL("./physical-materials.ts", import.meta.url)).text(),
  ]);

  expect(device).toContain("tessellateVerticalCrown");
  expect(device).toContain("RoundedBoxGeometry");
  expect(device).toContain("TorusGeometry");
  expect(device).toContain('name="device-hold-slider"');
  expect(device).toContain('name="device-headphone-well"');
  expect(device).not.toContain('from "./optical-profile"');
  expect(device).not.toContain("createOpticalNormalMap");
  expect(device).not.toContain("normalMap=");

  for (const source of [device, shader]) {
    expect(source).not.toMatch(/\bvUv\b|cameraPosition|viewMatrix/);
    expect(source).not.toMatch(/outgoingLight\s*\+=|totalEmissiveRadiance\s*\+=/);
  }
});
