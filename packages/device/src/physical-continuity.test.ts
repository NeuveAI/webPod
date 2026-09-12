import { expect, test } from "bun:test";

test("the live device is solid geometry rather than a front-pose lighting proxy", async () => {
  const [device, shader, hardware, shells] = await Promise.all([
    Bun.file(new URL("./Device.tsx", import.meta.url)).text(),
    Bun.file(new URL("./physical-materials.ts", import.meta.url)).text(),
    Bun.file(new URL("./hardware-geometry.ts", import.meta.url)).text(),
    Bun.file(new URL("./immutable-shells.ts", import.meta.url)).text(),
  ]);

  expect(shells).toContain("tessellateVerticalCrown");
  expect(device).toContain("createDeviceAssemblyRecipe(form,prepared.hardware)");
  const recipe = await Bun.file('packages/device/src/device-assembly-recipe.ts').text();
  expect(recipe).toContain("name: 'device-hardware'");
  expect(shells).toContain("yield* cutHardwareAperturesSteps(shell)");
  expect(hardware).toContain("new ExtrudeGeometry");
  expect(hardware).toContain('"device-hold-slider"');
  expect(hardware).toContain('"device-headphone-well"');
  expect(device).not.toContain('from "./optical-profile"');
  expect(device).not.toContain("createOpticalNormalMap");
  expect(device).not.toContain("normalMap=");

  for (const source of [device, shader, hardware, shells]) {
    expect(source).not.toMatch(/\bvUv\b|cameraPosition|viewMatrix/);
    expect(source).not.toMatch(/outgoingLight\s*\+=|totalEmissiveRadiance\s*\+=/);
  }
});
