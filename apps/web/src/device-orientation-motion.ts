import {
  DEVICE_ORIENTATION_LIMITS,
  type DeviceOrientation,
} from '@webpod/device'

export const DEVICE_ORIENTATION_DRAG_GAIN = Object.freeze({
  pitchDegPerPixel: 0.28,
  yawDegPerPixel: 0.42,
  rollDegPerPixel: 0.18,
})

/** Recent-pointer window used to estimate release velocity. */
export const ORIENTATION_RELEASE_SAMPLE_WINDOW_MS = 110
/** A held pointer is no longer a flick after this much release-time silence. */
export const ORIENTATION_RELEASE_SAMPLE_STALE_MS = 72
/** Corrupted/coalesced pointer jumps above this rate do not enter inertia. */
export const ORIENTATION_MAX_POINTER_SPEED_PX_PER_SECOND = 5_000
/** A deliberate yaw flick always resolves to the opposite starting hemisphere. */
export const ORIENTATION_OPPOSITE_FACE_FLICK_DEG_PER_SECOND = 340
/** Exponential free-coast drag, expressed per second rather than per frame. */
export const ORIENTATION_COAST_DECAY_PER_SECOND = 7.5
/** Natural frequency of the opposite-face settling spring. */
export const ORIENTATION_FLIP_SPRING_FREQUENCY_PER_SECOND = 13
/** Damping ratio below one keeps the landing physical but restrained. */
export const ORIENTATION_FLIP_DAMPING_RATIO = 0.82
/** The opposite-face spring may pass its target only by this amount. */
export const ORIENTATION_FLIP_MAX_OVERSHOOT_DEG = 3.5
export const ORIENTATION_SETTLE_VELOCITY_DEG_PER_SECOND = 2
export const ORIENTATION_SETTLE_DISTANCE_DEG = 0.08

export type PointerMotionSample = {
  readonly clientX: number
  readonly clientY: number
  readonly timestampMs: number
}

export type PointerVelocity = {
  readonly xPxPerSecond: number
  readonly yPxPerSecond: number
}

export type DeviceOrientationVelocity = {
  readonly pitchDegPerSecond: number
  readonly yawDegPerSecond: number
  readonly rollDegPerSecond: number
}

export type DeviceOrientationReleaseMotion = {
  readonly kind: 'coast' | 'opposite-face'
  /** Yaw is intentionally unwrapped until the external store publishes it. */
  readonly orientation: DeviceOrientation
  readonly velocity: DeviceOrientationVelocity
  readonly targetYawDeg: number | null
  readonly flickDirection: -1 | 0 | 1
}

export type DeviceOrientationRelease = {
  readonly orientation: DeviceOrientation
  readonly motion: DeviceOrientationReleaseMotion | null
}

/**
 * Estimates release velocity from recent valid segments, biased toward the tip.
 *
 * Non-monotonic timestamps, zero-duration segments, and physically implausible
 * jumps are rejected. A stale final sample returns zero so holding still before
 * release cannot replay velocity measured earlier in the drag.
 */
export function estimatePointerReleaseVelocity(
  samples: readonly PointerMotionSample[],
  releaseTimestampMs: number,
): PointerVelocity {
  if (!Number.isFinite(releaseTimestampMs) || samples.length < 2) {
    return { xPxPerSecond: 0, yPxPerSecond: 0 }
  }
  const lowerBound = releaseTimestampMs - ORIENTATION_RELEASE_SAMPLE_WINDOW_MS
  const recent = samples.filter(
    (sample) =>
      finiteSample(sample) &&
      sample.timestampMs >= lowerBound &&
      sample.timestampMs <= releaseTimestampMs,
  )
  if (recent.length < 2) return { xPxPerSecond: 0, yPxPerSecond: 0 }

  const first = recent[0]
  if (first === undefined) return { xPxPerSecond: 0, yPxPerSecond: 0 }
  const accepted: PointerMotionSample[] = [first]
  for (const sample of recent.slice(1)) {
    const previous = accepted.at(-1)
    if (previous === undefined) continue
    const elapsedMs = sample.timestampMs - previous.timestampMs
    if (!(elapsedMs > 0)) continue
    const speed =
      (Math.hypot(
        sample.clientX - previous.clientX,
        sample.clientY - previous.clientY,
      ) /
        elapsedMs) *
      1_000
    if (speed > ORIENTATION_MAX_POINTER_SPEED_PX_PER_SECOND) continue
    accepted.push(sample)
  }
  const last = accepted.at(-1)
  if (
    accepted.length < 2 ||
    last === undefined ||
    releaseTimestampMs - last.timestampMs > ORIENTATION_RELEASE_SAMPLE_STALE_MS
  ) {
    return { xPxPerSecond: 0, yPxPerSecond: 0 }
  }

  let weightedX = 0
  let weightedY = 0
  let totalWeight = 0
  const segmentCount = accepted.length - 1
  for (let index = 1; index < accepted.length; index += 1) {
    const previous = accepted[index - 1]
    const sample = accepted[index]
    if (previous === undefined || sample === undefined) continue
    const elapsedMs = sample.timestampMs - previous.timestampMs
    if (!(elapsedMs > 0)) continue
    const recency = 1 + (2 * index) / segmentCount
    const weight = elapsedMs * recency
    weightedX += ((sample.clientX - previous.clientX) / elapsedMs) * 1_000 * weight
    weightedY += ((sample.clientY - previous.clientY) / elapsedMs) * 1_000 * weight
    totalWeight += weight
  }
  if (!(totalWeight > 0)) return { xPxPerSecond: 0, yPxPerSecond: 0 }
  return {
    xPxPerSecond: weightedX / totalWeight,
    yPxPerSecond: weightedY / totalWeight,
  }
}

/** Maps viewport pointer velocity through the exact direct-manipulation gains. */
export function pointerVelocityToDeviceVelocity(
  velocity: PointerVelocity,
  rollMode: boolean,
): DeviceOrientationVelocity {
  return {
    pitchDegPerSecond:
      velocity.yPxPerSecond * DEVICE_ORIENTATION_DRAG_GAIN.pitchDegPerPixel,
    yawDegPerSecond: rollMode
      ? 0
      : velocity.xPxPerSecond * DEVICE_ORIENTATION_DRAG_GAIN.yawDegPerPixel,
    rollDegPerSecond: rollMode
      ? velocity.xPxPerSecond * DEVICE_ORIENTATION_DRAG_GAIN.rollDegPerPixel
      : 0,
  }
}

/**
 * Starts coast or semantic opposite-face motion from one pointer release.
 * Reduced motion keeps ordinary releases still and resolves semantic flips in
 * one state write, without retaining an animation frame.
 */
export function beginDeviceOrientationRelease(
  startOrientation: DeviceOrientation,
  currentOrientation: DeviceOrientation,
  velocity: DeviceOrientationVelocity,
  reducedMotion: boolean,
): DeviceOrientationRelease {
  const yawSpeed = velocity.yawDegPerSecond
  const isOppositeFaceFlick =
    Math.abs(yawSpeed) >= ORIENTATION_OPPOSITE_FACE_FLICK_DEG_PER_SECOND
  if (isOppositeFaceFlick) {
    const direction = Math.sign(yawSpeed) as -1 | 1
    const targetYawDeg = oppositeFaceTargetYaw(
      startOrientation.yawDeg,
      currentOrientation.yawDeg,
      direction,
    )
    if (reducedMotion) {
      return {
        orientation: { ...currentOrientation, yawDeg: targetYawDeg },
        motion: null,
      }
    }
    return {
      orientation: currentOrientation,
      motion: {
        kind: 'opposite-face',
        orientation: currentOrientation,
        velocity,
        targetYawDeg,
        flickDirection: direction,
      },
    }
  }

  if (reducedMotion || settledVelocity(velocity)) {
    return { orientation: currentOrientation, motion: null }
  }
  return {
    orientation: currentOrientation,
    motion: {
      kind: 'coast',
      orientation: currentOrientation,
      velocity,
      targetYawDeg: null,
      flickDirection: 0,
    },
  }
}

/** Advances release motion with analytic, frame-rate-independent equations. */
export function advanceDeviceOrientationRelease(
  motion: DeviceOrientationReleaseMotion,
  elapsedSeconds: number,
): DeviceOrientationRelease {
  if (!(elapsedSeconds > 0) || !Number.isFinite(elapsedSeconds)) {
    return { orientation: motion.orientation, motion }
  }
  const pitch = decayedAxis(
    motion.orientation.pitchDeg,
    motion.velocity.pitchDegPerSecond,
    elapsedSeconds,
    DEVICE_ORIENTATION_LIMITS.pitchMin,
    DEVICE_ORIENTATION_LIMITS.pitchMax,
  )
  const roll = decayedAxis(
    motion.orientation.rollDeg,
    motion.velocity.rollDegPerSecond,
    elapsedSeconds,
    DEVICE_ORIENTATION_LIMITS.rollMin,
    DEVICE_ORIENTATION_LIMITS.rollMax,
  )

  if (motion.kind === 'coast' || motion.targetYawDeg === null) {
    const yaw = decay(
      motion.orientation.yawDeg,
      motion.velocity.yawDegPerSecond,
      elapsedSeconds,
    )
    const orientation = {
      pitchDeg: pitch.position,
      yawDeg: yaw.position,
      rollDeg: roll.position,
    }
    const velocity = {
      pitchDegPerSecond: pitch.velocity,
      yawDegPerSecond: yaw.velocity,
      rollDegPerSecond: roll.velocity,
    }
    return settledVelocity(velocity)
      ? {
          orientation: {
            pitchDeg: coastRestPosition(
              orientation.pitchDeg,
              velocity.pitchDegPerSecond,
              DEVICE_ORIENTATION_LIMITS.pitchMin,
              DEVICE_ORIENTATION_LIMITS.pitchMax,
            ),
            yawDeg:
              orientation.yawDeg +
              velocity.yawDegPerSecond / ORIENTATION_COAST_DECAY_PER_SECOND,
            rollDeg: coastRestPosition(
              orientation.rollDeg,
              velocity.rollDegPerSecond,
              DEVICE_ORIENTATION_LIMITS.rollMin,
              DEVICE_ORIENTATION_LIMITS.rollMax,
            ),
          },
          motion: null,
        }
      : {
          orientation,
          motion: { ...motion, orientation, velocity },
        }
  }

  const yaw = springAxis(
    motion.orientation.yawDeg,
    motion.velocity.yawDegPerSecond,
    motion.targetYawDeg,
    elapsedSeconds,
  )
  let yawPosition = yaw.position
  let yawVelocity = yaw.velocity
  const overshoot =
    (yawPosition - motion.targetYawDeg) * motion.flickDirection
  if (overshoot > ORIENTATION_FLIP_MAX_OVERSHOOT_DEG) {
    yawPosition =
      motion.targetYawDeg +
      motion.flickDirection * ORIENTATION_FLIP_MAX_OVERSHOOT_DEG
    yawVelocity = 0
  }
  const orientation = {
    pitchDeg: pitch.position,
    yawDeg: yawPosition,
    rollDeg: roll.position,
  }
  const velocity = {
    pitchDegPerSecond: pitch.velocity,
    yawDegPerSecond: yawVelocity,
    rollDegPerSecond: roll.velocity,
  }
  const yawSettled =
    Math.abs(yawPosition - motion.targetYawDeg) <=
      ORIENTATION_SETTLE_DISTANCE_DEG &&
    Math.abs(yawVelocity) <= ORIENTATION_SETTLE_VELOCITY_DEG_PER_SECOND
  if (yawSettled && settledVelocity({ ...velocity, yawDegPerSecond: 0 })) {
    return {
      orientation: {
        pitchDeg: coastRestPosition(
          orientation.pitchDeg,
          velocity.pitchDegPerSecond,
          DEVICE_ORIENTATION_LIMITS.pitchMin,
          DEVICE_ORIENTATION_LIMITS.pitchMax,
        ),
        yawDeg: motion.targetYawDeg,
        rollDeg: coastRestPosition(
          orientation.rollDeg,
          velocity.rollDegPerSecond,
          DEVICE_ORIENTATION_LIMITS.rollMin,
          DEVICE_ORIENTATION_LIMITS.rollMax,
        ),
      },
      motion: null,
    }
  }
  return {
    orientation,
    motion: { ...motion, orientation, velocity },
  }
}

function oppositeFaceTargetYaw(
  startYawDeg: number,
  currentYawDeg: number,
  direction: -1 | 1,
): number {
  const startedFront = Math.cos((startYawDeg * Math.PI) / 180) >= 0
  const oppositeOffset = startedFront ? 180 : 0
  if (direction > 0) {
    let target =
      oppositeOffset + Math.ceil((currentYawDeg - oppositeOffset) / 360) * 360
    if (target <= currentYawDeg + Number.EPSILON) target += 360
    return target
  }
  let target =
    oppositeOffset + Math.floor((currentYawDeg - oppositeOffset) / 360) * 360
  if (target >= currentYawDeg - Number.EPSILON) target -= 360
  return target
}

function decay(
  position: number,
  velocity: number,
  elapsedSeconds: number,
): { readonly position: number; readonly velocity: number } {
  const retained = Math.exp(-ORIENTATION_COAST_DECAY_PER_SECOND * elapsedSeconds)
  return {
    position:
      position +
      (velocity / ORIENTATION_COAST_DECAY_PER_SECOND) * (1 - retained),
    velocity: velocity * retained,
  }
}

function decayedAxis(
  position: number,
  velocity: number,
  elapsedSeconds: number,
  minimum: number,
  maximum: number,
): { readonly position: number; readonly velocity: number } {
  const next = decay(position, velocity, elapsedSeconds)
  const clamped = Math.min(maximum, Math.max(minimum, next.position))
  return {
    position: clamped,
    velocity: clamped === next.position ? next.velocity : 0,
  }
}

function coastRestPosition(
  position: number,
  velocity: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      position + velocity / ORIENTATION_COAST_DECAY_PER_SECOND,
    ),
  )
}

function springAxis(
  position: number,
  velocity: number,
  target: number,
  elapsedSeconds: number,
): { readonly position: number; readonly velocity: number } {
  const frequency = ORIENTATION_FLIP_SPRING_FREQUENCY_PER_SECOND
  const damping = ORIENTATION_FLIP_DAMPING_RATIO
  const dampedFrequency = frequency * Math.sqrt(1 - damping * damping)
  const displacement = position - target
  const a = displacement
  const b = (velocity + damping * frequency * displacement) / dampedFrequency
  const phase = dampedFrequency * elapsedSeconds
  const cosine = Math.cos(phase)
  const sine = Math.sin(phase)
  const retained = Math.exp(-damping * frequency * elapsedSeconds)
  return {
    position: target + retained * (a * cosine + b * sine),
    velocity:
      retained *
      ((-damping * frequency * a + dampedFrequency * b) * cosine +
        (-damping * frequency * b - dampedFrequency * a) * sine),
  }
}

function settledVelocity(velocity: DeviceOrientationVelocity): boolean {
  return (
    Math.abs(velocity.pitchDegPerSecond) <=
      ORIENTATION_SETTLE_VELOCITY_DEG_PER_SECOND &&
    Math.abs(velocity.yawDegPerSecond) <=
      ORIENTATION_SETTLE_VELOCITY_DEG_PER_SECOND &&
    Math.abs(velocity.rollDegPerSecond) <=
      ORIENTATION_SETTLE_VELOCITY_DEG_PER_SECOND
  )
}

function finiteSample(sample: PointerMotionSample): boolean {
  return (
    Number.isFinite(sample.clientX) &&
    Number.isFinite(sample.clientY) &&
    Number.isFinite(sample.timestampMs)
  )
}
