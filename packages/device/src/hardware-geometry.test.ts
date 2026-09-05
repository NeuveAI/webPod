import { describe, expect, test } from "bun:test";
import { Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { createHardwareGeometry } from "./hardware-geometry";
import { cutHardwareApertures } from "./hardware-apertures";
import { createRearShellGeometry } from "./product-shell";
import { DEFAULT_DEVICE_FORM } from "./form";
import { DEVICE_LAYOUT, PX_PER_MM } from "./layout";
import { DEVICE_DOCK_CONNECTOR, DEVICE_TOP_CONTROLS } from "./top-controls";
import { completeDeviceEnvelope } from "./device-envelope";

function rearShell() {
  const body = DEVICE_LAYOUT.body;
  return createRearShellGeometry({ ...body, frontThickness: DEFAULT_DEVICE_FORM.frontThickness,
    frontRimInset: DEFAULT_DEVICE_FORM.seamWidth + DEFAULT_DEVICE_FORM.frontBevel + 0.25,
    rearCrownInset: DEFAULT_DEVICE_FORM.rearCrownInset });
}

describe("recessed 5G hardware", () => {
  test("has a 3.5mm bore, thirty individual contacts and all parts inside the physical envelope", () => {
    expect(DEVICE_TOP_CONTROLS.jack.boreRadius * 2 / PX_PER_MM).toBeCloseTo(3.5, 8);
    const parts = createHardwareGeometry(DEFAULT_DEVICE_FORM);
    expect(parts.filter((p) => /^device-dock-contact-\d+$/.test(p.name))).toHaveLength(30);
    const envelope = completeDeviceEnvelope();
    for (const part of parts) {
      const position = part.geometry.getAttribute("position");
      const normal = part.geometry.getAttribute("normal");
      const bounds = part.geometry.boundingBox;
      expect(bounds).not.toBeNull();
      if (bounds === null) throw new Error("Hardware bounds missing");
      for (let axis = 0; axis < 3; axis++) {
        expect(bounds.min.getComponent(axis)).toBeGreaterThanOrEqual((envelope.min[axis] ?? 0) - 0.001);
        expect(bounds.max.getComponent(axis)).toBeLessThanOrEqual((envelope.max[axis] ?? 0) + 0.001);
      }
      for (let i = 0; i < position.count; i++) {
        expect(Number.isFinite(position.getX(i) + position.getY(i) + position.getZ(i))).toBe(true);
        expect(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i))).toBeCloseTo(1, 4);
      }
      part.geometry.dispose();
    }
  });

  test("shell openings actually expose inward cavities while adjacent steel remains opaque", () => {
    const source = rearShell();
    const opened = cutHardwareApertures(source);
    const material = new MeshBasicMaterial();
    const shell = new Mesh(opened, material);
    shell.updateMatrixWorld();
    const { jack, hold } = DEVICE_TOP_CONTROLS;
    const dock = DEVICE_DOCK_CONNECTOR;
    for (const [x, z, side] of [[jack.x, jack.z, 1], [hold.x, hold.z, 1], [dock.x, dock.z - 3, -1]] as const) {
      const ray = new Raycaster(new Vector3(x, side * 400, z), new Vector3(0, -side, 0));
      const hits = ray.intersectObject(shell);
      expect(hits.some((hit) => side * hit.point.y > 250)).toBe(false);
    }
    const intact = new Raycaster(new Vector3(0, 400, 0), new Vector3(0, -1, 0)).intersectObject(shell);
    expect(intact[0]?.point.y).toBeGreaterThan(270);
    // The steel return closes the previously open gap behind the front bevel.
    const seamZ = DEVICE_LAYOUT.body.depth / 2 - DEFAULT_DEVICE_FORM.frontThickness;
    for (const x of [-60, 0, 60]) for (const side of [-1, 1]) {
      const y = side * (DEVICE_LAYOUT.body.height / 2 - DEFAULT_DEVICE_FORM.seamWidth / 2);
      const hits = new Raycaster(new Vector3(x, y, seamZ + 5), new Vector3(0, 0, -1)).intersectObject(shell);
      expect(hits[0]?.point.z).toBeCloseTo(seamZ, 5);
    }
    const parts = createHardwareGeometry(DEFAULT_DEVICE_FORM);
    const well = parts.find((p) => p.name === "device-headphone-well");
    if (well === undefined) throw new Error("Jack floor missing");
    const mesh = new Mesh(well.geometry, material);
    mesh.updateMatrixWorld();
    const bore = new Raycaster(new Vector3(jack.x, 400, jack.z), new Vector3(0, -1, 0)).intersectObject(mesh);
    expect(bore[0]?.point.y).toBeLessThan(DEVICE_LAYOUT.body.height / 2 - 10);
    const tongue = parts.find((p) => p.name === "device-dock-tongue");
    if (tongue?.geometry.boundingBox == null) throw new Error("Dock tongue missing");
    expect(tongue.geometry.boundingBox.min.y).toBeGreaterThan(-DEVICE_LAYOUT.body.height / 2 + 2);
    for (const part of parts) part.geometry.dispose();
    source.dispose(); opened.dispose(); material.dispose();
  });
});
