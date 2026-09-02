import { Box3, Vector3 } from "three";

import { DEFAULT_DEVICE_FORM, type DeviceFormParams } from "./form";
import { DEVICE_LAYOUT } from "./layout";
import { DEFAULT_DEVICE_TOP_CONTROL_BOUNDS } from "./top-controls";

export type DeviceEnvelope = {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
  readonly center: readonly [number, number, number];
  readonly halfExtents: readonly [number, number, number];
  readonly boundingRadius: number;
};

/**
 * Declares the immutable enclosure envelope that owns the model pivot.
 *
 * The envelope contains the complete body shell from mirror rear plate to the
 * furthest molded front crown plus the physical top-edge controls. Flush
 * wheel/Select travel, LCD DOM pixels, decals, ray helpers, and light/probe
 * geometry do not participate: all are children of the rigid device and none
 * may move its physical center.
 */
export function completeDeviceEnvelope(
  form: DeviceFormParams = DEFAULT_DEVICE_FORM,
): DeviceEnvelope {
  const { body } = DEVICE_LAYOUT;
  const rearZ = -body.depth / 2;
  const maximumFrontCrown =
    Math.max(0, form.bodyCrown) +
    Math.max(0, form.bodyCrossCrown) +
    Math.max(0, form.topEdgeCrown, form.bottomEdgeCrown);
  const frontZ = body.depth / 2 + maximumFrontCrown;
  const minX = Math.min(-body.width / 2, DEFAULT_DEVICE_TOP_CONTROL_BOUNDS.min[0]);
  const maxX = Math.max(body.width / 2, DEFAULT_DEVICE_TOP_CONTROL_BOUNDS.max[0]);
  const minY = Math.min(-body.height / 2, DEFAULT_DEVICE_TOP_CONTROL_BOUNDS.min[1]);
  const maxY = Math.max(body.height / 2, DEFAULT_DEVICE_TOP_CONTROL_BOUNDS.max[1]);
  const minZ = Math.min(rearZ, DEFAULT_DEVICE_TOP_CONTROL_BOUNDS.min[2]);
  const maxZ = Math.max(frontZ, DEFAULT_DEVICE_TOP_CONTROL_BOUNDS.max[2]);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const halfWidth = (maxX - minX) / 2;
  const halfHeight = (maxY - minY) / 2;
  const halfDepth = (maxZ - minZ) / 2;
  const center = [centerX, centerY, centerZ] as const;
  const halfExtents = [halfWidth, halfHeight, halfDepth] as const;
  return Object.freeze({
    width: maxX - minX,
    height: maxY - minY,
    depth: maxZ - minZ,
    min: Object.freeze([minX, minY, minZ] as const),
    max: Object.freeze([maxX, maxY, maxZ] as const),
    center: Object.freeze(center),
    halfExtents: Object.freeze(halfExtents),
    boundingRadius: Math.hypot(...halfExtents),
  });
}

/** Caller-owned local enclosure bounds for projection and fit calculations. */
export function deviceEnvelopeBounds(envelope: DeviceEnvelope): Box3 {
  return new Box3(
    new Vector3(...envelope.min),
    new Vector3(...envelope.max),
  );
}

export const DEFAULT_DEVICE_ENVELOPE = completeDeviceEnvelope();
