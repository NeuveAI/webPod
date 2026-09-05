import { expect, test } from "bun:test";
import { BACKPLATE_ENGRAVING, BACKPLATE_FINISH, backplateRoughnessAt, createBackplateFinishMaps } from "./backplate-finish";
import { DEVICE_LAYOUT } from "./layout";

test("the rear face stays softly polished while the roll has a narrower specular response", () => {
  const { width, height } = DEVICE_LAYOUT.body;
  expect(backplateRoughnessAt(0, 0)).toBe(BACKPLATE_FINISH.faceRoughness);
  expect(backplateRoughnessAt(width / 2, 0)).toBe(BACKPLATE_FINISH.edgeRoughness);
  expect(backplateRoughnessAt(0, height / 2)).toBe(BACKPLATE_FINISH.edgeRoughness);
  let previous = 0;
  for (let inset = 0; inset <= 24; inset += 0.25) {
    const roughness = backplateRoughnessAt(width / 2 - inset, 0);
    expect(roughness).toBeGreaterThanOrEqual(previous);
    expect(roughness).toBeLessThanOrEqual(BACKPLATE_FINISH.faceRoughness);
    expect(backplateRoughnessAt(-width / 2 + inset, 0)).toBe(roughness);
    previous = roughness;
  }
  expect(BACKPLATE_FINISH.etchedRoughness).toBeGreaterThan(BACKPLATE_FINISH.faceRoughness);
  expect(BACKPLATE_FINISH.bumpDepth).toBeLessThan(0.025);
});

test("engraving is generated only as shell roughness and depressed bump, with SSR fallback", async () => {
  expect(createBackplateFinishMaps()).toBeNull();
  expect(BACKPLATE_ENGRAVING).toEqual({ name: "WebPod", badge: "CLASSIC", detail: "DESIGNED FOR MUSIC" });
  const source = await Bun.file(new URL("./backplate-finish.ts", import.meta.url)).text();
  expect(source).not.toMatch(/emissive|MeshBasicMaterial|side:|SRGBColorSpace/);
  expect(source).toContain('engrave(bumpContext, "#000000")');
  expect(source).toContain('bumpContext.fillStyle = "#FFFFFF"');
  expect(source).toContain("roughnessMap.dispose(); bumpMap.dispose()");
  const device = await Bun.file(new URL("./Device.tsx", import.meta.url)).text();
  const steel = device.slice(device.indexOf('name="device-steel-back"'), device.indexOf('name="device-display-mask"'));
  expect(steel).toContain("bumpMap: backplateFinish.bumpMap");
  expect(device).toContain("backplateFinish?.dispose()");
});


test("actual rear tray UVs preserve rear-local XY through hardware aperture cutting", async () => {
  const { createRearShellGeometry } = await import("./product-shell");
  const { cutHardwareApertures } = await import("./hardware-apertures");
  const { DEFAULT_DEVICE_FORM } = await import("./form");
  const body = DEVICE_LAYOUT.body;
  const source = createRearShellGeometry({ ...body,
    frontThickness: DEFAULT_DEVICE_FORM.frontThickness,
    rearCrownInset: DEFAULT_DEVICE_FORM.rearCrownInset,
  });
  const shell = cutHardwareApertures(source);
  const position = shell.getAttribute("position");
  const uv = shell.getAttribute("uv");
  for (let i = 0; i < position.count; i++) {
    expect(uv.getX(i)).toBeCloseTo(position.getX(i) / body.width + 0.5, 6);
    expect(uv.getY(i)).toBeCloseTo(position.getY(i) / body.height + 0.5, 6);
  }
  source.dispose(); shell.dispose();
});
