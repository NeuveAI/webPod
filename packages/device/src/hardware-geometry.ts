import { ExtrudeGeometry, Shape, type BufferGeometry } from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { circleHole, roundedRectHole, roundedRectShape } from "./shapes";
import type { DeviceFormParams } from "./form";
import { DEVICE_DOCK_CONNECTOR, DEVICE_TOP_CONTROLS, hardwareSurfaceY } from "./top-controls";

export type HardwareMaterial = "metal" | "slider" | "insulator" | "cavity" | "orange" | "contact";
export type HardwarePart = { readonly name: string; readonly geometry: BufferGeometry; readonly material: HardwareMaterial };

function disc(radius: number): Shape {
  const shape = new Shape();
  shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
  return shape;
}
function roundFrame(width: number, depth: number, radius: number, innerWidth: number, innerDepth: number, innerRadius: number): Shape {
  const shape = roundedRectShape(width, depth, radius, 12);
  shape.holes.push(roundedRectHole(0, 0, innerWidth, innerDepth, innerRadius, 12));
  return shape;
}

/** Caller owns every generated geometry. Shapes sit on the actual curved steel
 * wall and extend inward; their reveal stays open under oblique rotation. */
export function createHardwareGeometry(form: DeviceFormParams): readonly HardwarePart[] {
  const parts: HardwarePart[] = [];
  const add = (name: string, shape: Shape, x: number, z: number, side: 1 | -1,
    floor: number, ceiling: number, material: HardwareMaterial) => {
    const geometry = new ExtrudeGeometry(shape, { depth: ceiling - floor, bevelEnabled: false, curveSegments: 64 });
    geometry.translate(0, 0, floor);
    const position = geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
      const localZ = z - side * position.getY(i);
      position.setXYZ(i, x + position.getX(i), side * (hardwareSurfaceY(localZ, form) + position.getZ(i)), localZ);
    }
    geometry.computeVertexNormals();
    toCreasedNormals(geometry, Math.PI / 4);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    parts.push({ name, geometry, material });
  };
  const { hold, jack } = DEVICE_TOP_CONTROLS;
  // A stamped slot with a pill-shaped sliding insert. Orange occupies only
  // the exposed travel end, as in the original 5G repair photographs.
  add("device-hold-collar", roundFrame(hold.width, hold.depth, hold.radius,
    hold.width - 2, hold.depth - 2, hold.radius - 1), hold.x, hold.z, 1, -1.5, 0.2, "metal");
  add("device-hold-recess", roundedRectShape(hold.width - 1, hold.depth - 1, hold.radius - 0.5),
    hold.x, hold.z, 1, -hold.cavityDepth, -hold.cavityDepth + 0.5, "cavity");
  add("device-hold-slot-wall", roundFrame(hold.width - 1, hold.depth - 1, hold.radius - 0.5,
    hold.width - 3, hold.depth - 3, hold.radius - 1.5), hold.x, hold.z, 1, -hold.cavityDepth, -0.5, "insulator");
  add("device-hold-indicator", roundedRectShape(hold.width - 3, hold.depth - 3, hold.radius - 1.5),
    hold.x, hold.z, 1, -1.5, -1.1, "orange");
  add("device-hold-slider", roundedRectShape(hold.sliderWidth, hold.sliderDepth, hold.sliderDepth / 2, 16),
    hold.x + hold.sliderOffset, hold.z, 1, -1, 0.65, "slider");

  const collar = disc(jack.outerRadius);
  collar.holes.push(circleHole(0, 0, jack.boreRadius, 64));
  add("device-headphone-rim", collar, jack.x, jack.z, 1, -0.65, 0.35, "metal");
  const barrel = disc(jack.boreRadius + 0.4);
  barrel.holes.push(circleHole(0, 0, jack.boreRadius - 0.65, 64));
  add("device-headphone-barrel", barrel, jack.x, jack.z, 1, -jack.cavityDepth, -0.55, "insulator");
  add("device-headphone-well", disc(jack.boreRadius), jack.x, jack.z, 1, -jack.cavityDepth - 0.4, -jack.cavityDepth, "cavity");
  // Three restrained spring-contact lands visible down the barrel.
  for (const [i, angle] of [0.2, 2.3, 4.4].entries()) {
    add(`device-headphone-contact-${i}`, roundedRectShape(1.5, 2.8, 0.5),
      jack.x + (jack.boreRadius - 1.2) * Math.cos(angle),
      jack.z + (jack.boreRadius - 1.2) * Math.sin(angle), 1, -8, -5, "contact");
  }

  const dock = DEVICE_DOCK_CONNECTOR;
  add("device-dock-collar", roundFrame(dock.width, dock.depth, dock.radius,
    dock.innerWidth, dock.innerDepth, dock.innerRadius), dock.x, dock.z, -1, -1.2, 0.1, "metal");
  add("device-dock-reveal", roundFrame(dock.innerWidth + 0.8, dock.innerDepth + 0.8, dock.innerRadius + 0.4,
    dock.innerWidth - 1, dock.innerDepth - 1, dock.innerRadius - 0.5), dock.x, dock.z, -1, -dock.cavityDepth, -0.4, "insulator");
  add("device-dock-well", roundedRectShape(dock.innerWidth, dock.innerDepth, dock.innerRadius),
    dock.x, dock.z, -1, -dock.cavityDepth - 0.5, -dock.cavityDepth, "cavity");
  // The connector is a receptacle: a thin insulating tongue sits inside the
  // dark opening, with all thirty gold contact lands beneath the outer lip.
  add("device-dock-tongue", roundedRectShape(dock.tongueWidth, dock.tongueDepth, 0.8),
    dock.x, dock.z + 1.8, -1, -dock.cavityDepth, -3, "slider");
  for (let i = 0; i < dock.contactCount; i++) {
    add(`device-dock-contact-${i + 1}`, roundedRectShape(1.35, 2.1, 0.3),
      dock.x + (i - (dock.contactCount - 1) / 2) * dock.contactPitch,
      dock.z + 1.1, -1, -3.1, -2.8, "contact");
  }
  for (const side of [-1, 1]) {
    add(`device-dock-key-${side}`, roundedRectShape(2, 7, 0.4),
      side * (dock.innerWidth / 2 - 2), dock.z, -1, -8, -2, "metal");
  }
  return parts;
}
