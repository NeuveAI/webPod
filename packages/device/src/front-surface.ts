import {
  edgeCrownOffset,
  horizontalCrownOffset,
  verticalCrownOffset,
} from "./curved-shell";
import { DEFAULT_DEVICE_FORM, type DeviceFormParams } from "./form";
import { DEVICE_LAYOUT } from "./layout";

const { body, screen, wheel } = DEVICE_LAYOUT;
const INPUT_PLANE_OFFSET = 0.25;
const CIRCLE_SAMPLES = 256;

/** Crown displacement of the physical front shell at one body-local point. */
export function frontShellOffsetAt(
  x: number,
  y: number,
  form: DeviceFormParams = DEFAULT_DEVICE_FORM,
): number {
  const halfWidth = body.width / 2 - form.seamWidth;
  const halfHeight = body.height / 2 - form.seamWidth;
  return (
    horizontalCrownOffset(x, halfWidth, form.bodyCrossCrown) +
    verticalCrownOffset(y, halfHeight, form.bodyCrown) +
    edgeCrownOffset(y, halfHeight, {
      top: form.topEdgeCrown,
      bottom: form.bottomEdgeCrown,
      extent: form.edgeCrownExtent,
    })
  );
}

/** Lowest shell point around a flat rectangular insert's outer boundary. */
export function minimumFrontShellOffsetAroundRect(
  rect: {
    readonly centerX: number;
    readonly centerY: number;
    readonly width: number;
    readonly height: number;
  },
  form: DeviceFormParams = DEFAULT_DEVICE_FORM,
): number {
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;
  return Math.min(
    frontShellOffsetAt(rect.centerX - halfWidth, rect.centerY - halfHeight, form),
    frontShellOffsetAt(rect.centerX + halfWidth, rect.centerY - halfHeight, form),
    frontShellOffsetAt(rect.centerX - halfWidth, rect.centerY + halfHeight, form),
    frontShellOffsetAt(rect.centerX + halfWidth, rect.centerY + halfHeight, form),
  );
}

/**
 * Lowest shell point around a circular insert.
 *
 * The bounded 256-point sweep is deterministic and intentionally shared by
 * production and tests. It keeps a planar wheel below every point on the
 * surrounding crowned opening instead of guessing that one cardinal point is
 * the minimum after future form changes.
 */
export function minimumFrontShellOffsetAroundCircle(
  circle: {
    readonly centerX: number;
    readonly centerY: number;
    readonly radius: number;
  },
  form: DeviceFormParams = DEFAULT_DEVICE_FORM,
): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (let sample = 0; sample < CIRCLE_SAMPLES; sample += 1) {
    const angle = sample / CIRCLE_SAMPLES * Math.PI * 2;
    minimum = Math.min(
      minimum,
      frontShellOffsetAt(
        circle.centerX + Math.cos(angle) * circle.radius,
        circle.centerY + Math.sin(angle) * circle.radius,
        form,
      ),
    );
  }
  return minimum;
}

export type FrontAssemblyDepths = {
  readonly displayReferenceZ: number;
  readonly displayWellFrontZ: number;
  readonly glassFrontZ: number;
  readonly screenFrontZ: number;
  readonly wheelReferenceZ: number;
  readonly wheelWellZ: number;
  readonly ringZ: number;
  readonly ringSag: number;
  readonly ringInnerZ: number;
  readonly selectSag: number;
  readonly selectRimZ: number;
  readonly clickWheelInputZ: number;
};

/**
 * Resolve every front insert from the same physical shell frame.
 *
 * Flat glass and wheel components use the lowest crown point around their
 * opening. They therefore remain recessed everywhere instead of piercing the
 * shell where a global crown is shallower than at the component centre.
 */
export function resolveFrontAssemblyDepths(
  form: DeviceFormParams = DEFAULT_DEVICE_FORM,
): FrontAssemblyDepths {
  const frontFaceZ = body.depth / 2;
  const displayReferenceZ =
    frontFaceZ +
    minimumFrontShellOffsetAroundRect(
      {
        centerX: screen.centerX,
        centerY: screen.centerY,
        width: screen.width + 8,
        height: screen.height + 8,
      },
      form,
    );
  const wheelReferenceZ =
    frontFaceZ +
    minimumFrontShellOffsetAroundCircle(
      {
        centerX: wheel.centerX,
        centerY: wheel.centerY,
        radius: wheel.outerR,
      },
      form,
    );
  const ringSag =
    wheel.outerR * Math.tan(form.ringDishTiltDeg * Math.PI / 180) /
    form.ringDishExponent;
  const ringZ = wheelReferenceZ - form.recessDepth - ringSag;
  const ringInnerZ =
    ringZ +
    ringSag * ((wheel.selectR - 1) / wheel.outerR) ** form.ringDishExponent;
  const selectSag =
    wheel.selectR * Math.tan(form.selectDomeTiltDeg * Math.PI / 180) /
    form.selectDomeExponent;
  const selectRimZ = ringInnerZ + form.selectProud;
  const glassFrontZ = displayReferenceZ - form.glassInset;
  return {
    displayReferenceZ,
    displayWellFrontZ: displayReferenceZ - form.displayWellInset,
    glassFrontZ,
    screenFrontZ: glassFrontZ - form.glassThickness - form.glassToPanel,
    wheelReferenceZ,
    wheelWellZ:
      wheelReferenceZ -
      (form.recessDepth + form.wheelWellDepth) / 2 +
      0.15,
    ringZ,
    ringSag,
    ringInnerZ,
    selectSag,
    selectRimZ,
    clickWheelInputZ: wheelReferenceZ - form.recessDepth + INPUT_PLANE_OFFSET,
  };
}

/** Production assembly depths, shared by the visible wheel and its ray plane. */
export const DEFAULT_FRONT_ASSEMBLY_DEPTHS = Object.freeze(
  resolveFrontAssemblyDepths(),
);
