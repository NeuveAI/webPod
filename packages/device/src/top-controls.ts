import { DEFAULT_DEVICE_FORM, type DeviceFormParams } from "./form";
import { DEVICE_LAYOUT, PX_PER_MM } from "./layout";
import { productShellDepths, rearRollInsetAt } from "./product-shell";

/** Photo-derived 5G proportions, with the standard 3.5mm bore as a scale anchor.
 * iFixit 5th Generation Video guide 604 steps 1–2 shows a flush pill slider,
 * small orange travel indicator, thin jack collar and wide dock opening.
 * These are visual modeling dimensions, not a claim of factory CAD accuracy. */
export const DEVICE_TOP_CONTROLS = Object.freeze({
  hold: Object.freeze({ x: -94, z: 0, width: 64, depth: 17, radius: 8.5,
    sliderWidth: 51, sliderDepth: 14, sliderOffset: -4.5, cavityDepth: 5 }),
  jack: Object.freeze({ x: 120, z: 0, boreRadius: 3.5 * PX_PER_MM / 2,
    outerRadius: 11.1, cavityDepth: 15 }),
});
export const DEVICE_DOCK_CONNECTOR = Object.freeze({
  x: 0, z: 2, width: 132, depth: 20, radius: 4,
  innerWidth: 125, innerDepth: 14.5, innerRadius: 2.2,
  cavityDepth: 13, tongueWidth: 115, tongueDepth: 3.5,
  contactCount: 30, contactPitch: 3.65,
});

/** Height magnitude of the steel's straight top/bottom wall at local Z. */
export function hardwareSurfaceY(z: number, form: DeviceFormParams): number {
  const { body } = DEVICE_LAYOUT;
  const { seamZ, rearFaceZ } = productShellDepths(body.depth, form.frontThickness);
  const t = Math.min(1, Math.max(0, (z - rearFaceZ) / (seamZ - rearFaceZ)));
  return body.height / 2 - rearRollInsetAt(t, form.rearCrownInset);
}

export type DeviceTopControlBounds = {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
};

/** Conservative complete top hardware bounds. */
export function deviceTopControlBounds(form = DEFAULT_DEVICE_FORM): DeviceTopControlBounds {
  const { hold, jack } = DEVICE_TOP_CONTROLS;
  return Object.freeze({
    min: Object.freeze([
      hold.x - hold.width / 2,
      hardwareSurfaceY(-jack.outerRadius, form) - jack.cavityDepth,
      -jack.outerRadius,
    ] as const),
    max: Object.freeze([
      jack.x + jack.outerRadius,
      Math.max(hardwareSurfaceY(hold.depth / 2, form) + 0.65,
        hardwareSurfaceY(jack.outerRadius, form) + 0.35),
      jack.outerRadius,
    ] as const),
  });
}
export const DEFAULT_DEVICE_TOP_CONTROL_BOUNDS = deviceTopControlBounds();

/** Include the dock collar's small outward lip in the same camera/pivot bounds. */
export function deviceHardwareBounds(form = DEFAULT_DEVICE_FORM): DeviceTopControlBounds {
  const top = deviceTopControlBounds(form);
  const dock = DEVICE_DOCK_CONNECTOR;
  return Object.freeze({
    min: Object.freeze([top.min[0], -(hardwareSurfaceY(dock.z + dock.depth / 2, form) + 0.1),
      Math.min(top.min[2], dock.z - dock.depth / 2)] as const),
    max: Object.freeze([top.max[0], top.max[1], Math.max(top.max[2], dock.z + dock.depth / 2)] as const),
  });
}
