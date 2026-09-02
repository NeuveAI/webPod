import type { Object3D } from "three";

import { DEVICE_LAYOUT } from "./layout";

/** Pointer kinds supported by the physical enclosure grab interaction. */
export type DeviceOrientationPointerType = "mouse" | "pen" | "touch";

/** Browser pointer-capture methods retained for one active enclosure grab. */
export type DeviceOrientationPointerCapture = {
  readonly hasPointerCapture: (pointerId: number) => boolean;
  readonly setPointerCapture: (pointerId: number) => void;
  readonly releasePointerCapture: (pointerId: number) => void;
};

/**
 * One ray-confirmed pointer contact on the visible enclosure perimeter.
 *
 * Coordinates are CSS viewport pixels. The host/capture pair belongs to the
 * R3F canvas that received the native event; consumers must release it on
 * release, cancellation, lost capture, blur, and disposal.
 */
export type DeviceOrientationGrabStart = {
  readonly pointerId: number;
  readonly pointerType: DeviceOrientationPointerType;
  readonly clientX: number;
  readonly clientY: number;
  readonly timestampMs: number;
  /** Option/Alt-drag is the deliberate roll gesture. */
  readonly rollMode: boolean;
  readonly host: EventTarget;
  readonly capture: DeviceOrientationPointerCapture;
};

/** Width of the physical perimeter band that can begin an orientation grab. */
export const DEVICE_ORIENTATION_GRAB_BAND = 18;

/**
 * Whether a primary browser pointer may own one device-orientation gesture.
 * Mouse and pen require their primary tip/button; touch has no button value.
 */
export function acceptsDeviceOrientationPointer(input: {
  readonly isPrimary: boolean;
  readonly pointerType: string;
  readonly button: number;
}): input is typeof input & {
  readonly pointerType: DeviceOrientationPointerType;
} {
  return (
    acceptsDeviceOrientationHover(input) &&
    (input.pointerType === "touch" || input.button === 0)
  );
}

/** Whether a hover/move event can advertise the enclosure grab affordance. */
export function acceptsDeviceOrientationHover(input: {
  readonly isPrimary: boolean;
  readonly pointerType: string;
}): input is typeof input & {
  readonly pointerType: DeviceOrientationPointerType;
} {
  return (
    input.isPrimary &&
    (input.pointerType === "mouse" ||
      input.pointerType === "pen" ||
      input.pointerType === "touch")
  );
}

/**
 * Tests a body-local point against the rounded enclosure silhouette.
 *
 * The result is true only in a narrow band around the actual outer boundary;
 * the LCD, click wheel, Select button, labels, and broad face centre are not
 * orientation targets even though they share the same canvas.
 */
export function isDeviceOuterGrabPoint(
  x: number,
  y: number,
  band = DEVICE_ORIENTATION_GRAB_BAND,
): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !(band > 0)) return false;
  const signedDistance = roundedRectSignedDistance(
    x,
    y,
    DEVICE_LAYOUT.body.width / 2,
    DEVICE_LAYOUT.body.height / 2,
    DEVICE_LAYOUT.body.cornerR,
  );
  return Math.abs(signedDistance) <= band;
}

/** The enclosure may start a grab only when it is the ray's visible hit. */
export function isFirstVisibleDeviceShellHit(
  shell: Object3D,
  intersections: readonly { readonly object: Object3D }[],
): boolean {
  return intersections[0]?.object === shell;
}

/** Signed distance to a centred rounded rectangle; negative means inside. */
function roundedRectSignedDistance(
  x: number,
  y: number,
  halfWidth: number,
  halfHeight: number,
  radius: number,
): number {
  const qx = Math.abs(x) - (halfWidth - radius);
  const qy = Math.abs(y) - (halfHeight - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - radius;
}
