/** Human and agent interactions share sound; system reconciliation stays silent. */
import type { Actor, DetentSource, HumanActor, InputPath } from './contract'

/** Whether provenance belongs to a physical human input path. */
export function isHumanActor(actor: Actor): actor is HumanActor {
  return actor === 'human:touch' || actor === 'human:mouse' || actor === 'human:key'
}

/** Agent provenance remains audible; automatic reconciliation never is. */
export function isAudibleActor(actor: Actor): actor is Exclude<Actor, 'system'> { return actor !== 'system' }

/**
 * Whether movement from this source is silent.
 *
 * The only place this question is answered. Everything that emits a click, a
 * pulse or a spring asks here.
 */
export function isSilenced(source: DetentSource): boolean {
  return source === 'system'
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
 * Counts, not effects: this reports candidate feedback, and the layer that
 * owns the speaker and actuator decides what actually happens. The 30/sec
 * clicker limit lives with the sound layer. D-063 explicitly defers the
 * conflicting high-rate haptic policies (suppress all versus every third), so
 * this function reports one candidate pulse per human touch detent and chooses
 * neither policy.
 *
 * @param detents - Signed; only the magnitude is used.
 */
export function feedbackFor(
  source: DetentSource,
  path: InputPath,
  detents: number,
): Feedback {
  const silenced = isSilenced(source)
  const count = Math.abs(detents)
  return {
    silenced,
    clickerTicks: silenced ? 0 : count,
    // Haptics exist on touch only. A mouse, a trackpad and a keyboard have no
    // actuator, and pretending otherwise would put a `navigator.vibrate` call
    // behind a gesture that cannot feel it.
    hapticPulses: source !== 'human' || path !== 'touch-arc' ? 0 : count,
  }
}
