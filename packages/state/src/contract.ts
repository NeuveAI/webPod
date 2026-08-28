/**
 * The device state contract: every type, constant and atom that anything
 * outside this package is allowed to depend on.
 *
 * This module is published ahead of its implementation on purpose. The panel
 * layer is blocked on the *shape* of device state, not on the reducers that
 * move it, so the shape lands first and the reducers follow. Nothing here
 * implements behaviour: the reducer, the screen machine and the announcer are
 * declared as function *types* and their bodies arrive in sibling modules.
 *
 * Three properties of this file are load-bearing and are not stylistic:
 *
 * 1. **The atoms are module-level values, not hooks.** Every one of them is
 *    readable, writable and subscribable through a bare `store.get`,
 *    `store.set` and `store.sub` with no React tree mounted. Tool callbacks
 *    run outside the React tree and must reach the same state the UI renders;
 *    state held in a component closure is unreachable from one. This is why
 *    `useState` is banned repo-wide with no exception for "local" state.
 * 2. **The screen surface is enumerable.** {@link ScreenSnapshot} is the exact
 *    payload a screen-reading tool reports — face, screen id, title, density,
 *    rows, highlight index, totals. Its field names are transcribed from the
 *    001 §7.2 tool table rather than invented here, so a later stage can
 *    serialise it without a translation layer that could drift.
 * 3. **`source` is threaded through the reducer, not around it.** Feedback that
 *    signals a hand — the clicker and haptics — is suppressed at exactly one
 *    place, inside the detent reducer, so no call site can forget. Nothing in
 *    this workstream emits anything but `"human"`; the seam exists so that the
 *    day something does, the rule is already enforced.
 *
 * What this file deliberately does **not** contain: any notion of an agent
 * being present, attached, connected or idle. The browser supplies no such
 * fact — a page learns an agent exists only when a tool executes — so the only
 * agent-related state here is {@link agentActiveAtom}, which means "the agent
 * acted most recently", and nothing more.
 */

import type { Atom, PrimitiveAtom, WritableAtom } from 'jotai'
import { atom } from 'jotai'

/* ────────────────────────────────────────────────────────────────────────────
 * Actors
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Who asked for a movement, as declared by the caller.
 *
 * Coarse on purpose: it is the only actor information a call site is trusted
 * to supply. The fine-grained {@link Actor} tag that ends up in the provenance
 * record is derived from this plus the input path by the reducer, so a caller
 * cannot claim to be a hand (001 §8.4).
 *
 * ⚑ `"agent"` and `"system"` are silent: no clicker, no haptics, no springs.
 * Touch and sound are the signature of a hand, and a device that buzzed in a
 * pocket nobody was holding would send its owner reaching for it. Enforced
 * once, inside the detent reducer (001 §4.7, §15.2).
 */
export type DetentSource = 'human' | 'agent' | 'system'

/**
 * How a movement physically arrived.
 *
 * The four human paths of 001 §4.4 plus `"direct"`, which is the compile
 * target for a programmatic detent count. All five converge on the same
 * reducer; only the accumulator geometry and the acceleration curve differ.
 *
 * `"touch-arc"` also carries the vertical swipe on the panel itself (001 §4.5)
 * — that gesture drives this reducer rather than a scroll container, which is
 * what keeps the clicker firing and the highlight tracking.
 */
export type InputPath = 'touch-arc' | 'mouse-arc' | 'scroll' | 'key' | 'direct'

/**
 * The attribution tag written into the provenance record (001 §8.4).
 *
 * Set by the reducer from {@link DetentSource} and {@link InputPath}, never by
 * the caller. The agent variant carries its origin so two agents are
 * distinguishable in the log.
 */
export type Actor =
  | 'human:touch'
  | 'human:mouse'
  | 'human:key'
  | `agent:${string}`
  | 'system'

/* ────────────────────────────────────────────────────────────────────────────
 * Device state
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The five device states (001 §8.2.2). Exactly one is active at a time and it
 * is published on the root element as `data-actor-state`.
 *
 * ⚑ There are five. Not six, not eleven. An earlier draft of the design had
 * eleven, of which six were permission states for a permission model that does
 * not exist and one — "an agent is attached and idle" — described a fact the
 * browser never tells the page. `CONFIRMING`, `CO_PILOT`, `AGENT_DENIED`,
 * `SOLO_HUMAN`, `AGENT_ATTACHED_IDLE`, `AGENT_PENDING_CONSENT`, `AGENT_STAGED`
 * and `HUMAN_PRIORITY_LOCK` were all deleted with reasons. Do not reintroduce
 * one under a new name.
 *
 * - `USER_ACTIVE` — the human acted most recently, or nothing has happened
 *   yet. The ordinary music player, and overwhelmingly the common case.
 * - `AGENT_ACTIVE` — a tool call executed and no human has touched the device
 *   since.
 * - `AGENT_THROTTLED` — this application's own rate limiter is refusing. A
 *   sub-mode of `AGENT_ACTIVE`, not a protocol state.
 * - `HOLD_ENGAGED` — the physical switch is thrown. Human-only in both
 *   directions; there is deliberately no tool that sets it.
 * - `DISCONNECTED` — the music service is unreachable. Nothing to do with
 *   agents.
 */
export type DeviceStateName =
  | 'USER_ACTIVE'
  | 'AGENT_ACTIVE'
  | 'AGENT_THROTTLED'
  | 'HOLD_ENGAGED'
  | 'DISCONNECTED'

/**
 * The one application mode (001 §8.2.3).
 *
 * Orthogonal to {@link DeviceStateName} and actor-agnostic: it can be true
 * alongside any device state, and a human bulk edit enters it exactly as an
 * agent-originated one does. It means "a change is staged as a reviewable
 * draft rather than applied" — it is not a consent gate, because there is
 * nothing to consent to.
 */
export type AppMode = 'REVIEW_PENDING'

/** Whether the music service is reachable. Feeds `DISCONNECTED`. */
export type ConnectionState = 'connected' | 'disconnected'

/** Which face of the device is showing (001 §6). */
export type Face = 'front' | 'back'

/* ────────────────────────────────────────────────────────────────────────────
 * Screens and rows
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Row metrics on the panel raster (001 §3).
 *
 * Density is a device setting, not a per-screen constant: every screen has a
 * *preferred* density in the 001 §3.1 inventory, but Dynamic Type at 130% or
 * more forces `airy` across the board, so the effective density is device
 * state and lives in {@link densityAtom}.
 */
export type Density = 'compact' | 'medium' | 'airy'

/**
 * How many rows of a list are simultaneously visible, per density (001 §3).
 *
 * This is the page size for `⏭`/`⏮` and for `Shift+Arrow` — "one full
 * viewport of rows" — so it is not merely a rendering hint. Consumed by the
 * screen machine, not re-derived from pixel heights.
 */
export const VISIBLE_ROWS: Readonly<Record<Density, number>> = {
  compact: 8,
  medium: 6,
  airy: 4,
}

/**
 * Row height in raster pixels, per density (001 §3).
 *
 * Exported next to {@link VISIBLE_ROWS} so the two can never disagree about
 * how many rows fit: the panel's skeleton rows must be exactly this tall or
 * the list reflows when data lands.
 */
export const ROW_HEIGHT_PX: Readonly<Record<Density, number>> = {
  compact: 26,
  medium: 32,
  airy: 44,
}

/**
 * Every screen the device itself can show — front surfaces and back surfaces.
 *
 * Closed on purpose. A screen id is reported verbatim by the screen-reading
 * tool, so an ad-hoc string at a call site would leak into a tool payload.
 *
 * ⚑ `S26` is absent: the confirm card was deleted, because there is no moment
 * at which a page can pause a tool call, so a pre-action prompt has nothing to
 * gate. `B10` is absent for the same class of reason — it granted standing
 * permission for actions that were never gated. The desktop shell surfaces
 * (`D01`–`D07`) are not here either: they are the glass layer around the
 * device, not screens on it.
 */
export type ScreenId =
  | 'S01'
  | 'S02'
  | 'S03'
  | 'S04'
  | 'S05'
  | 'S06'
  | 'S07'
  | 'S08'
  | 'S09'
  | 'S10'
  | 'S11'
  | 'S12'
  | 'S13'
  | 'S14'
  | 'S15'
  | 'S16'
  | 'S17'
  | 'S18'
  | 'S19'
  | 'S20'
  | 'S21'
  | 'S22'
  | 'S23'
  | 'S24'
  | 'S25'
  | 'S27'
  | 'S28'
  | 'S29'
  | 'S30'
  | 'B01'
  | 'B02'
  | 'B03'
  | 'B04'
  | 'B05'
  | 'B06'
  | 'B07'
  | 'B08'
  | 'B09'

/**
 * A gutter mark on a list row.
 *
 * Named by meaning rather than by glyph so the panel owns the typography and
 * the light/dark colourway rules. `added` / `removed` / `moved` are the staged
 * diff marks; a removed row is struck in ink, never in crimson, because a
 * staged removal is a proposal rather than a destruction.
 */
export type RowGlyph =
  | 'descend'
  | 'playing'
  | 'checked'
  | 'draft'
  | 'unavailable'
  | 'added'
  | 'removed'
  | 'moved'

/**
 * Who is responsible for a row being where it is, or `null` when the row's
 * presence is not attributable (001 §8.4).
 *
 * Rendered as a 10px sigil in the right gutter — ● human, ○ agent, ▪ system —
 * and it is persistent, not a transient toast. Provenance survives a commit: a
 * playlist an agent built still says so afterwards.
 */
export type RowProvenance = 'human' | 'agent' | 'system' | null

/**
 * One row of a list screen, in the shape the screen-reading tool reports.
 *
 * `index` is absolute within the screen's full row set, not within the visible
 * window, so a row read out of a windowed snapshot still identifies itself
 * unambiguously.
 */
export type PanelRow = {
  readonly index: number
  readonly label: string
  /** Secondary line, or `null` when the row is a single line. Never `""`. */
  readonly sublabel: string | null
  readonly glyphs: readonly RowGlyph[]
  readonly provenance: RowProvenance
}

/**
 * One level of the navigation stack.
 *
 * The highlight index and the scroll window live *in the frame* rather than in
 * a single global. That is what makes `Menu` restore the exact prior position:
 * popping is a stack pop, and the position comes back with it because it never
 * left. A design that stored one highlight globally would have to remember and
 * replay positions, and would drift the first time a screen was reached by two
 * routes.
 */
export type ScreenFrame = {
  readonly screenId: ScreenId
  /** The title bar string for this level. */
  readonly title: string
  readonly density: Density
  readonly rows: readonly PanelRow[]
  /**
   * Index of the highlighted row within {@link rows}.
   *
   * `-1` when the screen has no rows at all. Otherwise always in range: the
   * screen machine clamps rather than wraps, so the ends of a list are hard
   * stops that produce an elastic bump.
   */
  readonly highlightIndex: number
  /**
   * Absolute index of the first row currently rendered.
   *
   * Sticky: the window only moves when the highlight would otherwise leave it,
   * which is what makes short movements feel like the highlight travelling
   * over a still list rather than the list sliding under a fixed highlight.
   */
  readonly windowStart: number
}

/**
 * The complete, enumerable description of what is on the screen.
 *
 * ⚑ This shape is transcribed from the 001 §7.2 `pod-read-screen` return
 * value and is not ours to improvise: a later stage serialises it directly to
 * an agent. If a field is wanted that is not here, the tool table is the thing
 * to change first.
 *
 * `agentActive` means *the agent acted most recently* — it is the flag of 001
 * §8.2, not a presence signal. Nothing in the platform reports whether an
 * agent is attached, so nothing here does either.
 */
export type ScreenSnapshot = {
  readonly face: Face
  readonly screenId: ScreenId
  readonly title: string
  readonly density: Density
  /**
   * The rows to report. By default only the window the human can actually
   * see; a reader that asks for offscreen rows gets the whole set.
   */
  readonly rows: readonly PanelRow[]
  /** Absolute index of the highlight, or `-1` on an empty screen. */
  readonly highlightIndex: number
  /** Total rows on the screen, including those outside the window. */
  readonly totalRows: number
  /** How many rows the viewport shows at the current density. */
  readonly visibleRows: number
  readonly agentActive: boolean
}

/** Options for {@link ReadScreenFn}. */
export type ReadScreenOptions = {
  /**
   * Include rows outside the visible window. Defaults to `false`.
   *
   * Reading beyond what the human can see is a bigger thing to do than reading
   * the screen, and the panel marks it differently, so it is an explicit
   * request rather than the default.
   */
  readonly includeOffscreenRows?: boolean
}

/**
 * Projects the store into the enumerable screen description.
 *
 * Pure with respect to the store: it reads and never writes, so it is safe to
 * call from a read-only tool callback at any time.
 */
export type ReadScreenFn = (
  snapshotSource: ScreenSnapshotSource,
  options?: ReadScreenOptions,
) => ScreenSnapshot

/**
 * The minimum a caller must supply to build a {@link ScreenSnapshot}.
 *
 * Declared as a plain record rather than as the store itself so that the
 * projection is unit-testable without a store, and so that a caller holding a
 * frame from the middle of the stack can project it too.
 */
export type ScreenSnapshotSource = {
  readonly face: Face
  readonly frame: ScreenFrame
  readonly agentActive: boolean
}

/* ────────────────────────────────────────────────────────────────────────────
 * The detent reducer
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Detent geometry and acceleration thresholds (001 §4.4).
 *
 * ⚑ Every number is transcribed from the §4.4 engineering-contract table. The
 * table is the source of truth; if a value here disagrees with it, this file
 * is wrong.
 */
export const DETENT = {
  /** Degrees of arc per detent, on both arc paths. 24 detents per revolution. */
  arcDegPerDetent: 15,
  /** Total arc travel required before the first detent fires, on touch. */
  touchDeadZoneDeg: 18,
  /** The same, on a mouse: a mouse is steadier than a thumb, so it is lower. */
  mouseDeadZoneDeg: 12,
  /** Accumulated pixels per detent, on the scroll path. */
  scrollPxPerDetent: 40,
  /** Accumulated pixels required before the first scroll detent fires. */
  scrollDeadZonePx: 24,
  /** `deltaMode: DOM_DELTA_LINE` is multiplied by this to reach pixels. */
  scrollLineToPx: 16,
  /**
   * Angular speed, in deg/s, above which one detent moves 3 rows on the touch
   * arc; the mouse thresholds are these scaled by
   * {@link DETENT.mouseAccelScale}.
   */
  fastThresholdDegPerSec: 240,
  /** Angular speed above which one detent moves 7 rows on the touch arc. */
  fasterThresholdDegPerSec: 540,
  /**
   * Both arc thresholds are multiplied by this on the mouse path.
   *
   * A mouse arc is jerkier than a thumb arc, so the touch thresholds produce
   * false fast-scroll on a mouse.
   */
  mouseAccelScale: 1.4,
  /** Rows per detent below the first threshold. */
  rowsSlow: 1,
  /** Rows per detent between the two thresholds. */
  rowsFast: 3,
  /** Rows per detent above the second threshold. */
  rowsFaster: 7,
  /**
   * The row multiplier is averaged over this many detents.
   *
   * Without the smoothing the multiplier jumps mid-flick and the list becomes
   * uncontrollable exactly when the human is least able to correct it.
   */
  multiplierSmoothingDetents: 3,
} as const

/**
 * A single measured input event, before it becomes detents.
 *
 * Every variant carries `source` and `timestampMs`. The timestamp is passed in
 * rather than read from a clock inside the reducer, which is what makes a
 * 30-detent flick reproducible in a test with no fake timers.
 */
export type DetentInput =
  | {
      readonly path: 'touch-arc' | 'mouse-arc'
      readonly source: DetentSource
      /**
       * Signed change in pointer angle about the wheel centre since the last
       * event, in degrees. Positive is clockwise, and clockwise is down —
       * matching the 2005 device and every rotary control since.
       */
      readonly angleDeg: number
      readonly timestampMs: number
    }
  | {
      readonly path: 'scroll'
      readonly source: DetentSource
      /** Raw `WheelEvent.deltaY`. Positive is down. */
      readonly deltaY: number
      /** Raw `WheelEvent.deltaMode`: 0 pixel, 1 line, 2 page. */
      readonly deltaMode: 0 | 1 | 2
      /** Viewport height in px, used only to normalise `deltaMode: 2`. */
      readonly viewportPx: number
      readonly timestampMs: number
    }
  | {
      readonly path: 'key'
      readonly source: DetentSource
      /** `1` for `ArrowDown`, `-1` for `ArrowUp`. */
      readonly direction: 1 | -1
      /** `true` when Shift is held: one full viewport of rows, deterministically. */
      readonly page: boolean
      readonly timestampMs: number
    }
  | {
      readonly path: 'direct'
      readonly source: DetentSource
      /** A signed detent count supplied by the caller, already discretised. */
      readonly detents: number
      readonly timestampMs: number
    }

/**
 * Everything the reducer must remember between events on one gesture.
 *
 * Carried explicitly rather than closed over, so the reducer is a pure
 * function of `(accumulator, input)` and a whole flick can be replayed in a
 * test.
 */
export type DetentAccumulator = {
  /** The path that owns the current gesture, or `null` when idle. */
  readonly path: InputPath | null
  /** Arc travel not yet converted into a detent, in degrees. */
  readonly residualDeg: number
  /** Scroll travel not yet converted into a detent, in pixels. */
  readonly residualPx: number
  /**
   * Whether the dead zone has been cleared.
   *
   * Only the *first* detent of a gesture pays the dead zone; once armed, every
   * subsequent detent costs the ordinary amount.
   */
  readonly armed: boolean
  /** Smoothed angular speed, deg/s, on the arc paths. */
  readonly speedDegPerSec: number
  /** The last few row multipliers, newest last, for smoothing. */
  readonly recentMultipliers: readonly number[]
  /** Timestamp of the previous event on this gesture, or `null` when idle. */
  readonly lastEventMs: number | null
  /** Timestamp of the last detent that actually fired, or `null`. */
  readonly lastDetentMs: number | null
}

/** The accumulator at rest. A gesture starts and ends here. */
export const IDLE_DETENT_ACCUMULATOR: DetentAccumulator = {
  path: null,
  residualDeg: 0,
  residualPx: 0,
  armed: false,
  speedDegPerSec: 0,
  recentMultipliers: [],
  lastEventMs: null,
  lastDetentMs: null,
}

/**
 * What one input event produced.
 *
 * The reducer returns feedback *counts* rather than firing anything. Sound and
 * vibration are side effects and belong to the layer that owns them; what the
 * reducer owns is the decision, taken once, about whether they are allowed to
 * happen at all.
 */
export type DetentOutcome = {
  /** The accumulator to carry into the next event. */
  readonly accumulator: DetentAccumulator
  /** Signed detents fired by this event. Zero is normal and common. */
  readonly detents: number
  /**
   * Signed rows the highlight should move: `detents × multiplier`, except on
   * the key path with Shift, where it is one full viewport.
   */
  readonly rowDelta: number
  /** Rows per detent applied to this event. Always `1` on the key path. */
  readonly multiplier: number
  /**
   * Detent rate, in detents per second, for this event.
   *
   * Exposed because the panel shows an index overlay above a rate threshold;
   * the threshold is a rendering decision and stays out of here.
   */
  readonly detentsPerSecond: number
  /** Clicker ticks to play. `0` when silenced. */
  readonly clickerTicks: number
  /** `selection` haptic pulses to fire. `0` when silenced. */
  readonly hapticPulses: number
  /**
   * `true` when this movement produced no sound and no vibration because it
   * was not made by a hand.
   *
   * ⚑ This is the single enforcement point for the silence rule. It is
   * computed here, from `source`, so that no call site can produce a clicking,
   * buzzing agent by forgetting a check.
   */
  readonly silenced: boolean
  /** The provenance tag for this movement, derived — never supplied. */
  readonly actor: Actor
  /** How the resulting position should be announced. */
  readonly announce: AnnouncementUrgency
}

/**
 * Turns one measured input event into countable, deterministic movement.
 *
 * ⚑ The rule that outranks the rest: **on the key path one keydown is exactly
 * one detent, always, with no acceleration, ever.** A keyboard or
 * switch-control user navigates by counting and a screen-reader user navigates
 * by listening to each stop; an acceleration curve turns "press down four
 * times" into "arrive somewhere near row 4", which is unusable. `Shift+Arrow`
 * supplies the speed and stays deterministic. This applies to agent-driven
 * movement too, for the same reason: an agent asking for 14 must land on row
 * 15, not near it.
 *
 * Acceleration exists on the two arc paths only. The scroll path deliberately
 * has none — trackpad momentum already supplies it, and multiplying twice
 * makes a list uncontrollable.
 *
 * @param accumulator - Gesture state; pass {@link IDLE_DETENT_ACCUMULATOR} to
 *   start a gesture.
 * @param input - One measured event.
 * @returns The movement, the feedback budget, and the accumulator to carry
 *   forward. Never mutates its arguments.
 */
export type DetentFn = (
  accumulator: DetentAccumulator,
  input: DetentInput,
) => DetentOutcome

/**
 * Ends a gesture and discards any residual travel.
 *
 * Residual below one detent is dropped rather than rounded up: rounding fires
 * a phantom detent the human never asked for, on every single gesture that
 * ends mid-detent, which is most of them.
 */
export type EndGestureFn = (accumulator: DetentAccumulator) => DetentAccumulator

/* ────────────────────────────────────────────────────────────────────────────
 * Presses
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The four navigation presses (001 §4.3).
 *
 * Transport presses — play/pause, and the hold variants — are not here: they
 * act on playback rather than on the screen stack, and belong to the layer
 * that owns the queue. This union is exactly the press enum the navigation
 * tool accepts.
 */
export type PressButton = 'center' | 'menu' | 'next' | 'previous'

/** One button press, with the same actor seam the detent reducer carries. */
export type PressInput = {
  readonly button: PressButton
  readonly source: DetentSource
  readonly timestampMs: number
}

/**
 * Which way the device rubber-bands when a movement hits a hard stop.
 *
 * `right` is the root `Menu` bump: the device is the whole application, so
 * there is no "exit", and the bump says "this is the top" physically instead
 * of doing nothing — which reads as a broken button.
 */
export type BumpDirection = 'up' | 'down' | 'right'

/**
 * An elastic bump that the panel should play.
 *
 * `seq` increments on every bump. Two identical bumps in a row are two
 * different values, so a subscriber re-renders instead of coalescing them into
 * one — which is exactly what would happen if the payload were only a
 * direction.
 */
export type BumpEvent = {
  readonly direction: BumpDirection
  readonly seq: number
  readonly at: number
}

/* ────────────────────────────────────────────────────────────────────────────
 * The screen machine
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * A node in the static menu hierarchy (001 §4.2).
 *
 * The tree describes what descending from a row *does*; the rows themselves
 * are built from it plus provider data. A leaf with no `children` and no
 * `screenId` is an action row rather than a destination.
 */
export type MenuNode = {
  readonly label: string
  /** The screen pushed when this row is selected, if it pushes one. */
  readonly screenId?: ScreenId
  readonly children?: readonly MenuNode[]
  /**
   * `true` when selecting this row turns the device over rather than pushing
   * a screen. Settings is the only front-face row that does this.
   */
  readonly flips?: boolean
}

/** The result of a screen-machine transition. */
export type ScreenTransition = {
  readonly stack: readonly ScreenFrame[]
  /**
   * The bump to play, or `null`.
   *
   * ⚑ `Menu` at the root of the front face always produces a bump and is never
   * a no-op.
   */
  readonly bump: BumpEvent | null
}

/**
 * Moves the highlight within the current frame, clamping at both ends.
 *
 * Clamps rather than wraps, and a clamped movement returns a bump: the ends of
 * a list are hard stops on this device, and a list that wrapped would make
 * counted navigation ambiguous about where it landed.
 *
 * Also slides the sticky window so the highlight stays visible, moving it by
 * the minimum needed rather than recentring — recentring makes a
 * single-row movement look like the whole list jumped.
 */
export type MoveHighlightFn = (
  stack: readonly ScreenFrame[],
  rowDelta: number,
  visibleRows: number,
  at: number,
) => ScreenTransition

/** Pushes a screen. The outgoing frame keeps its highlight and its window. */
export type PushScreenFn = (
  stack: readonly ScreenFrame[],
  frame: ScreenFrame,
) => ScreenTransition

/**
 * Pops one level.
 *
 * At the root the stack is unchanged and the transition carries a `right`
 * bump. Below the root the previous frame is restored **exactly** — same
 * highlight, same window — because it was never dismantled.
 */
export type PopScreenFn = (
  stack: readonly ScreenFrame[],
  at: number,
) => ScreenTransition

/* ────────────────────────────────────────────────────────────────────────────
 * Announcements
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * How soon a movement should reach the live region.
 *
 * `immediate` is the deterministic case — a single keypress, whose result the
 * human is entitled to hear at once. `debounced` is everything continuous: a
 * flick fires dozens of detents and must produce **one** summary, not dozens,
 * or the live region becomes an unusable stream.
 */
export type AnnouncementUrgency = 'immediate' | 'debounced'

/**
 * Milliseconds of stillness before a debounced announcement is emitted
 * (001 §4.4).
 *
 * Measured from the last detent, not from the first: the announcement
 * describes where the human ended up, so it waits for the motion to settle.
 */
export const ANNOUNCE_DEBOUNCE_MS = 350

/**
 * Two key detents closer together than this are treated as OS auto-repeat.
 *
 * A single keypress announces immediately; a held key would otherwise announce
 * on every repeat, so repeats fall back to the debounced path and produce one
 * summary when the key is released.
 */
export const KEY_REPEAT_WINDOW_MS = 250

/** A string destined for a live region, with the politeness it needs. */
export type Announcement = {
  readonly text: string
  readonly politeness: 'polite' | 'assertive'
  /**
   * Increments per emission so that two identical announcements are two
   * distinct values and the second is not swallowed as a no-change.
   */
  readonly seq: number
}

/**
 * The announcer's pending work.
 *
 * It holds a *due time* rather than a timer handle. Nothing here schedules
 * anything: the pure part decides when an announcement is due and the store
 * binding owns the single `setTimeout` that asks. That split is what lets the
 * 30-detent test assert "exactly one announcement" without fake timers.
 */
export type AnnouncerState = {
  /** The snapshot to describe when the debounce elapses, or `null`. */
  readonly pending: ScreenSnapshotSource | null
  /** Timestamp at which {@link pending} becomes due, or `null`. */
  readonly dueAtMs: number | null
  /** Emissions so far. Becomes {@link Announcement.seq}. */
  readonly emitted: number
}

/** The announcer at rest. */
export const IDLE_ANNOUNCER_STATE: AnnouncerState = {
  pending: null,
  dueAtMs: null,
  emitted: 0,
}

/**
 * Records that the highlight moved, and decides when it will be announced.
 *
 * Calling this repeatedly during a flick replaces the pending snapshot and
 * pushes the due time out; it never queues a second announcement. An
 * `immediate` urgency emits on the spot and clears anything pending, so a
 * keypress that interrupts a flick does not later produce a stale summary of
 * where the flick had got to.
 */
export type NoteMovementFn = (
  state: AnnouncerState,
  movement: {
    readonly snapshot: ScreenSnapshotSource
    readonly urgency: AnnouncementUrgency
    readonly source: DetentSource
    readonly atMs: number
  },
) => { readonly state: AnnouncerState; readonly announcement: Announcement | null }

/**
 * Emits the pending announcement if it is due at `nowMs`, otherwise nothing.
 *
 * Idempotent: calling it again after an emission returns `null` until another
 * movement is noted.
 */
export type FlushAnnouncerFn = (
  state: AnnouncerState,
  nowMs: number,
) => { readonly state: AnnouncerState; readonly announcement: Announcement | null }

/**
 * Renders a snapshot as the sentence a screen reader speaks (001 §11.8).
 *
 * Human movement reads `Row 4 of 18. Bad Blood, Taylor Swift.` Agent movement
 * names the actor first — `Agent moved to row 15 of 42. Vienna.` — because the
 * human needs to know the device moved without them before they need to know
 * where it moved to.
 */
export type DescribeMovementFn = (
  snapshot: ScreenSnapshotSource,
  source: DetentSource,
) => string

/* ────────────────────────────────────────────────────────────────────────────
 * The store
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * The store handle this application's state lives in.
 *
 * Structurally `get` / `set` / `sub` and nothing else. It is deliberately not
 * a React object: everything below is reachable from a plain module with no
 * component mounted, which is the property the whole architecture rests on.
 */
export type DeviceStore = {
  get: <Value>(anAtom: Atom<Value>) => Value
  set: <Value, Args extends unknown[], Result>(
    anAtom: WritableAtom<Value, Args, Result>,
    ...args: Args
  ) => Result
  sub: (anAtom: Atom<unknown>, listener: () => void) => () => void
}

/* ── Primitive atoms ─────────────────────────────────────────────────────── */

/**
 * Whether the agent acted most recently (001 §8.2.1).
 *
 * ⚑ Read this as "who moved last", never as "who is here". The page cannot
 * detect that an agent exists; it learns one does only when a tool executes.
 * Set to `true` on the first line of a tool callback, and back to `false` by
 * any trusted user interaction. No timers, no thresholds, no debounce — the
 * flag is the entire model.
 *
 * The trusted-event guard that clears it is a best-effort attribution
 * heuristic for display. Input injected by browser automation is also trusted,
 * so nothing in this application's safety model may rest on it.
 */
export const agentActiveAtom: PrimitiveAtom<boolean> = atom(false)

/**
 * Whether the physical Hold switch is thrown.
 *
 * Human-only in both directions. There is deliberately no tool that writes
 * this: registration is the only absolute prohibition the protocol offers, so
 * *not existing* is the whole mechanism, and it is the one control here an
 * agent genuinely cannot work around.
 */
export const holdEngagedAtom: PrimitiveAtom<boolean> = atom(false)

/** Whether the music service is reachable. Nothing to do with agents. */
export const connectionAtom: PrimitiveAtom<ConnectionState> = atom<ConnectionState>('connected')

/**
 * Whether this application's own rate limiter is currently refusing calls.
 *
 * A plain boolean written by the limiter. It carries no deadline, because a
 * countdown belongs to the limiter that owns the bucket, and a second copy of
 * it here would be a second thing to keep true.
 */
export const agentThrottledAtom: PrimitiveAtom<boolean> = atom(false)

/** The staged-changes mode, or `null` when nothing is staged. */
export const appModeAtom: PrimitiveAtom<AppMode | null> = atom<AppMode | null>(null)

/** Which face is showing. */
export const faceAtom: PrimitiveAtom<Face> = atom<Face>('front')

/**
 * The effective row density.
 *
 * Device state rather than a per-screen constant, because Dynamic Type at 130%
 * or more forces `airy` regardless of what a screen would prefer.
 */
export const densityAtom: PrimitiveAtom<Density> = atom<Density>('medium')

/**
 * The navigation stack, root first.
 *
 * Never empty. The screen machine is the only writer; a call site that wants
 * to navigate goes through a transition rather than assigning a stack, so that
 * the bump on a hard stop cannot be skipped.
 */
export const screenStackAtom: PrimitiveAtom<readonly ScreenFrame[]> = atom<readonly ScreenFrame[]>(
  [],
)

/** Gesture state for the detent reducer. */
export const detentAccumulatorAtom: PrimitiveAtom<DetentAccumulator> = atom(IDLE_DETENT_ACCUMULATOR)

/** The announcer's pending work. */
export const announcerAtom: PrimitiveAtom<AnnouncerState> = atom(IDLE_ANNOUNCER_STATE)

/**
 * The most recent bump, or `null`.
 *
 * The panel plays it and does not clear it: a bump is a fact that happened,
 * and `seq` makes each one distinct, so there is no stale value to sweep up.
 */
export const bumpAtom: PrimitiveAtom<BumpEvent | null> = atom<BumpEvent | null>(null)

/**
 * The current live-region contents, or `null` before anything is announced.
 *
 * Exactly one element in the document renders this. A second live region would
 * double every announcement, and the failure is invisible to anyone not using
 * a screen reader.
 */
export const liveRegionAtom: PrimitiveAtom<Announcement | null> = atom<Announcement | null>(null)

/* ── Derived atoms ───────────────────────────────────────────────────────── */

/**
 * The single active device state, derived rather than assigned.
 *
 * Deriving it is what makes the "exactly one at a time" rule structural: there
 * is no combination of the primitives above that yields two states, and no
 * writer that can leave a stale one behind.
 *
 * Precedence, highest first: `HOLD_ENGAGED`, `DISCONNECTED`,
 * `AGENT_THROTTLED`, `AGENT_ACTIVE`, `USER_ACTIVE`. Hold outranks everything
 * because it is the human's physical override; disconnection outranks the
 * agent states because it changes what is possible rather than who acted last.
 */
export const deviceStateAtom: Atom<DeviceStateName> = atom((get) => {
  if (get(holdEngagedAtom)) return 'HOLD_ENGAGED'
  if (get(connectionAtom) === 'disconnected') return 'DISCONNECTED'
  if (get(agentThrottledAtom)) return 'AGENT_THROTTLED'
  if (get(agentActiveAtom)) return 'AGENT_ACTIVE'
  return 'USER_ACTIVE'
})

/**
 * The frame on top of the stack, or `null` when the stack is empty.
 *
 * Nullable rather than throwing: the store is constructed before any screen is
 * pushed, and a consumer that renders during that window should render nothing
 * rather than crash.
 */
export const currentScreenAtom: Atom<ScreenFrame | null> = atom((get) => {
  const stack = get(screenStackAtom)
  return stack.length === 0 ? null : (stack[stack.length - 1] ?? null)
})

/** How many rows fit at the current density. */
export const visibleRowCountAtom: Atom<number> = atom((get) => VISIBLE_ROWS[get(densityAtom)])

/**
 * The rows actually on screen: the current frame's sticky window.
 *
 * Empty when there is no current screen. Row `index` values stay absolute, so
 * a windowed row still says where it is in the full list.
 */
export const visibleRowsAtom: Atom<readonly PanelRow[]> = atom((get) => {
  const frame = get(currentScreenAtom)
  if (frame === null) return []
  return frame.rows.slice(frame.windowStart, frame.windowStart + get(visibleRowCountAtom))
})

/** The highlight index on the current screen, or `-1`. */
export const highlightIndexAtom: Atom<number> = atom((get) => get(currentScreenAtom)?.highlightIndex ?? -1)

/**
 * The enumerable screen description, windowed.
 *
 * `null` only before the first screen is pushed. This is the atom a
 * screen-reading tool projects; it is derived so the tool and the panel can
 * never disagree about what is on screen.
 */
export const screenSnapshotAtom: Atom<ScreenSnapshot | null> = atom((get) => {
  const frame = get(currentScreenAtom)
  if (frame === null) return null
  return {
    face: get(faceAtom),
    screenId: frame.screenId,
    title: frame.title,
    density: frame.density,
    rows: get(visibleRowsAtom),
    highlightIndex: frame.highlightIndex,
    totalRows: frame.rows.length,
    visibleRows: get(visibleRowCountAtom),
    agentActive: get(agentActiveAtom),
  }
})
