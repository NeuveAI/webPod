/**
 * The announcer: turning motion into exactly one sentence.
 *
 * ⚑ The rule this module exists for: **a detent settle is announced once, as a
 * summary, 350ms after the motion stops.** A thirty-detent flick produces one
 * announcement, not thirty. This is universal gate U13, and the failure it
 * prevents is not cosmetic — a live region that speaks every row the highlight
 * passes over is unusable for the person it exists to serve, and the defect is
 * completely invisible to anyone not listening to it.
 *
 * So: **announce where the human ended up, never the journey.** Each new
 * movement replaces the settling summary and pushes the due time out. Only
 * stillness emits.
 *
 * The single exception is a deliberate keypress, which is announced at once:
 * one press is one decision, the result is deterministic, and the human is
 * entitled to hear it without a third of a second of silence. A *held* key is
 * not a sequence of decisions, so auto-repeat falls back to the debounce — a
 * distinction the detent reducer has already made by the time we get here.
 *
 * ## Where the timer is, and why it is not here
 *
 * Nothing in this module schedules anything. {@link noteMovement} records a due
 * time and {@link flushAnnouncer} asks whether that time has arrived. The one
 * `setTimeout` in the state package lives in the store binding, which is the
 * only place that has a clock.
 *
 * That split is not ceremony. It is what lets the thirty-detent test drive
 * thirty real detents and assert "exactly one" with plain numbers, no fake
 * timers, and no sleeping — which in turn is what makes the test trustworthy
 * as evidence rather than as a description of a mock.
 */

import { ANNOUNCE_DEBOUNCE_MS } from './contract'
import type {
  Announcement,
  AnnouncerState,
  DescribeMovementFn,
  FlushAnnouncerFn,
  NoteMovementFn,
  ScreenSnapshotSource,
} from './contract'

/**
 * Renders the highlighted row as the sentence a screen reader speaks
 * (001 §11.8).
 *
 * Human movement is `Row 4 of 18. Bad Blood, Taylor Swift.` — position first,
 * because a person who has just moved is orienting, and the row's identity is
 * only useful once they know where it sits.
 *
 * Agent movement is `Agent moved to row 15 of 42. Vienna.` — actor first,
 * because a device that moved without its owner has to say so before it says
 * anything else. This is the accessible half of the attribution model: the
 * green trail inside the wheel carries the same fact for anyone who can see
 * it, and hue is never load-bearing.
 *
 * A screen with no rows says so plainly rather than reading `Row 0 of 0`,
 * which is a sentence about the implementation.
 */
export const describeMovement: DescribeMovementFn = (snapshot, source) => {
  const { frame } = snapshot
  const total = frame.rows.length

  if (total === 0 || frame.highlightIndex < 0) {
    return `${frame.title}. No items.`
  }

  const row = frame.rows[frame.highlightIndex]
  const identity =
    row === undefined
      ? frame.title
      : row.sublabel === null
        ? row.label
        : `${row.label}, ${row.sublabel}`
  const position = `${String(frame.highlightIndex + 1)} of ${String(total)}`

  // `system` reads like a human movement on purpose. A system-caused move —
  // the queue advancing, a screen restoring — is something that happened to
  // the device rather than something an actor did to it, and naming an actor
  // for it would invite the listener to look for one.
  return source === 'agent'
    ? `Agent moved to row ${position}. ${identity}.`
    : `Row ${position}. ${identity}.`
}

/** Builds the announcement for a movement, stamping the sequence number. */
function announcementFor(
  state: AnnouncerState,
  snapshot: ScreenSnapshotSource,
  source: Parameters<DescribeMovementFn>[1],
): Announcement {
  return {
    text: describeMovement(snapshot, source),
    // Always polite. A movement the human made must never interrupt what
    // the screen reader is already saying; `assertive` is reserved for the
    // things that stop you — an error, Hold engaging, an armed irreversible
    // confirm. Navigation is not one of them.
    politeness: 'polite',
    seq: state.emitted + 1,
  }
}

/**
 * Records that the highlight moved, and decides when it will be spoken.
 *
 * ⚑ Repeated calls **replace** the settling summary; they never queue a second
 * one. Thirty detents in a flick call this thirty times and leave one settling
 * announcement, whose due time has been pushed out thirty times — so the
 * sentence that eventually comes out describes where the flick *stopped*.
 *
 * An `immediate` movement emits on the spot **and clears whatever was settling**.
 * That second half matters: a keypress that interrupts a coasting flick would
 * otherwise leave the flick's stale summary armed, and the human would hear
 * the row they pressed a key from a third of a second after they left it.
 *
 * @param state - The announcer's current state.
 * @param movement - The snapshot to describe, who caused it, the urgency the
 *   detent reducer assigned, and the timestamp the movement happened at.
 * @returns The next state, and the announcement to publish now — which is
 *   `null` for every debounced movement, including the last one in a flick.
 */
export const noteMovement: NoteMovementFn = (state, movement) => {
  if (movement.urgency === 'immediate') {
    return {
      state: { settling: null, dueAtMs: null, emitted: state.emitted + 1 },
      announcement: announcementFor(state, movement.snapshot, movement.source),
    }
  }

  return {
    state: {
      settling: { snapshot: movement.snapshot, source: movement.source },
      dueAtMs: movement.atMs + ANNOUNCE_DEBOUNCE_MS,
      emitted: state.emitted,
    },
    announcement: null,
  }
}

/**
 * Emits the settling summary if the motion has been still long enough.
 *
 * Idempotent: once it has emitted, the settling movement is cleared and further
 * calls return `null` until something moves again. A driver that fires this on
 * a timer and again on a stray wake-up therefore cannot double-speak.
 *
 * @param nowMs - The current time, on the same clock as the timestamps handed
 *   to {@link noteMovement}.
 */
export const flushAnnouncer: FlushAnnouncerFn = (state, nowMs) => {
  if (state.settling === null || state.dueAtMs === null || nowMs < state.dueAtMs) {
    return { state, announcement: null }
  }

  return {
    state: { settling: null, dueAtMs: null, emitted: state.emitted + 1 },
    announcement: announcementFor(state, state.settling.snapshot, state.settling.source),
  }
}

/**
 * Discards a settling announcement without speaking it.
 *
 * Keeps the emission count. The counter is what makes two identical sentences
 * two distinct values downstream, so resetting it here would let a repeated
 * announcement be swallowed as a no-change by whatever renders the live
 * region — a bug that is silent in the most literal sense.
 */
export function clearAnnouncer(state: AnnouncerState): AnnouncerState {
  return { ...state, settling: null, dueAtMs: null }
}
