/**
 * Device orientation, in viewer-relative degrees.
 *
 * The model's authored local frame is body-centred, +y up and +z toward the
 * viewer. `pitchDeg`, `yawDeg`, and `rollDeg` therefore map directly to
 * Three's default XYZ Euler order around those same axes.
 */
export type DeviceFace = "front" | "back";

/** Which face meaningfully presents itself to the viewer at this orientation. */
export type DeviceVisibleFace = DeviceFace | "edge";

export type DevicePosePreset = "front" | "three-quarter" | "edge" | "rear";

export type DeviceOrientation = {
  /** Positive pitches the top edge away from the viewer. */
  readonly pitchDeg: number;
  /** Positive yaws the right edge toward the viewer. */
  readonly yawDeg: number;
  /** Positive rolls clockwise in screen space. */
  readonly rollDeg: number;
};

const DEG_TO_RAD = Math.PI / 180;

export const FRONT_DEVICE_ORIENTATION: DeviceOrientation = Object.freeze({
  pitchDeg: 0,
  yawDeg: 0,
  rollDeg: 0,
});

export const THREE_QUARTER_DEVICE_ORIENTATION: DeviceOrientation =
  Object.freeze({
    pitchDeg: 10,
    yawDeg: -34,
    rollDeg: 2,
  });

export const EDGE_DEVICE_ORIENTATION: DeviceOrientation = Object.freeze({
  pitchDeg: 0,
  yawDeg: -90,
  rollDeg: 0,
});

export const REAR_DEVICE_ORIENTATION: DeviceOrientation = Object.freeze({
  pitchDeg: 0,
  yawDeg: 180,
  rollDeg: 0,
});

export const DEVICE_ORIENTATION_PRESETS: Record<
  DevicePosePreset,
  DeviceOrientation
> = Object.freeze({
  front: FRONT_DEVICE_ORIENTATION,
  "three-quarter": THREE_QUARTER_DEVICE_ORIENTATION,
  edge: EDGE_DEVICE_ORIENTATION,
  rear: REAR_DEVICE_ORIENTATION,
});

export const DEVICE_FRONT_VISIBILITY_THRESHOLD = 0.18;

export function deviceOrientationToRotation(
  orientation: DeviceOrientation,
): readonly [number, number, number] {
  return [
    orientation.pitchDeg * DEG_TO_RAD,
    orientation.yawDeg * DEG_TO_RAD,
    orientation.rollDeg * DEG_TO_RAD,
  ] as const;
}

/**
 * Dot product between the viewer direction and the device's front normal.
 *
 * The local front normal starts at +z. Under XYZ Euler rotation, roll leaves
 * that normal's z component unchanged, so the viewer-facing term depends only
 * on pitch and yaw: `cos(pitch) * cos(yaw)`.
 */
export function deviceFrontVisibility(
  orientation: DeviceOrientation,
): number {
  const pitch = orientation.pitchDeg * DEG_TO_RAD;
  const yaw = orientation.yawDeg * DEG_TO_RAD;
  return Math.cos(pitch) * Math.cos(yaw);
}

export function resolveDeviceVisibleFace(
  orientation: DeviceOrientation,
): DeviceVisibleFace {
  const visibility = deviceFrontVisibility(orientation);
  if (visibility >= DEVICE_FRONT_VISIBILITY_THRESHOLD) return "front";
  if (visibility <= -DEVICE_FRONT_VISIBILITY_THRESHOLD) return "back";
  return "edge";
}

export function deviceScreenIsInteractable(
  orientation: DeviceOrientation,
): boolean {
  return resolveDeviceVisibleFace(orientation) === "front";
}

export function orientationFromFace(face: DeviceFace): DeviceOrientation {
  return face === "back" ? REAR_DEVICE_ORIENTATION : FRONT_DEVICE_ORIENTATION;
}

export function wrapDegrees(value: number): number {
  const wrapped = ((value + 180) % 360 + 360) % 360 - 180;
  return wrapped === -180 ? 180 : wrapped;
}

export function clampDeviceOrientation(
  orientation: DeviceOrientation,
  limits: {
    readonly pitchMin?: number;
    readonly pitchMax?: number;
    readonly rollMin?: number;
    readonly rollMax?: number;
  } = {},
): DeviceOrientation {
  return {
    pitchDeg: clamp(
      orientation.pitchDeg,
      limits.pitchMin ?? -45,
      limits.pitchMax ?? 45,
    ),
    yawDeg: wrapDegrees(orientation.yawDeg),
    rollDeg: clamp(
      orientation.rollDeg,
      limits.rollMin ?? -18,
      limits.rollMax ?? 18,
    ),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
