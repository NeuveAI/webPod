/**
 * The device state contract: every type, constant and atom that anything
 * outside this package is allowed to depend on.
 *
 * This module is published ahead of its implementation on purpose. The panel
 * layer depends on the *shape* of device state, not on the reducers that
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
 *    React's component-local state hook is banned repo-wide, by lint, with no
 *    exception for "local" or "trivial" state.
 * 2. **The screen surface is enumerable.** {@link ScreenSnapshot} is the exact
 *    payload a screen-reading tool reports — face, screen id, title, density,
 *    rows, highlight index, totals. Its field names are transcribed from the
 *    001 §7.2 tool table rather than invented here, so a later stage can
 *    serialise it without a translation layer that could drift.
 * 3. **`source` is threaded through the reducer, not around it.** Feedback that
 *    signals a hand — the clicker and haptics — is suppressed at exactly one
 *    place, inside the detent reducer, so no call site can forget. Nothing in
 *    this stage emits anything but `"human"`; the seam exists so that the day
 *    something does, the rule is already enforced.
 *
 * What this file deliberately does **not** contain: any notion of an agent
 * being present, attached, connected or idle. The browser supplies no such
 * fact — a page learns an agent exists only when a tool executes — so the only
 * agent-related state here is {@link agentActiveAtom}, which means "the agent
 * acted most recently", and nothing more.
 */

import type { Atom, PrimitiveAtom, WritableAtom } from 'jotai/vanilla'
import { atom } from 'jotai/vanilla'

import { densityOverrideStateAtom, dynamicTypeScaleStateAtom } from './internal'

/* ────────────────────────────────────────────────────────────────────────────
 * Actors
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Who caused a movement, as declared by the caller.
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
 * Three things have an opinion: the screen (a preference, per the 001 §3.1
 * inventory), the human (a Display & Feel setting), and Dynamic Type (which
 * forces `airy` at 130% and above). {@link effectiveDensityAtom} reconciles
 * them, and is the only one of the four that anything should lay out against.
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
  /**
   * The density this screen *prefers*, from the 001 §3.1 inventory.
   *
   * ⚑ Not necessarily the density it renders at. The device setting overrides
   * it and Dynamic Type overrides both — see {@link effectiveDensityAtom},
   * which is the only value anything should lay out or page against. This
   * field is the screen's opinion, kept per frame so that popping back to a
   * `compact` list from an `airy` one restores the right preference.
   */
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
   * see; a reader that requests offscreen rows gets the whole set.
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
  /**
   * The density actually in force — {@link effectiveDensityAtom}, not
   * `frame.density`.
   *
   * Passed in rather than read off the frame because the frame only carries a
   * preference. Taking it from the frame here is precisely the bug this
   * parameter exists to prevent: the window size and the rendered row height
   * would then disagree, which shows up as a row you can never scroll to.
   */
  readonly density: Density
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
   * Angular speed, in deg/s, above which fast-scroll engages on the touch arc
   * (design-system §9.4). The mouse thresholds are these scaled by
   * {@link DETENT.mouseAccelScale}.
   *
   * ⚑ 720, not 240. pm-spec §4.4's table says 240/540 → ×1/×3/×7;
   * design-system §9.4, *The wheel inertia and detent model*, says
   * 720/1080 → ×1/×4/×12. **§9.4 governs** (D-063): acceleration physics is
   * its subject and §4.4's aside, and the specialist section beats the summary
   * table — the same shape as §12.0's geometry re-derivation beating §7.3's
   * stale column.
   */
  fastThresholdDegPerSec: 720,
  /** Angular speed above which one detent moves 12 rows (design-system §9.4). */
  fasterThresholdDegPerSec: 1080,
  /**
   * Both arc thresholds are multiplied by this on the mouse path.
   *
   * A mouse arc is jerkier than a thumb arc, so the touch thresholds produce
   * false fast-scroll on a mouse.
   */
  mouseAccelScale: 1.4,
  /** Rows per detent below the first threshold (design-system §9.4). */
  rowsSlow: 1,
  /** Rows per detent between the two thresholds (design-system §9.4). */
  rowsFast: 4,
  /** Rows per detent above the second threshold (design-system §9.4). */
  rowsFaster: 12,
  /**
   * The row multiplier is averaged over this many detents.
   *
   * Without the smoothing the multiplier jumps mid-flick and the list becomes
   * uncontrollable exactly when the human is least able to correct it.
   */
  multiplierSmoothingDetents: 3,
  /**
   * The list must be longer than this before fast-scroll can engage
   * (design-system §9.4).
   *
   * ⚑ A precondition pm-spec §4.4 does not have at all, and without it a
   * twelve-row menu enters fast-scroll on a brisk flick and jumps four rows
   * per detent through a list that is four rows long. §9.4: *"Engages when
   * |ω| > 720 °/s **and** the list exceeds 40 items."* The reason it exists is
   * §9.4's own argument for the whole feature — fast-scroll is what makes the
   * wheel beat a flat list on a 4,000-item library, and a short list has
   * nothing for it to beat.
   */
  fastScrollMinRows: 40,
  /**
   * Above this detent rate the `selection` haptic stops firing (001 §4.9).
   *
   * A fast flick would otherwise mean a continuous buzz, which reads as a
   * fault rather than as feedback, and drains the actuator.
   */
  hapticSuppressAbovePerSec: 12,
  /**
   * Angular velocity retained per frame once the finger leaves.
   *
   * The wheel does not stop when the thumb does. 0.94 per frame gives a ~1.1s
   * glide from a hard flick — long enough to read as a flywheel, short enough
   * not to feel out of control.
   *
   * ⚑ **Per frame *at 60fps*, and the design system says so in the same
   * breath.** design-system §9.4: *"angular velocity ω decays per frame:
   * `ω *= 0.940` at 60fps (normalised to `ω *= 0.940^(dt/16.67ms)`)"*. The
   * normalisation is not an interpretation of an under-specified constant —
   * it is written into the source, and an earlier version of this reducer
   * decayed per *call* while scaling distance per *second*, which made the
   * same flick travel four times as far at 30fps as at 120fps. On a product
   * whose accessibility case is that movement is countable, that is the
   * counting model breaking on hardware rather than on input: a ProMotion
   * phone dropping to a lower refresh rate under Low Power Mode would land the
   * same gesture on a different row.
   *
   * Consumed only through {@link DETENT.coastReferenceFps}. Nothing should
   * multiply by this constant once per call.
   */
  coastDecayPerFrame: 0.94,
  /**
   * The frame rate {@link DETENT.coastDecayPerFrame} was authored at
   * (design-system §9.4, and D-060).
   *
   * Turns a per-frame decay into a per-second one:
   * `0.94 ** (elapsedSeconds * 60)`. Every display then sees the same physics,
   * and 60fps still sees exactly 0.94.
   */
  coastReferenceFps: 60,
  /**
   * Angular speed below which a coast is over, in deg/s (001 §4.4).
   *
   * A floor rather than a decay to zero: 0.94^n never reaches zero, and a
   * wheel that keeps almost-moving forever is worse than one that stops.
   *
   * ⚑ **Two primaries disagree on this number and the disagreement is
   * unresolved.** pm-spec §4.4 says *"until |ω| < 60°/s"*; design-system §9.4
   * says *"stop when |ω| < 0.35 °/frame (≈21 °/s)"*. 60 is transcribed here
   * because the dispatch names §4.4's table as the engineering contract for
   * the four input paths, and because every other number in this block comes
   * from it — mixing one §9.4 value into a §4.4 model would be less coherent
   * than either source alone. Raised for a ruling; see `decisions/w2.md`.
   */
  coastFloorDegPerSec: 60,
} as const

/**
 * A single measured input event, before it becomes detents.
 *
 * Every variant carries `source` and `timestampMs`. The timestamp is passed in
 * rather than read from a clock inside the reducer, which is what makes a
 * 30-detent flick reproducible in a test with no fake timers.
 *
 * ## The clock domain of `timestampMs`
 *
 * ⚑ `timestampMs` is used **only for differences within one gesture** — the
 * angular speed between two events, and the gap that separates a deliberate
 * keypress from an auto-repeat. It is never compared against any other clock.
 * So it must be monotonic and consistent across a gesture, and it does not
 * have to share an origin with anything: `event.timeStamp` is the right value
 * in a browser, and it sits on the `performance.now()` origin.
 *
 * This used to matter much more than it does now, and the history is worth
 * one sentence because the bug it caused was invisible. The announcement
 * debounce originally compared `timestampMs + 350` against the driver's own
 * `Date.now()`. Feeding it the idiomatic `event.timeStamp` — a number around
 * `1e4` against a clock around `1.8e12` — made every due time appear already
 * elapsed, so a thirty-detent flick announced thirty times instead of once,
 * failing the U13 gate wide open and in the loud direction. The fix was not to
 * document a rule for callers to follow: it was to stop having two clocks.
 * The announcer now reads {@link clockAtom}, which the store owns, and no
 * caller-supplied timestamp reaches it. A mismatch is unconstructible rather
 * than merely discouraged.
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
      /** Origin label for an agent-sourced movement. See the `direct` variant. */
      readonly agentOrigin?: string
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
      /** Origin label for an agent-sourced movement. See the `direct` variant. */
      readonly agentOrigin?: string
    }
  | {
      readonly path: 'key'
      readonly source: DetentSource
      /** `1` for `ArrowDown`, `-1` for `ArrowUp`. */
      readonly direction: 1 | -1
      /**
       * `true` when Shift is held: one full viewport of rows, deterministically.
       *
       * How many rows that is comes from `viewportRows` on the reducer call,
       * not from this event. See {@link DetentFn}.
       */
      readonly page: boolean
      readonly timestampMs: number
      /** Origin label for an agent-sourced press. See {@link DetentInput}. */
      readonly agentOrigin?: string
    }
  | {
      readonly path: 'direct'
      readonly source: DetentSource
      /** A signed detent count supplied by the caller, already discretised. */
      readonly detents: number
      readonly timestampMs: number
      /**
       * Origin label written into {@link DetentOutcome.actor} when `source` is
       * `"agent"`.
       *
       * The platform supplies no such identifier, so this is whatever the tool
       * layer knows about its caller and nothing more; when it knows nothing,
       * the tag reads `agent:unknown`. It exists so two agents are
       * distinguishable in the provenance log, not to assert that either one
       * is present.
       */
      readonly agentOrigin?: string
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
  /**
   * Who is driving this gesture, or `null` when idle.
   *
   * Carried so that a coasting gesture — which continues after the last input
   * event and therefore has no event to read `source` from — is still gated by
   * the silence rule. Without it, the coast would be the one path where an
   * agent could make the device click.
   */
  readonly source: DetentSource | null
  /**
   * Which way the gesture is travelling: `1` down, `-1` up, `0` at rest.
   *
   * {@link speedDegPerSec} is a magnitude, because the acceleration curve only
   * cares how fast. The coast needs to know which way as well.
   */
  readonly direction: 1 | -1 | 0
  /**
   * `true` between the release of an arc gesture and the moment its momentum
   * dies.
   *
   * The finger has left, but the wheel has not stopped, and detents fired
   * during this window are as real as any other — 001 §4.4 is explicit that
   * every coasted detent still clicks.
   */
  readonly coasting: boolean
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
  source: null,
  direction: 0,
  coasting: false,
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
  /**
   * Rows moved per detent by this event.
   *
   * ⚑ Not always `1` on the key path: `Shift` makes it one full viewport. What
   * *is* always true on the key path is that it is never a **velocity**
   * multiplier — it is `1`, or a page, and never a function of how fast the
   * key is being pressed. Read {@link accelerated} to assert that; reading
   * this field for it gives a false positive on every `Shift+Arrow`.
   */
  readonly multiplier: number
  /**
   * `true` when {@link multiplier} was raised because the input was *fast*.
   *
   * This is the field that means "the device decided to move further than it
   * was told". It is `false` for every keyboard event including `Shift+Arrow`,
   * `false` on the scroll path always, and `false` for any programmatic
   * movement — those are the paths on which counted navigation must hold.
   */
  readonly accelerated: boolean
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
 * @param screen - What the reducer needs to know about the list, currently
 *   just its length: fast-scroll does not engage on a list of
 *   {@link DETENT.fastScrollMinRows} rows or fewer (design-system §9.4).
 *   Omitting it disables fast-scroll entirely, which is the safe default for a
 *   caller that does not know.
 * @param viewportRows - How many rows fit on screen, for `Shift+Arrow`. ⚑ Must
 *   be a {@link VISIBLE_ROWS} value for the effective density. It is a
 *   parameter rather than a field on the event because it is a property of the
 *   screen, not of the keypress — and because passing it here means the store,
 *   which is the only thing that knows the density, is the one that supplies
 *   it. `detentActionAtom` reads {@link visibleRowCountAtom} and passes it, so
 *   no caller can page by the wrong number.
 * @returns The movement, the feedback budget, and the accumulator to carry
 *   forward. Never mutates its arguments.
 */
export type DetentFn = (
  accumulator: DetentAccumulator,
  input: DetentInput,
  viewportRows: number,
  screen?: ScreenMetrics,
) => DetentOutcome

/**
 * What the reducer needs to know about the list it is moving through.
 *
 * Only `totalRows` for now, and it is optional: a caller that omits it gets
 * no fast-scroll, which is the safe direction. `detentActionAtom` supplies it
 * from the current frame, so the seam W3 uses always has it — the same shape
 * as `viewportRows`, and for the same reason.
 */
export type ScreenMetrics = {
  /** Rows on the screen, including those outside the window. */
  readonly totalRows: number
}

/**
 * Lifts the finger: discards residual travel, and hands the wheel its momentum.
 *
 * Residual below one detent is dropped rather than rounded up: rounding fires
 * a phantom detent the human never made, on every single gesture that ends
 * mid-detent, which is most of them.
 *
 * ⚑ Momentum is **not** dropped. An arc released above
 * {@link DETENT.coastFloorDegPerSec} returns an accumulator with `coasting`
 * set, and the caller drives {@link CoastStepFn} once per frame until it comes
 * back to rest (001 §4.4, Release row). A release below the floor, and every
 * release on the scroll, key and direct paths, returns the idle accumulator —
 * there is no momentum in a keypress.
 */
export type EndGestureFn = (accumulator: DetentAccumulator) => DetentAccumulator

/**
 * Advances a coasting wheel by one frame.
 *
 * 001 §4.4: *"remaining angular velocity decays at 0.94/frame, firing a detent
 * every 15° until |ω| < 60°/s. Every coasted detent still clicks."* All three
 * clauses live here — including the third, which is why this returns a full
 * {@link DetentOutcome} rather than a bare row count. A coasted detent is a
 * detent: it clicks, it buzzes, it announces, and it obeys the silence rule
 * through the `source` the accumulator carried out of the gesture.
 *
 * ⚑ The frame loop belongs to the caller, exactly as the announcement timer
 * belongs to the store. This package holds no `requestAnimationFrame`: the
 * physics is a pure function of `(accumulator, seconds)` so that a whole
 * coast can be replayed in a test at any frame rate, including rates no
 * display has.
 *
 * @param accumulator - Must have `coasting` set; anything else is a no-op that
 *   returns the idle accumulator, so a caller that over-runs its loop by a
 *   frame does not resurrect a dead gesture.
 * @param frameSeconds - Elapsed time for this frame. The decay is specified
 *   per *frame* rather than per second, so this scales the distance travelled
 *   and not the decay itself.
 *
 * There is no `viewportRows` parameter, unlike {@link DetentFn}: a coast is
 * momentum, and momentum never pages.
 */
export type CoastStepFn = (
  accumulator: DetentAccumulator,
  frameSeconds: number,
  screen?: ScreenMetrics,
) => DetentOutcome

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
  /** Origin label for an agent-sourced press. See {@link DetentInput}. */
  readonly agentOrigin?: string
}

/*
 * ⚑ There is deliberately no `timestampMs` on a press. A press has no
 * duration and no velocity, so nothing about it needs a caller's clock — and
 * the one thing it *publishes* that carries a time, {@link BumpEvent.at}, is
 * stamped from {@link clockAtom} like every other time in this package. The
 * field existed, was unused by the time the bump was fixed, and was removed
 * rather than left as somewhere a second time base could re-enter.
 */

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
  /**
   * When the bump happened, on the device clock ({@link clockAtom}).
   *
   * ⚑ Always the device clock, from all three writers. This field previously
   * carried whatever time the caller passed for a `Menu` or transport press
   * and the device clock for a wheel bump — one field, one atom, two time
   * bases, chosen by which control the human touched. A panel ageing a bump
   * with `now - bump.at` got a sane answer for one and a number near 1.7e12
   * for the other. There is now no parameter through which a caller can supply
   * a time to any of the three.
   */
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

/**
 * Decides whether a menu row is shown at all.
 *
 * ⚑ Absent, never greyed (001 §14.4, §15.3 #7). A row for something this
 * account can never do is a promise the product cannot keep, and a *disabled*
 * row is worse than no row: it advertises the promise and then refuses it.
 * `Radio` is dropped outright when the provider cannot make stations, and
 * `Now Playing` when no audio is loaded.
 *
 * Returning `true` for everything — the default — is the honest answer before
 * a provider exists to ask, which is the state the device is in at
 * construction.
 */
export type MenuVisibility = (node: MenuNode) => boolean

/** The result of a screen-machine transition. */
export type ScreenTransition = {
  readonly stack: readonly ScreenFrame[]
  /**
   * The direction to rubber-band in, or `null` when the movement landed
   * somewhere.
   *
   * ⚑ `Menu` at the root always produces a bump and is never a no-op.
   *
   * A direction rather than a {@link BumpEvent}: the machine is pure, so it
   * has neither a clock nor a counter. The store stamps `seq` and `at` when it
   * publishes the bump, which is also the only place that can guarantee `seq`
   * is monotonic.
   */
  readonly bump: BumpDirection | null
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
export type PopScreenFn = (stack: readonly ScreenFrame[]) => ScreenTransition

/**
 * Pages the highlight by one full viewport (001 §4.3).
 *
 * `⏭` and `⏮` on a list screen, and `Shift+Arrow` from the keyboard. Paging is
 * deliberately **not** select: the mental model that only Center commits has
 * to survive the fact that the transport buttons do something on a list.
 */
export type PageFn = (
  stack: readonly ScreenFrame[],
  direction: 1 | -1,
  visibleRows: number,
) => ScreenTransition

/** What a button press did. */
export type PressOutcome = {
  readonly button: PressButton
  /** The stack after the press. */
  readonly stack: readonly ScreenFrame[]
  readonly bump: BumpDirection | null
  /**
   * `false` when the machine had nothing to do with this press.
   *
   * `Center` on a screen whose rows come from a provider is the ordinary case:
   * the machine knows the menu hierarchy but not what is inside an album, so
   * it declines rather than guessing, and the layer holding the data pushes
   * the frame.
   */
  readonly handled: boolean
  /** The provenance tag, derived from `source` — never supplied by the caller. */
  readonly actor: Actor
  /** `true` when this press produced no sound, for the reason in {@link DetentOutcome.silenced}. */
  readonly silenced: boolean
  /** Clicker ticks to play. `0` when silenced. */
  readonly clickerTicks: number
}

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
 * The movement waiting to settle, if there is one.
 *
 * It holds a *due time* rather than a timer handle. Nothing here schedules
 * anything: the pure part decides when an announcement is due and the store
 * binding owns the single `setTimeout` that asks. That split is what lets the
 * 30-detent test assert "exactly one announcement" without fake timers.
 */
export type AnnouncerState = {
  /** The movement to describe when the debounce elapses, or `null`. */
  readonly settling: SettlingMovement | null
  /** Timestamp at which {@link settling} becomes due, or `null`. */
  readonly dueAtMs: number | null
  /** Emissions so far. Becomes {@link Announcement.seq}. */
  readonly emitted: number
}

/**
 * A movement waiting to be summarised.
 *
 * It holds the snapshot *and* the source, because who moved the highlight
 * changes the sentence: a human hears where they are, and a human whose device
 * moved without them needs to hear that first.
 *
 * Only one is ever held. A flick replaces it thirty times and announces
 * once, which is the entire point.
 */
export type SettlingMovement = {
  readonly snapshot: ScreenSnapshotSource
  readonly source: DetentSource
}

/** The announcer at rest. */
export const IDLE_ANNOUNCER_STATE: AnnouncerState = {
  settling: null,
  dueAtMs: null,
  emitted: 0,
}

/**
 * Records that the highlight moved, and decides when it will be announced.
 *
 * Calling this repeatedly during a flick replaces the settling snapshot and
 * pushes the due time out; it never queues a second announcement. An
 * `immediate` urgency emits on the spot and clears whatever was settling, so a
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
 * Emits the settling announcement if it is due at `nowMs`, otherwise nothing.
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
 * A monotonic clock, in milliseconds.
 *
 * One per device, so that everything which compares two times compares them on
 * the same scale.
 */
export type Clock = () => number

/**
 * A {@link Clock} in a box, so it can live in an atom.
 *
 * See {@link clockAtom} for why the box is required rather than tidy.
 */
export type ClockHolder = { readonly now: Clock }

/**
 * The device's clock. Every time comparison in this package goes through it.
 *
 * ⚑ This exists because two clocks is a real bug, not a hypothetical one. The
 * announcement debounce used to compare a caller-supplied `timestampMs` — for
 * which `event.timeStamp`, on the `performance.now()` origin, is the idiomatic
 * browser value — against the driver's own `Date.now()`. Every due time then
 * looked long past, so a thirty-detent flick announced thirty times: U13
 * failing open, in the loud direction, invisible to anyone not listening.
 *
 * The fix is structural rather than documentary. Nothing compares a caller's
 * timestamp against a clock any more: `detentActionAtom` stamps movements with
 * *this* clock, and `startAnnouncer` reads *this* clock, so there is one time
 * scale per device and a mismatch cannot be constructed. A caller's
 * `timestampMs` is used only for differences inside one gesture.
 *
 * Held in an atom so a test can substitute a deterministic clock through
 * `createDeviceStore({ now })` and drive the debounce by hand.
 *
 * ⚑ Boxed in an object, and that is not decoration. `atom(someFunction)` does
 * **not** create an atom holding that function — jotai reads a function
 * argument as a *derived* atom's read callback, so the atom would compute a
 * number and every `get(clockAtom)()` would throw "is not a function". A
 * function can only be stored in an atom by wrapping it.
 */
export const clockAtom: PrimitiveAtom<ClockHolder> = atom<ClockHolder>({ now: defaultNow })

/**
 * The clock a device gets when none is supplied.
 *
 * `performance.now()` where it exists, because it is monotonic — it does not
 * step backwards when the system clock is corrected, and a backward step
 * between arming a debounce and firing it would strand the announcement. Falls
 * back to `Date.now()` only where `performance` is absent.
 */
export function defaultNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

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
 * The human's density setting, or `null` to follow each screen's preference.
 *
 * 001 §11: `Row Density: Compact / Medium / Airy` on the Display & Feel plate.
 * `null` is the shipped default and means "whatever this screen prefers" —
 * which is not the same as `medium`, and conflating the two would silently
 * flatten the §3.1 inventory's per-screen choices.
 *
 * ⚑ This is an *input* to the density that is in force, not the density
 * itself. Read {@link effectiveDensityAtom} to lay out or to page.
 *
 * ⚑ **Read-only, and that is the fix rather than an inconvenience.** Writing
 * it directly used to be documented as fine, on the reasoning that every
 * derived reader moves together — which is true and is not the whole story.
 * The scroll windows are not derived; they are stored per frame, and a
 * `compact` window of 8 rows is out of range the moment `airy` cuts the
 * viewport to 4. Measured, with the highlight on row 60: the bare write left
 * the window showing rows 53–56, so the highlighted row was not among the rows
 * rendered. Change it through `setDensityActionAtom`, which re-clamps.
 */
export const densityOverrideAtom: Atom<Density | null> = densityOverrideStateAtom

/**
 * Dynamic Type scale, `1` being the system default.
 *
 * 001 §15.0 U11: at 130% or more the device forces `airy` and scales the
 * raster 1.0 → 1.25 **rather than clipping the text**. The forcing half is
 * implemented by {@link effectiveDensityAtom}; the raster scale belongs to
 * whatever draws the raster and reads this same atom, so the two cannot come
 * to different conclusions about what 130% means.
 *
 * ⚑ Read-only, for the reason given on {@link densityOverrideAtom}. Change it
 * through `setDynamicTypeScaleActionAtom`.
 */
export const dynamicTypeScaleAtom: Atom<number> = dynamicTypeScaleStateAtom

/**
 * The scale at or above which `airy` is forced (001 §15.0 U11).
 *
 * A literal from the gate, kept here so a test can assert against `1.3`
 * directly rather than against a symbol that would move with the bug.
 */
export const AIRY_FORCING_TYPE_SCALE = 1.3


/**
 * The navigation stack, root first.
 *
 * ⚑ **Empty until a store seeds it**, which `createDeviceStore` does at
 * construction. It is not "never empty": this atom is exported, so a consumer
 * can read it before any screen exists, and an earlier version of this comment
 * claimed otherwise while the atom's own default contradicted it. Every
 * consumer here handles the empty case explicitly — `currentScreenAtom`
 * returns `null`, `visibleRowsAtom` returns `[]`, and `popScreen` treats it as
 * "no device yet" rather than as the root, so `Menu` on an empty stack does
 * not bump to announce the top of a stack that has no top.
 *
 * The screen machine is the only thing that should *write* it: a call site
 * that navigates goes through a transition, so the bump on a hard stop cannot
 * be skipped.
 */
export const screenStackAtom: PrimitiveAtom<readonly ScreenFrame[]> = atom<readonly ScreenFrame[]>(
  [],
)

/** Gesture state for the detent reducer. */
export const detentAccumulatorAtom: PrimitiveAtom<DetentAccumulator> = atom(IDLE_DETENT_ACCUMULATOR)

/** The movement waiting to settle, if there is one. */
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

/**
 * The density actually in force: the one thing that lays out and pages.
 *
 * Precedence, highest first:
 *
 * 1. **Dynamic Type ≥ 130% forces `airy`.** An accessibility floor outranks a
 *    preference, including the human's own — U11 is about text that fits.
 * 2. **The human's setting**, when they have made one.
 * 3. **The screen's preference** from 001 §3.1.
 *
 * Derived rather than stored, so there is no combination of writes that leaves
 * a stale answer behind, and no writer that has to remember to recompute. This
 * atom is why {@link densityOverrideAtom} is not inert: setting it moves the
 * viewport size, the page size and the reported snapshot together, because all
 * three read this.
 */
export const effectiveDensityAtom: Atom<Density> = atom((get) => {
  if (get(dynamicTypeScaleStateAtom) >= AIRY_FORCING_TYPE_SCALE) return 'airy'
  const override = get(densityOverrideStateAtom)
  if (override !== null) return override
  return get(currentScreenAtom)?.density ?? 'medium'
})

/**
 * How many rows fit on screen right now.
 *
 * Reads {@link effectiveDensityAtom} — the reconciled answer — and nothing
 * else. Every other candidate is a half-truth: the frame carries only the
 * screen's preference, and the override atom is silent about Dynamic Type.
 * Taking the count from either would let the window size and the rendered row
 * height disagree by one row, which is the kind of off-by-one that shows up as
 * a row you can never scroll to.
 */
export const visibleRowCountAtom: Atom<number> = atom(
  (get) => VISIBLE_ROWS[get(effectiveDensityAtom)],
)

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
    density: get(effectiveDensityAtom),
    rows: get(visibleRowsAtom),
    highlightIndex: frame.highlightIndex,
    totalRows: frame.rows.length,
    visibleRows: get(visibleRowCountAtom),
    agentActive: get(agentActiveAtom),
  }
})
