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
import type { Getter, Setter } from 'jotai/vanilla'

import { flushAnnouncer, noteMovement } from './announce'
import {
  IDLE_DETENT_ACCUMULATOR,
  agentActiveAtom,
  announcerAtom,
  bumpAtom,
  clockAtom,
  currentScreenAtom,
  densityOverrideAtom,
  detentAccumulatorAtom,
  dynamicTypeScaleAtom,
  effectiveDensityAtom,
  faceAtom,
  highlightIndexAtom,
  liveRegionAtom,
  screenStackAtom,
  visibleRowCountAtom,
} from './contract'
import type {
  Announcement,
  BumpDirection,
  BumpEvent,
  Clock,
  Density,
  DetentInput,
  DetentOutcome,
  DeviceStore,
  MenuVisibility,
  PressInput,
  PressOutcome,
  ScreenFrame,
  ScreenSnapshotSource,
} from './contract'
import { coastStep, detent, endGesture } from './detent'
import { MENU_ROOT, menuFrame } from './menu'
import { actorFor, isSilenced } from './silence'
import { moveHighlight, pageHighlight, popScreen, pushScreen } from './screen'

/**
 * Publishes a bump, stamping it with a monotonic sequence number.
 *
 * The sequence number is what makes two identical bumps two distinct values.
 * Without it a subscriber that rubber-bands rightward twice in a row would see
 * no change on the second one and play nothing, and the human would conclude
 * the second press was swallowed.
 */
const publishBumpAtom = atom(null, (get, set, direction: BumpDirection): BumpEvent => {
  const previous = get(bumpAtom)
  // ⚑ The device clock, not a caller's time. `BumpEvent.at` is a published
  // field on one atom with three writers, and two of them used to stamp
  // whatever the caller passed — so a wheel bump carried a `performance.now`
  // reading and a `Menu` bump carried a `Date.now` one, on the same device, in
  // the same field, chosen by which control the human touched. A panel ageing
  // a bump with `now - bump.at` got a sane answer for one and a number near
  // 1.7e12 for the other. This is the announcer's two-clock defect one seam
  // over; the remedy is the same one, applied the same way.
  const event: BumpEvent = {
    direction,
    seq: (previous?.seq ?? 0) + 1,
    at: get(clockAtom).now(),
  }
  set(bumpAtom, event)
  return event
})

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
  (get, set, rowDelta: number): BumpEvent | null => {
    const transition = moveHighlight(get(screenStackAtom), rowDelta, get(visibleRowCountAtom))
    set(screenStackAtom, transition.stack)
    return transition.bump === null ? null : set(publishBumpAtom, transition.bump)
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
export const popScreenActionAtom = atom(null, (get, set): BumpEvent | null => {
  const transition = popScreen(get(screenStackAtom))
  set(screenStackAtom, transition.stack)
  return transition.bump === null ? null : set(publishBumpAtom, transition.bump)
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
  // The same two derivations the reducer uses, from the same module. A press
  // cannot go through `detent()` — it is not a detent — so this is a second
  // *caller* of the rule, which is fine; what would not be fine is a second
  // copy of the rule.
  const actor = actorFor(input.source, 'touch-arc', input.agentOrigin)
  const silenced = isSilenced(input.source)

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

  if (bump !== null) set(publishBumpAtom, bump)

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

/**
 * Sets the human's density preference, or clears it back to per-screen.
 *
 * ⚑ Writing {@link densityOverrideAtom} directly works too, and is deliberately
 * left possible: everything downstream reads {@link effectiveDensityAtom}, so
 * the viewport size, the page size and the reported snapshot all move together
 * with no reconciliation step to forget. This atom exists because the *window*
 * still needs re-clamping — a `compact` window of 8 rows starting at row 40 is
 * out of range once `airy` cuts the viewport to 4 — and that is a stack edit,
 * which belongs to the store rather than to a derived read.
 */
export const setDensityActionAtom = atom(null, (get, set, density: Density | null): void => {
  set(densityOverrideAtom, density)
  reclampWindows(get, set)
})

/**
 * Sets the Dynamic Type scale, forcing `airy` at 130% and above.
 *
 * The same shape as {@link setDensityActionAtom} and for the same reason: the
 * effective density is derived, but the scroll windows it invalidates are not.
 */
export const setDynamicTypeScaleActionAtom = atom(null, (get, set, scale: number): void => {
  set(dynamicTypeScaleAtom, scale)
  reclampWindows(get, set)
})

/**
 * Re-clamps every frame's window to the viewport size now in force.
 *
 * Runs over the whole stack, not just the top: a screen the human will come
 * back to with `Menu` must be as valid as the one they are looking at, and a
 * frame that kept an out-of-range window would show an empty list on the way
 * back down.
 */
function reclampWindows(get: Getter, set: Setter): void {
  const visibleRows = get(visibleRowCountAtom)
  set(
    screenStackAtom,
    get(screenStackAtom).map((frame) => {
      const maxStart = Math.max(0, frame.rows.length - visibleRows)
      const clampedStart = Math.min(Math.max(frame.windowStart, 0), maxStart)
      const start =
        frame.highlightIndex < 0
          ? 0
          : frame.highlightIndex < clampedStart
            ? frame.highlightIndex
            : frame.highlightIndex >= clampedStart + visibleRows
              ? Math.min(frame.highlightIndex - visibleRows + 1, maxStart)
              : clampedStart
      return start === frame.windowStart ? frame : { ...frame, windowStart: start }
    }),
  )
}

/** Options for building a device. */
export type CreateDeviceStoreOptions = {
  /**
   * The stack to start on. Defaults to the main menu.
   *
   * The default is not a convenience: 001 §15.1 requires the main menu's rows
   * to render on the first frame and never to wait on a network call, so the
   * device is born with them.
   */
  readonly initialStack?: readonly ScreenFrame[]
  /**
   * Which menu rows the default stack shows.
   *
   * Defaults to all of them, which is the honest answer before a provider has
   * been asked. Whoever learns that stations are unsupported, or that no audio
   * is loaded, re-seeds through {@link resetStackActionAtom}.
   */
  readonly isVisible?: MenuVisibility
  /**
   * The device's clock. Defaults to `performance.now()`.
   *
   * Substituting one is how a test drives the announcement debounce by hand.
   * ⚑ There is one clock per device and everything time-related reads it, so a
   * test that supplies this controls *all* of them and cannot accidentally
   * leave the announcer on a different scale.
   */
  readonly now?: Clock
}

/**
 * How many device stores this module has built.
 *
 * Module-level, so it counts per module instance. Two resolutions of this
 * package would each start at zero — which is itself a bug (two
 * `screenStackAtom`s), but a different one, and not one a counter can see.
 */
let devicesBuilt = 0

/** Whether we are running under a test runner. */
function underTest(): boolean {
  return typeof process !== 'undefined' && process.env['NODE_ENV'] === 'test'
}

/**
 * Builds an isolated device. **Tests only.**
 *
 * ⚑ There is exactly one device per document, and it is {@link deviceStore}.
 * This function throws outside a test runner, which is deliberate and is the
 * enforcement of that rule rather than a note asking for it.
 *
 * The reason is the capability requirement the whole package exists for. A
 * tool callback runs outside React and addresses the module singleton; a React
 * tree handed `<Provider store={createDeviceStore()}>` addresses a different
 * object. Both are valid stores, both are React-free, both pass every test
 * here — and the tool is now moving a screen nobody is looking at, silently,
 * with no type error. "The state is reachable outside React" would still be
 * true and the product's premise would still be dead.
 *
 * A second device is a legitimate thing for a *test* to want, because a test
 * that shared one would see the previous test's screen stack. That is the only
 * legitimate want, so that is the only case allowed.
 *
 * @throws If called outside a test runner, or more than once for the document.
 */
export function createDeviceStore(options: CreateDeviceStoreOptions = {}): DeviceStore {
  devicesBuilt += 1
  if (devicesBuilt > 1 && !underTest()) {
    throw new Error(
      'A second device store was constructed. There is exactly one device per ' +
        'document — import `deviceStore`. A store built inside a component is ' +
        'not the one tool callbacks address, and nothing would report the ' +
        'difference.',
    )
  }
  return buildDeviceStore(options)
}

/** The actual construction, with no policy attached. */
function buildDeviceStore(options: CreateDeviceStoreOptions): DeviceStore {
  const store = createStore()
  if (options.now !== undefined) store.set(clockAtom, { now: options.now })
  const initial = options.initialStack ?? [
    menuFrame(MENU_ROOT, 'medium', undefined, options.isVisible),
  ]
  store.set(screenStackAtom, initial)
  return store
}

/**
 * The device.
 *
 * A module singleton on purpose, and the only store anything in the running
 * application may use. A tool callback registered at module scope and a React
 * tree mounted later must address the *same* device: hand this object to the
 * `Provider`, never a fresh one.
 */
export const deviceStore: DeviceStore = buildDeviceStore({})

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
  // ⚑ The viewport size comes from here, never from the event. This atom holds
  // the density and the caller does not, so `Shift+Arrow` cannot page by a
  // number that disagrees with what is on the glass.
  const outcome = detent(get(detentAccumulatorAtom), input, get(visibleRowCountAtom))
  set(detentAccumulatorAtom, outcome.accumulator)
  return applyMovement(get, set, outcome, input.source)
})

/**
 * Advances a coasting wheel by one frame, and moves the highlight with it.
 *
 * The caller drives this from its frame loop while
 * `detentAccumulatorAtom.coasting` is true. Every detent it produces clicks
 * and moves exactly like one the thumb made, because it goes through the same
 * path as {@link detentActionAtom} below this line.
 *
 * @param frameSeconds - Elapsed time for the frame, in seconds.
 */
export const coastActionAtom = atom(null, (get, set, frameSeconds: number): DetentOutcome => {
  const accumulator = get(detentAccumulatorAtom)
  const outcome = coastStep(accumulator, frameSeconds)
  set(detentAccumulatorAtom, outcome.accumulator)
  return applyMovement(get, set, outcome, accumulator.source ?? 'human')
})

/**
 * The half of a movement that touches the screen: move the highlight, then
 * decide what gets said about it.
 *
 * Shared by the detent path and the coast path so that a coasted detent is
 * indistinguishable from a driven one everywhere it matters — same clamping,
 * same bump, same announcement policy.
 *
 * ⚑ The announcement is stamped with the **device clock**, not with the
 * caller's `timestampMs`. That is the whole fix for the two-clock bug: the
 * debounce compares two readings of one clock, so no caller can put it on a
 * different scale by passing the browser's idiomatic `event.timeStamp`.
 */
function applyMovement(
  get: Getter,
  set: Setter,
  outcome: DetentOutcome,
  source: DetentInput['source'],
): DetentOutcome {
  if (outcome.rowDelta === 0) return outcome

  const now = get(clockAtom).now()
  const before = get(highlightIndexAtom)
  set(moveHighlightActionAtom, outcome.rowDelta)
  const frame = get(currentScreenAtom)

  if (frame === null || get(highlightIndexAtom) === before) return outcome

  const snapshot: ScreenSnapshotSource = {
    face: get(faceAtom),
    frame,
    density: get(effectiveDensityAtom),
    agentActive: get(agentActiveAtom),
  }

  const noted = noteMovement(get(announcerAtom), {
    snapshot,
    urgency: outcome.announce,
    source,
    atMs: now,
  })
  set(announcerAtom, noted.state)
  if (noted.announcement !== null) set(liveRegionAtom, noted.announcement)

  return outcome
}

/**
 * Ends a gesture: drops sub-detent residual, and speaks the settled position
 * if the debounce has elapsed.
 *
 * @returns The announcement that was published, or `null`.
 */
export const endGestureActionAtom = atom(null, (get, set): Announcement | null => {
  set(detentAccumulatorAtom, endGesture(get(detentAccumulatorAtom)))
  return set(flushAnnouncementsActionAtom)
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
  (get, set): Announcement | null => {
    // ⚑ The device clock, read here rather than passed in. Nothing outside
    // this package can put the debounce on a second time scale, because
    // nothing outside this package supplies the time it is compared against.
    const flushed = flushAnnouncer(get(announcerAtom), get(clockAtom).now())
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

/**
 * Injection points for {@link startAnnouncer}.
 *
 * ⚑ There is deliberately no `now` here. The driver reads the device's own
 * {@link clockAtom}, and a test that wants a deterministic clock supplies it
 * once, to `createDeviceStore`, where it governs the whole device. Letting the
 * driver take a second clock is exactly how the two-clock bug was possible:
 * one component of the debounce could be moved without the other.
 */
export type AnnouncerDriverOptions = {
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
      const spoken = store.set(flushAnnouncementsActionAtom)
      // ⚑ Re-arm when the flush said nothing. `flushAnnouncer` returns the
      // *same* state object when the due time has not arrived, and setting an
      // atom to the value it already holds is a no-op to jotai — so the
      // subscription below does not fire, and without this line nothing would
      // ever arm again. The settling summary would be dropped in silence,
      // which is the one failure mode this whole module exists to prevent.
      //
      // A timer firing early is not hypothetical once the clock is
      // `performance.now()`: browsers coarsen it deliberately, so reading back
      // a value a fraction below the due time is ordinary.
      if (spoken === null) arm()
    }, Math.max(0, dueAtMs - store.get(clockAtom).now()))
  }

  const unsubscribe = store.sub(announcerAtom, arm)
  arm()

  return () => {
    cancel()
    unsubscribe()
  }
}
