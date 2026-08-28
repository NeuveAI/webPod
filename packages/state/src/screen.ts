/**
 * The screen state machine: a stack of frames, a highlight, and a window.
 *
 * The whole design rests on one decision: **the highlight and the scroll
 * window live inside the frame, not beside it.** Pushing a screen leaves the
 * outgoing frame intact, so popping restores the human's exact position
 * without anything having to remember it. The alternative — one global
 * highlight plus a map of saved positions — has to decide what the key is, and
 * drifts the first time a screen is reachable by two routes.
 *
 * ⚑ Movement clamps; it never wraps. The ends of a list are hard stops that
 * rubber-band, because a list that wrapped would make counted navigation
 * ambiguous about where it landed: "down four" from row 2 of 3 would be
 * unanswerable.
 *
 * Everything here is pure. No clock, no counter, no store — which is what lets
 * the store stamp a monotonic `seq` onto a bump and lets a test replay a whole
 * traversal as a list of calls.
 */

import { VISIBLE_ROWS } from './contract'
import type {
  MoveHighlightFn,
  PageFn,
  PanelRow,
  PopScreenFn,
  PushScreenFn,
  ReadScreenFn,
  ScreenFrame,
  ScreenTransition,
} from './contract'

/** Clamps `value` into `[low, high]`, tolerating an empty range. */
function clamp(value: number, low: number, high: number): number {
  if (high < low) return low
  return Math.min(high, Math.max(low, value))
}

/**
 * Slides the window by the least amount that keeps `highlightIndex` visible.
 *
 * Minimum movement, not recentring. Recentring makes a one-row movement look
 * like the whole list jumped, and it means the human's eye has to re-find the
 * highlight after every single press.
 */
function windowFor(
  frame: ScreenFrame,
  highlightIndex: number,
  visibleRows: number,
): number {
  const maxStart = Math.max(0, frame.rows.length - visibleRows)
  if (highlightIndex < 0) return 0
  let start = clamp(frame.windowStart, 0, maxStart)
  if (highlightIndex < start) start = highlightIndex
  else if (highlightIndex >= start + visibleRows) start = highlightIndex - visibleRows + 1
  return clamp(start, 0, maxStart)
}

/** Replaces the top frame of a stack. */
function withTop(
  stack: readonly ScreenFrame[],
  frame: ScreenFrame,
): readonly ScreenFrame[] {
  return [...stack.slice(0, -1), frame]
}

/**
 * Moves the highlight, clamping at both ends and sliding the window to follow.
 *
 * A movement that runs into an end returns a bump: the row does not move, and
 * the device says so physically rather than by doing nothing, which reads as a
 * broken control.
 *
 * @param stack - The current stack. An empty stack is a no-op with no bump —
 *   there is nothing to move yet, and that is not an error the human caused.
 * @param rowDelta - Signed rows, already multiplied by any acceleration.
 * @param visibleRows - Rows in one viewport, for the window slide.
 */
export const moveHighlight: MoveHighlightFn = (stack, rowDelta, visibleRows) => {
  const frame = stack[stack.length - 1]
  if (frame === undefined) return { stack, bump: null }
  if (rowDelta === 0) return { stack, bump: null }

  const direction = rowDelta > 0 ? 'down' : 'up'
  if (frame.rows.length === 0) return { stack, bump: direction }

  const requested = frame.highlightIndex + rowDelta
  const highlightIndex = clamp(requested, 0, frame.rows.length - 1)
  const bump = highlightIndex === requested ? null : direction

  if (highlightIndex === frame.highlightIndex) return { stack, bump }

  return {
    stack: withTop(stack, {
      ...frame,
      highlightIndex,
      windowStart: windowFor(frame, highlightIndex, visibleRows),
    }),
    bump,
  }
}

/**
 * Jumps one full viewport (001 §4.3).
 *
 * The `⏭` / `⏮` buttons on a list screen, and `Shift+Arrow`. A page that runs
 * off the end lands *on* the end rather than refusing — the human wanted to travel
 * as far as possible in that direction and the last row is as far as possible
 * — and still bumps, so the end is legible.
 */
export const pageHighlight: PageFn = (stack, direction, visibleRows) =>
  moveHighlight(stack, direction * visibleRows, visibleRows)

/**
 * Pushes a screen, normalising its highlight and window.
 *
 * Normalising on the way in rather than trusting the caller means a frame
 * built from a provider response with a stale index cannot put the highlight
 * outside its own rows — a state from which every subsequent movement is
 * wrong.
 */
export const pushScreen: PushScreenFn = (stack, frame) => {
  const visibleRows = VISIBLE_ROWS[frame.density]
  const highlightIndex =
    frame.rows.length === 0 ? -1 : clamp(frame.highlightIndex, 0, frame.rows.length - 1)
  return {
    stack: [
      ...stack,
      { ...frame, highlightIndex, windowStart: windowFor(frame, highlightIndex, visibleRows) },
    ],
    bump: null,
  }
}

/**
 * Pops one level, restoring the previous frame exactly as it was left.
 *
 * ⚑ At the root this is **never** a no-op: the stack is unchanged and the
 * transition carries a rightward bump. The device is the whole application, so
 * there is no "exit" — and a Menu button that did nothing at the top would
 * read as broken rather than as "this is the top". The bump is the answer.
 */
export const popScreen: PopScreenFn = (stack) => {
  if (stack.length <= 1) return { stack, bump: 'right' }
  return { stack: stack.slice(0, -1), bump: null }
}

/**
 * Replaces the whole stack, for a jump that is not a push or a pop.
 *
 * `Menu` held for 600ms jumps to the main menu, and a navigation tool may ask
 * for a screen by id. Both discard the intervening levels rather than popping
 * them one at a time, because the levels between are not places the human
 * passed through.
 */
export function resetStack(frames: readonly ScreenFrame[]): ScreenTransition {
  return frames.reduce<ScreenTransition>(
    (transition, frame) => pushScreen(transition.stack, frame),
    { stack: [], bump: null },
  )
}

/**
 * Projects a frame into the enumerable screen description.
 *
 * ⚑ The field names are the navigation tool's, not ours. A later stage
 * serialises this straight to a caller, so renaming a field here changes a
 * published payload.
 *
 * Row `index` stays absolute even when the rows are windowed, so a row read
 * out of a partial view still says where it is in the whole list — otherwise a
 * reader given the visible rows that then said "move to row 3"
 * would mean a different row than the one it was told about.
 */
export const readScreen: ReadScreenFn = (source, options) => {
  const { face, frame, agentActive } = source
  const visibleRows = VISIBLE_ROWS[frame.density]
  const rows: readonly PanelRow[] =
    options?.includeOffscreenRows === true
      ? frame.rows
      : frame.rows.slice(frame.windowStart, frame.windowStart + visibleRows)

  return {
    face,
    screenId: frame.screenId,
    title: frame.title,
    density: frame.density,
    rows,
    highlightIndex: frame.highlightIndex,
    totalRows: frame.rows.length,
    visibleRows,
    agentActive,
  }
}
