/**
 * Writable state that must not be writable from outside this package.
 *
 * ⚑ This module is **not** re-exported by `index.ts`, and `package.json` has a
 * closed export map containing only `.` and `./testing`; `./internal` is not
 * exposed, so nothing outside can reach it through a package deep import.
 *
 * It exists for one shape of problem: state whose *derived* readers all stay
 * correct on a bare write, while something imperative does not. Density is the
 * case. Writing the override moves `effectiveDensityAtom`,
 * `visibleRowCountAtom` and the reported snapshot together, exactly as its
 * TSDoc promised — and leaves every frame's scroll window sized for the old
 * viewport, which is a stack edit no derived read can perform. The measured
 * result was the highlight on row 60 with the window showing rows 53–56: the
 * highlighted row not among the rows rendered, which is the "row you can never
 * scroll to" the density work exists to prevent, reachable through the route a
 * doc comment recommended.
 *
 * A comment asking callers to use the setter is not a fix; it is the same
 * unowned-invariant shape as exporting a rule to a future consumer. So the
 * primitives live here, `contract.ts` publishes read-only views of them, and
 * the only way to change density from outside is the action atom that also
 * re-clamps the windows.
 */

import { atom } from 'jotai/vanilla'
import type { PrimitiveAtom } from 'jotai/vanilla'

import type {
  Density,
  InteractionFeedbackEvent,
  NowPlayingModeState,
  NowPlayingVolumeFeedbackState,
  NowPlayingWheelControl,
  NowPlayingWheelIntent,
} from './contract'

/**
 * The human's density setting, writable. Published read-only as
 * `densityOverrideAtom`; changed through `setDensityActionAtom`.
 */
export const densityOverrideStateAtom: PrimitiveAtom<Density | null> = atom<Density | null>(null)

/**
 * The Dynamic Type scale, writable. Published read-only as
 * `dynamicTypeScaleAtom`; changed through `setDynamicTypeScaleActionAtom`.
 */
export const dynamicTypeScaleStateAtom: PrimitiveAtom<number> = atom(1)

/**
 * The latest eligible physical-feedback budget, writable only by store actions.
 * Published read-only as `interactionFeedbackAtom`; consumers subscribe and
 * perform the side effect without gaining a second route to manufacture one.
 */
export const interactionFeedbackStateAtom: PrimitiveAtom<InteractionFeedbackEvent | null> =
  atom<InteractionFeedbackEvent | null>(null)

/** Now Playing display state, writable only through state actions. */
export const nowPlayingModeStateAtom: PrimitiveAtom<NowPlayingModeState> = atom<NowPlayingModeState>({
  frame: null,
  mode: 'standard',
  scrub: 'clean',
  scrubRevision: 0,
  queue: 'clean',
})

/** Human-origin volume feedback, advanced only by authoritative store actions. */
export const nowPlayingVolumeFeedbackStateAtom: PrimitiveAtom<NowPlayingVolumeFeedbackState> =
  atom<NowPlayingVolumeFeedbackState>({
    visibility: 'hidden',
    frame: null,
    occurrenceIdentity: null,
    value: 0,
    revision: 0,
    dueAtMs: null,
  })

/** Active provider-backed wheel control, writable only through the store action. */
export const nowPlayingWheelControlStateAtom: PrimitiveAtom<NowPlayingWheelControl | null> =
  atom<NowPlayingWheelControl | null>(null)

/** Latest accepted Now Playing wheel movement. */
export const nowPlayingWheelIntentStateAtom: PrimitiveAtom<NowPlayingWheelIntent | null> =
  atom<NowPlayingWheelIntent | null>(null)
