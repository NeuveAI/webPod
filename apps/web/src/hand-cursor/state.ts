import { atom, createStore } from 'jotai/vanilla'

export const HAND_POSES = ['idle', 'pinch', 'grab', 'press'] as const
export type HandPose = (typeof HAND_POSES)[number]

/** Public, skin-independent cursor input. Shared by DOM callbacks and rendering. */
export interface HandInput {
  readonly x: number
  readonly y: number
  readonly time: number
  readonly visible: boolean
  readonly down: boolean
  readonly pose: HandPose
  readonly reducedMotion: boolean
}

export const INITIAL_HAND_INPUT: HandInput = {
  x: 0, y: 0, time: 0, visible: false, down: false, pose: 'idle', reducedMotion: false,
}
export const handInputAtom = atom<HandInput>(INITIAL_HAND_INPUT)
export const handSkinAtom = atom('/hand/classic-glove.glb')
export const handStore = createStore()

/** Resolve existing authoritative player affordances without a second hit test. */
export function handPoseAt(target: Element | null, down: boolean): HandPose {
  // Pointer capture can carry a held enclosure over unrelated DOM controls.
  if (target?.ownerDocument.querySelector('[data-orientation-grab="active"]')) return 'grab'
  const stage = target?.closest('[data-orientation-grab]')
  const orientation = stage?.getAttribute('data-orientation-grab')
  if (orientation === 'active') return 'grab'
  if (orientation === 'ready') return down ? 'grab' : 'pinch'
  if (target?.closest('button, a[href], summary, [role="button"], [data-wp-cursor-control="true"], input[type="range"]')) {
    return 'press'
  }
  return down ? 'press' : 'idle'
}

/** Keep native precision/text cursors and native disabled affordances. */
export function usesNativeCursor(target: Element | null): boolean {
  if (!target) return false
  return target.closest('input:not([type="range"]), textarea, select, [contenteditable]:not([contenteditable="false"]), [data-native-cursor], :disabled, [aria-disabled="true"]') !== null
}
