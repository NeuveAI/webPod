/**
 * The detent reducer: the one place raw input becomes countable movement.
 *
 * Five input paths converge here — a thumb arc, a mouse arc, a scroll, an
 * arrow key, and a programmatic detent count — and they leave as the same
 * thing: a signed number of detents, a row delta, and a feedback budget. That
 * convergence is not tidiness. It is what makes the wheel behave identically
 * however it is driven, and it is what gives the silence rule a single place
 * to live.
 *
 * ⚑ Two invariants are worth more than the rest of this file:
 *
 * - **One keydown is exactly one detent. Always. No acceleration, ever.**
 *   Counted navigation is how a keyboard, switch-control or screen-reader user
 *   drives this device. An acceleration curve turns "press down four times"
 *   into "arrive somewhere near row 4". `Shift+Arrow` supplies speed and stays
 *   exact. The same holds for programmatic movement: an agent asking for 14
 *   lands on row 15, not near it.
 * - **Sound and vibration are gated once, here.** `source` decides, and the
 *   decision is reported as {@link DetentOutcome.silenced} so a call site
 *   cannot re-derive it wrongly. Touch and sound are the signature of a hand;
 *   a device that clicked and buzzed for something that was not a hand would
 *   spend the product's best attribution channel on a lie.
 */

import { DETENT, IDLE_DETENT_ACCUMULATOR, KEY_REPEAT_WINDOW_MS } from './contract'
import type {
  Actor,
  DetentAccumulator,
  DetentFn,
  DetentInput,
  DetentOutcome,
  DetentSource,
  EndGestureFn,
  InputPath,
} from './contract'

/** The row multipliers acceleration is allowed to choose between (001 §4.4). */
const MULTIPLIERS: readonly number[] = [DETENT.rowsSlow, DETENT.rowsFast, DETENT.rowsFaster]

/**
 * Converts a `WheelEvent`'s delta into pixels.
 *
 * `deltaMode` is not cosmetic: Firefox reports lines and some configurations
 * report pages, so a reducer that trusted `deltaY` directly would move three
 * rows on one browser and forty-eight on another for the same physical
 * gesture.
 */
function scrollDeltaToPx(deltaY: number, deltaMode: 0 | 1 | 2, viewportPx: number): number {
  if (deltaMode === 1) return deltaY * DETENT.scrollLineToPx
  if (deltaMode === 2) return deltaY * viewportPx
  return deltaY
}

/**
 * The raw row multiplier for an angular speed, before smoothing.
 *
 * The mouse path uses the same curve with both thresholds scaled up, because a
 * mouse arc is jerkier than a thumb arc and the touch thresholds fire
 * fast-scroll on movements the human meant as slow.
 */
function rawMultiplier(path: InputPath, speedDegPerSec: number): number {
  const scale = path === 'mouse-arc' ? DETENT.mouseAccelScale : 1
  if (speedDegPerSec > DETENT.fasterThresholdDegPerSec * scale) return DETENT.rowsFaster
  if (speedDegPerSec > DETENT.fastThresholdDegPerSec * scale) return DETENT.rowsFast
  return DETENT.rowsSlow
}

/**
 * Averages the recent raw multipliers and snaps the result to the nearest
 * allowed one.
 *
 * Snapping matters: the mean of `[1, 1, 7]` is 3, an allowed multiplier, but
 * the mean of `[1, 3, 7]` is 3.67, and moving 3.67 rows is not a thing a list
 * can do. Averaging first is what stops the multiplier jumping from 1 to 7
 * between two consecutive detents in the middle of a flick, which is the
 * moment the human is least able to correct for it.
 */
function smoothMultiplier(recent: readonly number[]): number {
  if (recent.length === 0) return DETENT.rowsSlow
  const mean = recent.reduce((sum, value) => sum + value, 0) / recent.length
  let best: number = DETENT.rowsSlow
  for (const candidate of MULTIPLIERS) {
    if (Math.abs(candidate - mean) < Math.abs(best - mean)) best = candidate
  }
  return best
}

/** Keeps the smoothing window at its configured length, newest last. */
function pushMultiplier(recent: readonly number[], value: number): readonly number[] {
  const next = [...recent, value]
  return next.length <= DETENT.multiplierSmoothingDetents
    ? next
    : next.slice(next.length - DETENT.multiplierSmoothingDetents)
}

/**
 * Derives the provenance tag from the declared source and the physical path.
 *
 * ⚑ Derived here rather than accepted from the caller, so a tool cannot claim
 * to be a hand (001 §8.4). `agentOrigin` is only a label the tool layer may
 * know; when it knows nothing the tag reads `agent:unknown`, which asserts
 * nothing about whether an agent exists.
 */
function actorFor(source: DetentSource, path: InputPath, agentOrigin?: string): Actor {
  if (source === 'system') return 'system'
  if (source === 'agent') return `agent:${agentOrigin ?? 'unknown'}`
  if (path === 'touch-arc') return 'human:touch'
  if (path === 'mouse-arc' || path === 'scroll') return 'human:mouse'
  return 'human:key'
}

/**
 * Starts a fresh gesture when the incoming path is not the one in flight.
 *
 * Residual travel is path-specific — degrees do not carry over into pixels —
 * so switching paths mid-flight resets rather than mixing units.
 */
function baseFor(accumulator: DetentAccumulator, path: InputPath): DetentAccumulator {
  if (accumulator.path === path) return accumulator
  return { ...IDLE_DETENT_ACCUMULATOR, path }
}

/**
 * Splits accumulated travel into whole detents.
 *
 * The first detent of a gesture costs the dead zone; every later one costs the
 * ordinary amount. That asymmetry is the whole point of a dead zone: it stops
 * a resting thumb's tremor from moving the list, without taxing the rest of
 * the movement.
 */
function drainDetents(
  residual: number,
  armed: boolean,
  perDetent: number,
  deadZone: number,
): { detents: number; residual: number; armed: boolean } {
  let remaining = residual
  let isArmed = armed
  let detents = 0

  if (!isArmed) {
    if (Math.abs(remaining) < deadZone) return { detents: 0, residual: remaining, armed: false }
    const direction = Math.sign(remaining)
    remaining -= direction * deadZone
    detents += direction
    isArmed = true
  }

  while (Math.abs(remaining) >= perDetent) {
    const direction = Math.sign(remaining)
    remaining -= direction * perDetent
    detents += direction
  }

  return { detents, residual: remaining, armed: isArmed }
}

/**
 * Turns one measured input event into countable, deterministic movement.
 *
 * Pure: it neither reads a clock nor touches the store, so a whole 30-detent
 * flick can be replayed in a test with nothing but an array of timestamps.
 *
 * @param accumulator - Gesture state. Pass {@link IDLE_DETENT_ACCUMULATOR} to
 *   begin, and thread {@link DetentOutcome.accumulator} through afterwards.
 * @param input - One measured event.
 * @returns The movement, the feedback budget and the next accumulator. The
 *   arguments are never mutated.
 */
export const detent: DetentFn = (accumulator, input) => {
  const base = baseFor(accumulator, input.path)
  const agentOrigin = 'agentOrigin' in input ? input.agentOrigin : undefined
  const actor = actorFor(input.source, input.path, agentOrigin)

  let detents: number
  let multiplier: number
  let rowDelta: number
  let next: DetentAccumulator = { ...base, lastEventMs: input.timestampMs }

  if (input.path === 'scroll') {
    const drained = drainDetents(
      base.residualPx + scrollDeltaToPx(input.deltaY, input.deltaMode, input.viewportPx),
      base.armed,
      DETENT.scrollPxPerDetent,
      DETENT.scrollDeadZonePx,
    )

    // No velocity multiplier on this path, deliberately. Trackpad momentum
    // already supplies acceleration; multiplying it a second time makes a list
    // impossible to stop where you meant to.
    detents = drained.detents
    multiplier = DETENT.rowsSlow
    rowDelta = detents
    next = { ...next, residualPx: drained.residual, armed: drained.armed }
  } else if (input.path === 'key') {
    // Exactly one detent. Not "usually one", not "one unless the key repeats".
    detents = input.direction
    multiplier = input.page ? input.pageRows : DETENT.rowsSlow
    rowDelta = detents * multiplier
    next = { ...next, armed: true }
  } else if (input.path === 'direct') {
    // A programmatic count, already discretised. No acceleration: determinism
    // is the entire reason this path exists.
    detents = Math.trunc(input.detents)
    multiplier = DETENT.rowsSlow
    rowDelta = detents
    next = { ...next, armed: true }
  } else {
    const elapsedSec =
      base.lastEventMs === null ? 0 : (input.timestampMs - base.lastEventMs) / 1000
    const speedDegPerSec =
      elapsedSec > 0 ? Math.abs(input.angleDeg) / elapsedSec : base.speedDegPerSec

    const drained = drainDetents(
      base.residualDeg + input.angleDeg,
      base.armed,
      DETENT.arcDegPerDetent,
      input.path === 'touch-arc' ? DETENT.touchDeadZoneDeg : DETENT.mouseDeadZoneDeg,
    )

    let recent = base.recentMultipliers
    for (let i = 0; i < Math.abs(drained.detents); i += 1) {
      recent = pushMultiplier(recent, rawMultiplier(input.path, speedDegPerSec))
    }

    detents = drained.detents
    multiplier =
      drained.detents === 0 ? smoothMultiplier(base.recentMultipliers) : smoothMultiplier(recent)
    rowDelta = detents * multiplier
    next = {
      ...next,
      residualDeg: drained.residual,
      armed: drained.armed,
      speedDegPerSec,
      recentMultipliers: recent,
    }
  }

  const sinceLastDetentMs =
    base.lastDetentMs === null ? null : input.timestampMs - base.lastDetentMs
  const detentsPerSecond =
    detents === 0 || sinceLastDetentMs === null || sinceLastDetentMs <= 0
      ? 0
      : (Math.abs(detents) * 1000) / sinceLastDetentMs

  if (detents !== 0) next = { ...next, lastDetentMs: input.timestampMs }

  // ⚑ THE SILENCE RULE, enforced once, here (001 §4.7, §15.2). Everything that
  // reads as a hand — the clicker and the haptic actuator — is refused to
  // anything that is not one. There is no second place to change this.
  const silenced = input.source !== 'human'
  const clickerTicks = silenced ? 0 : Math.abs(detents)
  const hapticPulses =
    silenced ||
    input.path !== 'touch-arc' ||
    detentsPerSecond > DETENT.hapticSuppressAbovePerSec
      ? 0
      : Math.abs(detents)

  return {
    accumulator: next,
    detents,
    rowDelta,
    multiplier,
    detentsPerSecond,
    clickerTicks,
    hapticPulses,
    silenced,
    actor,
    announce: announceUrgencyFor(input, sinceLastDetentMs),
  } satisfies DetentOutcome
}

/**
 * Decides whether a movement is announced at once or folded into a summary.
 *
 * A single keypress is deterministic and the human is entitled to hear the
 * result immediately. A *held* key is not a sequence of decisions, it is one,
 * so once the operating system starts repeating we fall back to the debounced
 * summary — otherwise the live region reads out every row the highlight passes
 * over, which is unusable at any repeat rate.
 */
function announceUrgencyFor(
  input: DetentInput,
  sinceLastDetentMs: number | null,
): DetentOutcome['announce'] {
  if (input.path !== 'key') return 'debounced'
  if (sinceLastDetentMs !== null && sinceLastDetentMs < KEY_REPEAT_WINDOW_MS) return 'debounced'
  return 'immediate'
}

/**
 * Ends a gesture, discarding residual travel below one detent.
 *
 * ⚑ The residual is dropped, never rounded up. Rounding fires a detent the
 * human did not ask for at the end of every gesture that stops mid-detent —
 * which is nearly all of them — and the resulting extra row is invisible to
 * whoever wrote the rounding and infuriating to whoever uses it.
 */
export const endGesture: EndGestureFn = () => IDLE_DETENT_ACCUMULATOR
