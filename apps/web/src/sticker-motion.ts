import { estimatePointerReleaseVelocity, type PointerMotionSample } from './device-orientation-motion'

/* ANIMATION STORYBOARD ────────────────────────────────────
 *    0ms   rear face admits the pack lip
 * pointer  pull maps directly into pack travel, retaining velocity
 * release  responsive spring settles to open or tease
 * pointer  peel lifts the die cut, then follows a rear placement
 * release  landing spring retains motion and settles into the shell
 * ──────────────────────────────────────────────────────── */
export const STICKER_MOTION = Object.freeze({
  stiffness: 300, // Neuve responsive spring, unit mass
  damping: 25,
  openThreshold: 0.45,
  velocityProjectionSeconds: 0.12,
  maximumVelocity: 6, // normalized travel per second
  settleDistance: 0.001,
  settleVelocity: 0.01,
  maxOvershoot: 0.035,
})

export interface StickerSpring {
  readonly position: number
  readonly velocity: number
  readonly target: number
}

/** Analytic underdamped spring: equivalent results across frame rates and pauses. */
export function advanceStickerSpring(spring: StickerSpring, elapsedSeconds: number): StickerSpring | null {
  if (!(elapsedSeconds > 0) || !Number.isFinite(elapsedSeconds)) return spring
  const decay = STICKER_MOTION.damping / 2
  const frequency = Math.sqrt(STICKER_MOTION.stiffness - decay * decay)
  const displacement = spring.position - spring.target
  const b = (spring.velocity + decay * displacement) / frequency
  const phase = frequency * elapsedSeconds
  const retained = Math.exp(-decay * elapsedSeconds)
  const cosine = Math.cos(phase)
  const sine = Math.sin(phase)
  const rawPosition = spring.target + retained * (displacement * cosine + b * sine)
  const position = Math.min(1 + STICKER_MOTION.maxOvershoot, Math.max(-STICKER_MOTION.maxOvershoot, rawPosition))
  const velocity = position === rawPosition
    ? retained * ((-decay * displacement + frequency * b) * cosine + (-decay * b - frequency * displacement) * sine)
    : 0
  return Math.abs(position - spring.target) < STICKER_MOTION.settleDistance && Math.abs(velocity) < STICKER_MOTION.settleVelocity
    ? null : { position, velocity, target: spring.target }
}

/** Releases use recent pointer evidence; holding before release cannot replay an old flick. */
export function resolveStickerPullRelease(position: number, samples: readonly PointerMotionSample[], timestampMs: number, travelPx: number): StickerSpring {
  const pointer = estimatePointerReleaseVelocity(samples, timestampMs)
  const velocity = travelPx > 0 ? Math.min(STICKER_MOTION.maximumVelocity, Math.max(-STICKER_MOTION.maximumVelocity, -pointer.yPxPerSecond / travelPx)) : 0
  const target = position + velocity * STICKER_MOTION.velocityProjectionSeconds >= STICKER_MOTION.openThreshold ? 1 : 0
  return { position, velocity, target }
}
