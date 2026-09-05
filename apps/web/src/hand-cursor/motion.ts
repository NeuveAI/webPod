/** All time is milliseconds; velocity is CSS pixels/ms and acceleration px/ms². */
export const HAND_MOTION = {
  poseBlendMs: 85,
  followMs: 95,
  maxTilt: .30,
  smearHoldMs: 48,
  smearDecayMs: 65,
  accelerationFloor: .018,
  speedFloor: .65,
  highSpeed: 2.4,
  accelerationRatio: 2.1,
  baselineMs: 420,
  maxStretch: .7,
  maxTrailPx: 24,
  sampleResetMs: 140,
} as const

export interface HandMotion {
  x: number
  y: number
  time: number
  vx: number
  vy: number
  baseline: number
  smear: number
  smearUntil: number
  angle: number
}

/** Restart on re-entry or long gaps so a window jump cannot create a smear. */
export function initialMotion(x: number, y: number, time: number): HandMotion {
  return { x, y, time, vx: 0, vy: 0, baseline: HAND_MOTION.accelerationFloor, smear: 0, smearUntil: 0, angle: 0 }
}

/** Time-normalized adaptive acceleration detector. Memory is strictly constant. */
export function sampleMotion(previous: HandMotion, x: number, y: number, time: number): HandMotion {
  const dt = time - previous.time
  if (dt > HAND_MOTION.sampleResetMs || dt < 0) return initialMotion(x, y, time)
  if (dt < 2) return previous
  const vx = (x - previous.x) / dt
  const vy = (y - previous.y) / dt
  const speed = Math.hypot(vx, vy)
  const acceleration = Math.hypot(vx - previous.vx, vy - previous.vy) / dt
  const threshold = Math.max(HAND_MOTION.accelerationFloor, previous.baseline * HAND_MOTION.accelerationRatio)
  const fast = speed > HAND_MOTION.speedFloor && (acceleration > threshold || speed > HAND_MOTION.highSpeed)
  const intensity = fast ? Math.min(1, Math.max(speed / 4, acceleration / (threshold * 4))) : previous.smear
  return {
    x, y, time, vx, vy,
    baseline: previous.baseline + (Math.min(acceleration, .2) - previous.baseline) * (1 - Math.exp(-dt / HAND_MOTION.baselineMs)),
    smear: intensity,
    smearUntil: fast ? time + HAND_MOTION.smearHoldMs : previous.smearUntil,
    angle: speed > .1 ? Math.atan2(-vy, vx) : previous.angle,
  }
}

/** Smears decay even when pointer events stop; no persistent motion blur. */
export function smearAt(motion: HandMotion, time: number): number {
  return motion.smear * Math.max(0, 1 - Math.max(0, time - motion.smearUntil) / HAND_MOTION.smearDecayMs)
}
