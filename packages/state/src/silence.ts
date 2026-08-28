/**
 * The silence rule, in one place, for everything that can make a noise.
 *
 * 001 §4.7 and §15.2 #3: the clicker and the haptic actuator are gated on
 * `source !== "agent" && source !== "system"`, at **one** call site rather than
 * scattered across the call sites that produce feedback.
 *
 * ⚑ Why this is a module and not a line: the rule has more than one caller.
 * The detent reducer needs it, and so does the press handler, because a press
 * is not a detent and cannot be routed through the reducer. An earlier version
 * wrote the predicate out twice — both copies correct, and two places to
 * change a rule whose entire design argument is that there must be one. The
 * argument survives only if the predicate is a thing rather than a habit.
 *
 * The rule itself is load-bearing and not a style choice. Touch and sound are
 * the signature of a hand. A device that clicked and buzzed for something that
 * was not a hand would spend the product's best attribution channel on a lie,
 * and a phone buzzing in a pocket nobody is holding sends its owner reaching
 * for it.
 */

import { DETENT } from './contract'
import type { Actor, DetentSource, InputPath } from './contract'

/**
 * Whether movement from this source is silent.
 *
 * The only place this question is answered. Everything that emits a click, a
 * pulse or a spring asks here.
 */
export function isSilenced(source: DetentSource): boolean {
  return source !== 'human'
}

/**
 * Derives the provenance tag from the declared source and the physical path.
 *
 * ⚑ Derived, never accepted from the caller, so a tool cannot claim to be a
 * hand (001 §8.4). `agentOrigin` is only a label the tool layer may know about
 * its caller; when it knows nothing the tag reads `agent:unknown`, which
 * asserts nothing about whether an agent exists — the platform supplies no
 * such fact.
 *
 * A press has no path to distinguish a thumb from a mouse, so it passes
 * `'touch-arc'`: touch is the device's primary input.
 */
export function actorFor(
  source: DetentSource,
  path: InputPath,
  agentOrigin?: string,
): Actor {
  if (source === 'system') return 'system'
  if (source === 'agent') return `agent:${agentOrigin ?? 'unknown'}`
  if (path === 'touch-arc') return 'human:touch'
  if (path === 'mouse-arc' || path === 'scroll') return 'human:mouse'
  return 'human:key'
}

/** What a movement is allowed to make the device do, physically. */
export type Feedback = {
  readonly silenced: boolean
  readonly clickerTicks: number
  readonly hapticPulses: number
}

/**
 * The feedback budget for a movement.
 *
 * Counts, not effects: this decides what is *allowed*, and the layer that owns
 * the speaker and the actuator decides what actually happens. The 30/sec
 * clicker limit of 001 §4.9 lives with the sound layer for that reason — it is
 * a property of the speaker. The 12/sec haptic suppression lives here, because
 * it depends on the detent rate, which only this side knows.
 *
 * @param detents - Signed; only the magnitude is used.
 * @param detentsPerSecond - `0` when the rate is not yet known, which suppresses
 *   nothing: the first detent of a gesture is never the one that buzzes too much.
 */
export function feedbackFor(
  source: DetentSource,
  path: InputPath,
  detents: number,
  detentsPerSecond: number,
): Feedback {
  const silenced = isSilenced(source)
  const count = Math.abs(detents)
  return {
    silenced,
    clickerTicks: silenced ? 0 : count,
    // Haptics exist on touch only. A mouse, a trackpad and a keyboard have no
    // actuator, and pretending otherwise would put a `navigator.vibrate` call
    // behind a gesture that cannot feel it.
    hapticPulses:
      silenced ||
      path !== 'touch-arc' ||
      detentsPerSecond > DETENT.hapticSuppressAbovePerSec
        ? 0
        : count,
  }
}
