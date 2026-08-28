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
  CoastStepFn,
  DetentAccumulator,
  DetentFn,
  DetentInput,
  DetentOutcome,
  EndGestureFn,
  InputPath,
} from './contract'
import { actorFor, feedbackFor } from './silence'

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
export const detent: DetentFn = (accumulator, input, viewportRows) => {
  const base = baseFor(accumulator, input.path)
  const agentOrigin = 'agentOrigin' in input ? input.agentOrigin : undefined
  const actor = actorFor(input.source, input.path, agentOrigin)

  let detents: number
  let multiplier: number
  let rowDelta: number
  let accelerated = false
  let next: DetentAccumulator = {
    ...base,
    lastEventMs: input.timestampMs,
    source: input.source,
    coasting: false,
  }

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
    // `Shift` is one full viewport, and how big that is comes from the store,
    // which is the only thing that knows the effective density. It is never a
    // number the event carried in — that is how a flat page size slips past
    // the density ruling and leaves a row nobody can reach.
    multiplier = input.page ? viewportRows : DETENT.rowsSlow
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
    accelerated = multiplier > DETENT.rowsSlow
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

  if (detents !== 0) {
    next = {
      ...next,
      lastDetentMs: input.timestampMs,
      direction: detents > 0 ? 1 : -1,
    }
  }

  // ⚑ THE SILENCE RULE. Asked once, of `feedbackFor`, which is the only place
  // in the package that answers it — for the coast below as well as for this
  // event, and for presses over in the store. See `silence.ts`.
  const feedback = feedbackFor(input.source, input.path, detents, detentsPerSecond)

  return {
    accumulator: next,
    detents,
    rowDelta,
    multiplier,
    accelerated,
    detentsPerSecond,
    ...feedback,
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
 * Lifts the finger: drops sub-detent residual, keeps the momentum.
 *
 * ⚑ The residual is dropped, never rounded up. Rounding fires a detent the
 * human did not make at the end of every gesture that stops mid-detent — which
 * is nearly all of them — and the resulting extra row is invisible to whoever
 * wrote the rounding and infuriating to whoever uses it.
 *
 * ⚑ The momentum is kept. 001 §4.4's Release row says the wheel coasts, and an
 * earlier version of this function returned the idle accumulator — throwing
 * away `speedDegPerSec`, the one quantity a coast needs, so that no consumer
 * could have implemented the coast either. Now an arc released above the floor
 * comes back `coasting`, and {@link coastStep} finishes the gesture.
 *
 * Only the arc paths coast. There is no momentum in a keypress, a scroll ends
 * when the events stop, and a programmatic movement has already said exactly
 * how far it wanted to go.
 */
export const endGesture: EndGestureFn = (accumulator) => {
  const isArc = accumulator.path === 'touch-arc' || accumulator.path === 'mouse-arc'
  const coasts =
    isArc &&
    accumulator.direction !== 0 &&
    accumulator.speedDegPerSec >= DETENT.coastFloorDegPerSec

  if (!coasts) return IDLE_DETENT_ACCUMULATOR

  return {
    ...IDLE_DETENT_ACCUMULATOR,
    path: accumulator.path,
    source: accumulator.source,
    direction: accumulator.direction,
    speedDegPerSec: accumulator.speedDegPerSec,
    recentMultipliers: accumulator.recentMultipliers,
    lastDetentMs: accumulator.lastDetentMs,
    // Already armed: the dead zone was paid when the gesture started, and
    // making the coast pay it again would swallow its first detent.
    armed: true,
    coasting: true,
  }
}

/**
 * Advances a coasting wheel by one frame (001 §4.4, Release row).
 *
 * Decays the angular velocity by {@link DETENT.coastDecayPerFrame}, converts
 * whatever distance that leaves into detents at 15° each, and stops below
 * {@link DETENT.coastFloorDegPerSec}. Every detent it produces is a real
 * detent — it clicks, it can buzz, and it obeys the silence rule through the
 * `source` the accumulator carried out of the gesture, which is the reason
 * that field exists.
 *
 * Returns `detents: 0` and an idle accumulator once the wheel is at rest, so a
 * caller can drive it until `accumulator.coasting` is `false` and stop.
 */
export const coastStep: CoastStepFn = (accumulator, frameSeconds) => {
  const source = accumulator.source ?? 'human'
  const path = accumulator.path ?? 'touch-arc'

  if (!accumulator.coasting || accumulator.direction === 0) {
    return {
      accumulator: IDLE_DETENT_ACCUMULATOR,
      detents: 0,
      rowDelta: 0,
      multiplier: DETENT.rowsSlow,
      accelerated: false,
      detentsPerSecond: 0,
      ...feedbackFor(source, path, 0, 0),
      actor: actorFor(source, path),
      announce: 'debounced',
    } satisfies DetentOutcome
  }

  const speedDegPerSec = accumulator.speedDegPerSec * DETENT.coastDecayPerFrame
  const travelDeg = speedDegPerSec * frameSeconds * accumulator.direction

  const drained = drainDetents(
    accumulator.residualDeg + travelDeg,
    true,
    DETENT.arcDegPerDetent,
    DETENT.arcDegPerDetent,
  )

  // The multiplier keeps coasting at the speed the hand left it at, decaying
  // with the velocity. A flick that was moving 7 rows per detent does not
  // become a 1-row crawl the instant the thumb lifts; it slows down.
  let recent = accumulator.recentMultipliers
  for (let i = 0; i < Math.abs(drained.detents); i += 1) {
    recent = pushMultiplier(recent, rawMultiplier(path, speedDegPerSec))
  }
  const multiplier =
    drained.detents === 0 ? smoothMultiplier(accumulator.recentMultipliers) : smoothMultiplier(recent)

  const stillCoasting = speedDegPerSec >= DETENT.coastFloorDegPerSec
  const detentsPerSecond =
    drained.detents === 0 || frameSeconds <= 0 ? 0 : Math.abs(drained.detents) / frameSeconds

  const next: DetentAccumulator = stillCoasting
    ? {
        ...accumulator,
        speedDegPerSec,
        residualDeg: drained.residual,
        recentMultipliers: recent,
      }
    : IDLE_DETENT_ACCUMULATOR

  return {
    accumulator: next,
    detents: drained.detents,
    rowDelta: drained.detents * multiplier,
    multiplier,
    accelerated: multiplier > DETENT.rowsSlow,
    detentsPerSecond,
    ...feedbackFor(source, path, drained.detents, detentsPerSecond),
    actor: actorFor(source, path),
    // A coast is the tail of a flick, and the flick already scheduled a
    // summary. Announcing per coasted detent would put the U13 spam back.
    announce: 'debounced',
  } satisfies DetentOutcome
}
