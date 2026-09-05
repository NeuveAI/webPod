import { expect, test } from "bun:test";

test("the live device is solid geometry rather than a front-pose lighting proxy", async () => {
  const [device, shader, hardware] = await Promise.all([
    Bun.file(new URL("./Device.tsx", import.meta.url)).text(),
    Bun.file(new URL("./physical-materials.ts", import.meta.url)).text(),
    Bun.file(new URL("./hardware-geometry.ts", import.meta.url)).text(),
  ]);

  expect(device).toContain("tessellateVerticalCrown");
  expect(device).toContain("DeviceHardware");
  expect(device).toContain("cutHardwareApertures(shell)");
  expect(hardware).toContain("new ExtrudeGeometry");
  expect(hardware).toContain('"device-hold-slider"');
  expect(hardware).toContain('"device-headphone-well"');
  expect(device).not.toContain('from "./optical-profile"');
  expect(device).not.toContain("createOpticalNormalMap");
  expect(device).not.toContain("normalMap=");

  for (const source of [device, shader, hardware]) {
    expect(source).not.toMatch(/\bvUv\b|cameraPosition|viewMatrix/);
    expect(source).not.toMatch(/outgoingLight\s*\+=|totalEmissiveRadiance\s*\+=/);
  }
});
