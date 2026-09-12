import { WHEEL_OUTER_SEAM_WIDTH } from "./front-surface";
import { DEVICE_LAYOUT, PX_PER_MM } from "./layout";

/**
 * Transient control travel, expressed in physical millimetres and converted
 * through the established 5G body scale.
 *
 * No surviving Apple service source publishes the 5G control travel. The
 * owner photographs establish the flush rest geometry, while these restrained
 * depths are visual calibration under the approved key/fill rig. They are not
 * presented as OEM dimensions.
 */
export const CONTROL_TRAVEL = Object.freeze({
  // Low-side rim travel for the rigid wheel rock. This is deliberately below
  // both the rejected 0.08 mm basin and rejected 0.03 mm whole-wheel shift.
  // It remains bounded visual calibration, not an OEM dimension.
  wheelMm: 0.006,
  // Select is a separate plastic part, but its live travel must remain a
  // restrained near-flush device-local translation rather than a deep pocket.
  selectMm: 0.12,
  wheelModel: 0.006 * PX_PER_MM,
  selectModel: 0.12 * PX_PER_MM,
});

const WHEEL_VISIBLE_RADIUS_MODEL =
  DEVICE_LAYOUT.wheel.outerR - WHEEL_OUTER_SEAM_WIDTH;

/** One rigid-disc tilt derived from its bounded low-side rim travel. */
export const WHEEL_TILT = Object.freeze({
  radiusModel: WHEEL_VISIBLE_RADIUS_MODEL,
  maxAngleRad: Math.asin(
    CONTROL_TRAVEL.wheelModel / WHEEL_VISIBLE_RADIUS_MODEL,
  ),
});

export const CONTROL_RELEASE_MS = Object.freeze({
  wheel: 120,
  select: 96,
});

/** Consecutive non-advancing timestamps tolerated before a safety settle. */
export const CONTROL_STALLED_FRAME_LIMIT = 24;

export interface ControlReleaseState {
  readonly startedAtMs: number;
  readonly initialDepth: number;
  readonly durationMs: number;
  readonly lastTimestampMs: number;
  readonly stalledFrames: number;
}

/** The authored release equation, including timestamp rollback and 24 stalled
 * frame safety settlement. Used unchanged by renderer and main fallback. */
export function advanceControlRelease(release: ControlReleaseState, timestampMs: number) {
  const timestampAdvanced = Number.isFinite(timestampMs) && timestampMs > release.lastTimestampMs;
  const lastTimestampMs = timestampAdvanced ? timestampMs : release.lastTimestampMs;
  const stalledFrames = timestampAdvanced ? 0 : release.stalledFrames + 1;
  const elapsed = Number.isFinite(timestampMs) ? Math.max(0, timestampMs - release.startedAtMs) : 0;
  const progress = Math.min(1, elapsed / release.durationMs);
  const settled = progress >= 1 || stalledFrames >= CONTROL_STALLED_FRAME_LIMIT;
  const remaining = 1 - progress;
  return {lastTimestampMs, stalledFrames, settled,
    depth: settled ? 0 : release.initialDepth * remaining * remaining * remaining};
}
