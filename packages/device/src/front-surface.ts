import { Vector3 } from "three";

import {
  edgeCrownSlope,
  edgeCrownOffset,
  horizontalCrownOffset,
  horizontalCrownSlope,
  verticalCrownOffset,
  verticalCrownSlope,
} from "./curved-shell";
import { DEFAULT_DEVICE_FORM, type DeviceFormParams } from "./form";
import { DEVICE_LAYOUT } from "./layout";
import { DEVICE_SURFACE_LAYOUT } from "./surface-layout";

const { body, wheel } = DEVICE_LAYOUT;
const INPUT_PLANE_OFFSET = 0.25;

export type FrontSurfaceForm = Pick<
  DeviceFormParams,
  | "seamWidth"
  | "bodyCrown"
  | "bodyCrossCrown"
  | "topEdgeCrown"
  | "bottomEdgeCrown"
  | "edgeCrownExtent"
>;

/** Model-space seam targets; converted to millimetres in physical gates. */
export const WHEEL_OUTER_SEAM_WIDTH = 0.5;
export const SELECT_SEAM_WIDTH = wheel.selectLipR - wheel.selectR;
/** A depth-buffer separator, not a visible pocket. 0.05px ≈ 0.0094mm. */
export const WHEEL_GAP_FLOOR_OFFSET = 0.05;

/** Crown displacement of the physical front shell at one body-local point. */
export function frontShellOffsetAt(
  x: number,
  y: number,
  form: FrontSurfaceForm = DEFAULT_DEVICE_FORM,
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

/** Analytic normal shared by the shell and every flush front control patch. */
export function frontShellNormalAt(
  x: number,
  y: number,
  form: FrontSurfaceForm = DEFAULT_DEVICE_FORM,
): Vector3 {
  const halfWidth = body.width / 2 - form.seamWidth;
  const halfHeight = body.height / 2 - form.seamWidth;
  const slopeX = horizontalCrownSlope(x, halfWidth, form.bodyCrossCrown);
  const slopeY =
    verticalCrownSlope(y, halfHeight, form.bodyCrown) +
    edgeCrownSlope(y, halfHeight, {
      top: form.topEdgeCrown,
      bottom: form.bottomEdgeCrown,
      extent: form.edgeCrownExtent,
    });
  return new Vector3(-slopeX, -slopeY, 1).normalize();
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
    frontShellOffsetAt(
      rect.centerX - halfWidth,
      rect.centerY - halfHeight,
      form,
    ),
    frontShellOffsetAt(
      rect.centerX + halfWidth,
      rect.centerY - halfHeight,
      form,
    ),
    frontShellOffsetAt(
      rect.centerX - halfWidth,
      rect.centerY + halfHeight,
      form,
    ),
    frontShellOffsetAt(
      rect.centerX + halfWidth,
      rect.centerY + halfHeight,
      form,
    ),
  );
}

/** Classic Select depression, about 0.24mm; the outer rim stays flush. */
export const SELECT_CONCAVITY = 1.3;

export type FrontAssemblyDepths = {
  readonly displayReferenceZ: number;
  readonly displayWellFrontZ: number;
  readonly glassFrontZ: number;
  readonly screenFrontZ: number;
  /** Shared base plane; local crown displacement is carried by each patch. */
  readonly wheelSurfaceBaseZ: number;
  readonly wheelGapFloorBaseZ: number;
  readonly wheelTopAtCenterZ: number;
  /** Resting center of the shallow Classic Select bowl, below its flush rim. */
  readonly selectTopAtCenterZ: number;
  readonly clickWheelInputZ: number;
};

/**
 * Resolve every front insert from the same physical shell frame.
 *
 * Flat glass uses the lowest crown point around its opening. The wheel and
 * Select use the shell crown at their installed rims. The Classic Select
 * interior is a shallow concave bowl; its center depth is stated separately
 * from the shared assembly base so it cannot move the wheel or display.
 */
export function resolveFrontAssemblyDepths(
  form: DeviceFormParams = DEFAULT_DEVICE_FORM,
): FrontAssemblyDepths {
  const frontFaceZ = body.depth / 2;
  const displayReferenceZ =
    frontFaceZ +
    minimumFrontShellOffsetAroundRect(
      DEVICE_SURFACE_LAYOUT.front.displayWell,
      form,
    );
  const wheelSurfaceBaseZ = frontFaceZ;
  const wheelTopAtCenterZ =
    wheelSurfaceBaseZ + frontShellOffsetAt(wheel.centerX, wheel.centerY, form);
  const glassFrontZ = displayReferenceZ - form.glassInset;
  const maximumFrontOffset =
    Math.max(0, form.bodyCrown) +
    Math.max(0, form.bodyCrossCrown) +
    Math.max(0, form.topEdgeCrown, form.bottomEdgeCrown);
  return {
    displayReferenceZ,
    displayWellFrontZ: displayReferenceZ - form.displayWellInset,
    glassFrontZ,
    screenFrontZ: glassFrontZ - form.glassThickness - form.glassToPanel,
    wheelSurfaceBaseZ,
    wheelGapFloorBaseZ: wheelSurfaceBaseZ - WHEEL_GAP_FLOOR_OFFSET,
    wheelTopAtCenterZ,
    selectTopAtCenterZ: wheelTopAtCenterZ - SELECT_CONCAVITY,
    clickWheelInputZ:
      wheelSurfaceBaseZ + maximumFrontOffset + INPUT_PLANE_OFFSET,
  };
}

/** Production assembly depths, shared by the visible wheel and its ray plane. */
export const DEFAULT_FRONT_ASSEMBLY_DEPTHS = Object.freeze(
  resolveFrontAssemblyDepths(),
);
