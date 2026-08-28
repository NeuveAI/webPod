/**
 * The store, and the actions that write to it.
 *
 * ⚑ The property this module exists to guarantee: **every piece of device
 * state is readable, writable and subscribable from outside React.** The store
 * is a plain object with `get`, `set` and `sub`; the atoms are module-level
 * values; nothing here needs a component, a provider or a render to work.
 *
 * That is a capability requirement rather than a preference. Tool callbacks
 * run outside the React tree and have to reach the same state the UI renders.
 * State living in a component closure is unreachable from one — not
 * inconvenient, unreachable — which is why React's component-local state hook
 * is banned repo-wide, by lint, with no exception for "local" or "trivial"
 * state. A collapsed section held in a closure is a collapsed section no tool
 * can ever open.
 *
 * The React binding, when it exists, is a `Provider` handed this same store.
 * React reads it; it does not own it.
 *
 * Actions are write-only atoms rather than exported functions taking a store,
 * so that a caller cannot accidentally read from one store and write to
 * another, and so that a sequence of writes lands as one notification.
 */

import { atom, createStore } from 'jotai/vanilla'

import { flushAnnouncer, noteMovement } from './announce'
import {
  IDLE_DETENT_ACCUMULATOR,
  agentActiveAtom,
  announcerAtom,
  bumpAtom,
  currentScreenAtom,
  densityAtom,
  detentAccumulatorAtom,
  faceAtom,
  highlightIndexAtom,
  liveRegionAtom,
  screenStackAtom,
  visibleRowCountAtom,
} from './contract'
import type {
  Actor,
  Announcement,
  BumpDirection,
  BumpEvent,
  DetentInput,
  DetentOutcome,
  DeviceStore,
  PressInput,
  PressOutcome,
  ScreenFrame,
  ScreenSnapshotSource,
} from './contract'
import { detent, endGesture } from './detent'
import { MENU_ROOT, menuFrame } from './menu'
import { moveHighlight, pageHighlight, popScreen, pushScreen } from './screen'

/**
 * Publishes a bump, stamping it with a monotonic sequence number.
 *
 * The sequence number is what makes two identical bumps two distinct values.
 * Without it a subscriber that rubber-bands rightward twice in a row would see
 * no change on the second one and play nothing, and the human would conclude
 * the second press was swallowed.
 */
const publishBumpAtom = atom(
  null,
  (get, set, direction: BumpDirection, at: number): BumpEvent => {
    const previous = get(bumpAtom)
    const event: BumpEvent = { direction, seq: (previous?.seq ?? 0) + 1, at }
    set(bumpAtom, event)
    return event
  },
)

/**
 * Moves the highlight on the current screen by a signed number of rows.
 *
 * Takes rows rather than detents: the detent reducer has already applied any
 * acceleration, and this atom must behave identically whether the rows came
 * from a flick, a keypress or a tool call.
 *
 * @returns The bump that was published, or `null` if the movement landed.
 */
export const moveHighlightActionAtom = atom(
  null,
  (get, set, rowDelta: number, at: number): BumpEvent | null => {
    const transition = moveHighlight(get(screenStackAtom), rowDelta, get(visibleRowCountAtom))
    set(screenStackAtom, transition.stack)
    return transition.bump === null ? null : set(publishBumpAtom, transition.bump, at)
  },
)

/** Pushes a screen. The outgoing frame keeps its highlight and its window. */
export const pushScreenActionAtom = atom(null, (get, set, frame: ScreenFrame): void => {
  set(screenStackAtom, pushScreen(get(screenStackAtom), frame).stack)
})

/**
 * Pops one level, or bumps at the root.
 *
 * @returns The root bump, or `null` when a level was actually popped.
 */
export const popScreenActionAtom = atom(null, (get, set, at: number): BumpEvent | null => {
  const transition = popScreen(get(screenStackAtom))
  set(screenStackAtom, transition.stack)
  return transition.bump === null ? null : set(publishBumpAtom, transition.bump, at)
})

/**
 * Replaces the entire stack — the `Menu`-held jump to the main menu, and a
 * navigation tool asking for a screen by id.
 */
export const resetStackActionAtom = atom(
  null,
  (_get, set, frames: readonly ScreenFrame[]): void => {
    set(
      screenStackAtom,
      frames.reduce<readonly ScreenFrame[]>(
        (stack, frame) => pushScreen(stack, frame).stack,
        [],
      ),
    )
  },
)

/**
 * Derives the provenance tag for a press.
 *
 * A press has no input path to distinguish a thumb from a mouse, so a human
 * press is tagged as touch — the device's primary input. As with the detent
 * reducer, the tag is derived here and never accepted from the caller.
 */
function pressActor(input: PressInput): Actor {
  if (input.source === 'system') return 'system'
  if (input.source === 'agent') return `agent:${input.agentOrigin ?? 'unknown'}`
  return 'human:touch'
}

/**
 * Applies a button press to the screen stack.
 *
 * `Menu` ascends, or bumps at the root. `⏭` and `⏮` page by one viewport —
 * paging, deliberately, and not selecting, so that "only Center commits"
 * survives the transport buttons doing something on a list.
 *
 * ⚑ `Center` returns `handled: false` and changes nothing. This is a boundary,
 * not a gap: the machine owns the stack, and the layer holding the data owns
 * what a row points at. A row on the main menu descends into a known screen; a
 * row on an album is a track and descending means playing it. Guessing here
 * would put half the navigation model in the wrong module. The caller reads
 * `handled` and pushes the frame it knows how to build.
 *
 * The silence rule applies to the clicker on a press exactly as it does to a
 * detent: an agent's press is visible and silent.
 */
export const pressActionAtom = atom(null, (get, set, input: PressInput): PressOutcome => {
  const actor = pressActor(input)
  const silenced = input.source !== 'human'

  let bump: BumpDirection | null = null
  let handled = true

  if (input.button === 'menu') {
    const transition = popScreen(get(screenStackAtom))
    set(screenStackAtom, transition.stack)
    bump = transition.bump
  } else if (input.button === 'next' || input.button === 'previous') {
    const transition = pageHighlight(
      get(screenStackAtom),
      input.button === 'next' ? 1 : -1,
      get(visibleRowCountAtom),
    )
    set(screenStackAtom, transition.stack)
    bump = transition.bump
  } else {
    handled = false
  }

  if (bump !== null) set(publishBumpAtom, bump, input.timestampMs)

  return {
    button: input.button,
    stack: get(screenStackAtom),
    bump,
    handled,
    actor,
    silenced,
    clickerTicks: silenced ? 0 : 1,
  }
})

/** Options for {@link createDeviceStore}. */
export type CreateDeviceStoreOptions = {
  /**
   * The stack to start on. Defaults to the main menu at the default density.
   *
   * The default is not a convenience: 001 §15.1 requires the main menu's rows
   * to render on the first frame and never to wait on a network call, so
   * the store is born with them.
   */
  readonly initialStack?: readonly ScreenFrame[]
}

/**
 * Creates an isolated device store.
 *
 * Each call returns a store with its own state, so a test never sees another
 * test's screen stack. The application uses the {@link deviceStore} singleton;
 * this factory exists for tests and for any surface that needs a second,
 * genuinely separate device.
 */
export function createDeviceStore(options: CreateDeviceStoreOptions = {}): DeviceStore {
  const store = createStore()
  const initial = options.initialStack ?? [menuFrame(MENU_ROOT, store.get(densityAtom))]
  store.set(screenStackAtom, initial)
  return store
}

/**
 * The application's device store.
 *
 * A module singleton on purpose. A tool callback registered at module scope and
 * a React tree mounted later must address the *same* device; a store created
 * inside a component would give them one each, and the tool would move a screen
 * nobody is looking at.
 */
export const deviceStore: DeviceStore = createDeviceStore()

/**
 * Resets a store's transient input state.
 *
 * Only the gesture accumulator: a half-finished flick is not a fact worth
 * keeping across a teardown, whereas the screen stack, the density and the
 * device state all are.
 */
export function resetInputState(store: DeviceStore): void {
  store.set(detentAccumulatorAtom, IDLE_DETENT_ACCUMULATOR)
}

/* ────────────────────────────────────────────────────────────────────────────
 * Detent, and the announcement that follows it
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The whole wheel, end to end: one measured input becomes movement, feedback
 * and — eventually — one sentence.
 *
 * ⚑ This is the only place the four input paths meet the screen stack, which
 * is what makes the silence rule and the announcement rule enforceable at all.
 * A second path from an event handler to `screenStackAtom` would be a second
 * place to forget them.
 *
 * A movement that changes nothing announces nothing. Running into the end of a
 * list already says so physically, with a bump; repeating "Row 18 of 18" for
 * every further detent of the same flick would be the live-region spam this
 * whole module exists to prevent, in a smaller costume.
 *
 * @returns The reducer's outcome, so the caller can play the clicker, the
 *   haptic and the FX it describes.
 */
export const detentActionAtom = atom(null, (get, set, input: DetentInput): DetentOutcome => {
  const outcome = detent(get(detentAccumulatorAtom), input)
  set(detentAccumulatorAtom, outcome.accumulator)

  if (outcome.rowDelta === 0) return outcome

  const before = get(highlightIndexAtom)
  set(moveHighlightActionAtom, outcome.rowDelta, input.timestampMs)
  const frame = get(currentScreenAtom)

  if (frame === null || get(highlightIndexAtom) === before) return outcome

  const snapshot: ScreenSnapshotSource = {
    face: get(faceAtom),
    frame,
    agentActive: get(agentActiveAtom),
  }

  const noted = noteMovement(get(announcerAtom), {
    snapshot,
    urgency: outcome.announce,
    source: input.source,
    atMs: input.timestampMs,
  })
  set(announcerAtom, noted.state)
  if (noted.announcement !== null) set(liveRegionAtom, noted.announcement)

  return outcome
})

/**
 * Ends a gesture: drops sub-detent residual, and speaks the settled position
 * if the debounce has elapsed.
 *
 * @returns The announcement that was published, or `null`.
 */
export const endGestureActionAtom = atom(null, (get, set, nowMs: number): Announcement | null => {
  set(detentAccumulatorAtom, endGesture(get(detentAccumulatorAtom)))
  return set(flushAnnouncementsActionAtom, nowMs)
})

/**
 * Publishes the settling movement's announcement if it is due.
 *
 * Safe to call on any schedule, including too often: {@link flushAnnouncer} is
 * idempotent, so a driver that wakes up early emits nothing and a driver that
 * wakes up twice emits once.
 */
export const flushAnnouncementsActionAtom = atom(
  null,
  (get, set, nowMs: number): Announcement | null => {
    const flushed = flushAnnouncer(get(announcerAtom), nowMs)
    set(announcerAtom, flushed.state)
    if (flushed.announcement !== null) set(liveRegionAtom, flushed.announcement)
    return flushed.announcement
  },
)

/**
 * A timer handle.
 *
 * Widened deliberately: `setTimeout` returns a `number` in the browser and a
 * `Timeout` object under Bun and Node, and this package is compiled against
 * both lib sets. Narrowing to either one would make the driver un-typeable in
 * the other environment, and the handle is only ever passed straight back to
 * the matching `clearTimeout`.
 */
export type TimerHandle = number | ReturnType<typeof setTimeout>

/** Injection points for {@link startAnnouncer}, so a test can drive its own clock. */
export type AnnouncerDriverOptions = {
  readonly now?: () => number
  readonly setTimer?: (callback: () => void, ms: number) => TimerHandle
  readonly clearTimer?: (handle: TimerHandle) => void
}

/**
 * Starts the one timer in this package.
 *
 * ⚑ Exactly one, and it lives here rather than in the announcer, because the
 * announcer must stay a pure function of `(state, time)` for the thirty-detent
 * gate to be provable without mocks.
 *
 * It subscribes to the announcer's state and keeps a single armed timeout
 * aimed at the current due time. Every new movement pushes that time out and
 * re-aims the same timer, so a flick of any length holds one timeout and
 * produces one sentence when it stops.
 *
 * @returns An unsubscribe function that also cancels the armed timeout.
 *   Call it on teardown; a timer that outlives its store would speak about a
 *   device nobody is looking at.
 */
export function startAnnouncer(
  store: DeviceStore,
  options: AnnouncerDriverOptions = {},
): () => void {
  const now = options.now ?? (() => Date.now())
  const setTimer = options.setTimer ?? setTimeout
  const clearTimer = options.clearTimer ?? clearTimeout

  let handle: TimerHandle | null = null

  const cancel = (): void => {
    if (handle !== null) {
      clearTimer(handle)
      handle = null
    }
  }

  const arm = (): void => {
    cancel()
    const dueAtMs = store.get(announcerAtom).dueAtMs
    if (dueAtMs === null) return
    handle = setTimer(() => {
      handle = null
      store.set(flushAnnouncementsActionAtom, now())
    }, Math.max(0, dueAtMs - now()))
  }

  const unsubscribe = store.sub(announcerAtom, arm)
  arm()

  return () => {
    cancel()
    unsubscribe()
  }
}
