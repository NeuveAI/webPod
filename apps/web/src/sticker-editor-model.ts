import { atom } from 'jotai'
import { deviceStore, stickerInventoryAtom } from '@webpod/state'
import { isStickerPlacement, type StickerPlacement } from '@webpod/stickers'

export const STICKER_SELECT_TRAVEL = 7
export type StickerEditorProperty = 'rotationDeg' | 'width' | 'wear'
export interface StickerEditorState {
  readonly source: StickerPlacement
  readonly draft: StickerPlacement
  readonly property: StickerEditorProperty
  readonly phase: 'editing' | 'saving'
  readonly message: string | null
  readonly keyboard: boolean
}
export const stickerEditorAtom = atom<StickerEditorState | null>(null)
export const stickerEditorFailureAtom = atom<{ readonly stickerId: string; readonly message: string; readonly attempted?: StickerPlacement; readonly expected?: StickerPlacement } | null>(null)
export const stickerEditorPendingAtom = atom<Readonly<Record<string, StickerPlacement>>>({})
export const stickerEditorUndoAtom = atom<{ readonly before: StickerPlacement; readonly after: StickerPlacement } | null>(null)
export const stickerEditorGestureAtom = atom(false)
export const stickerEditorCancelAtom = atom(0)
export function cancelStickerEditorGesture(): void { deviceStore.set(stickerEditorCancelAtom, n => n + 1) }
export function stickerEditPending(id: string): boolean { return deviceStore.get(stickerEditorPendingAtom)[id] !== undefined }
let session = 0
export function sameStickerPose(a: StickerPlacement, b: StickerPlacement): boolean {
  return a.stickerId === b.stickerId && a.x === b.x && a.y === b.y && a.width === b.width && a.rotationDeg === b.rotationDeg && (a.wear ?? 0) === (b.wear ?? 0)
}
export const stickerEditorDirtyAtom = atom((get) => { const state = get(stickerEditorAtom); return state !== null && !sameStickerPose(state.source, state.draft) })
export const stickerEditorPlacementsAtom = atom((get) => {
  const inventory = get(stickerInventoryAtom), state = get(stickerEditorAtom)
  return (inventory?.placements ?? []).map((item) => state?.source.stickerId === item.stickerId ? state.draft : item)
})
export function selectStickerEditor(source: StickerPlacement, keyboard = false): void {
  deviceStore.set(stickerEditorFailureAtom, null)
  deviceStore.set(stickerEditorAtom, { source, draft: source, property: 'rotationDeg', phase: stickerEditPending(source.stickerId) ? 'saving' : 'editing', message: null, keyboard })
}
export function dismissStickerEditor(): void { deviceStore.set(stickerEditorAtom, null); deviceStore.set(stickerEditorGestureAtom, false) }
export function resetStickerEditor(): void { session += 1; dismissStickerEditor(); deviceStore.set(stickerEditorFailureAtom, null); deviceStore.set(stickerEditorPendingAtom, {}); deviceStore.set(stickerEditorUndoAtom, null) }
export function revertStickerEditor(): void {
  const state = deviceStore.get(stickerEditorAtom)
  if (state?.phase === 'editing') deviceStore.set(stickerEditorAtom, { ...state, draft: state.source, message: null })
}
export function setStickerEditorProperty(property: StickerEditorProperty): void {
  const state = deviceStore.get(stickerEditorAtom)
  if (state !== null) deviceStore.set(stickerEditorAtom, { ...state, property })
}
/** Clamp along the requested edit path at this fixed center, never translate the print. */
export function constrainedStickerEdit(source: StickerPlacement, property: StickerEditorProperty, value: number): StickerPlacement {
  if (!Number.isFinite(value)) return source
  const requested = { ...source, [property]: value }
  if (isStickerPlacement(requested)) return requested
  const initial = property === 'wear' ? source.wear ?? 0 : source[property]
  let low = 0, high = 1
  for (let step = 0; step < 24; step++) {
    const mid = (low + high) / 2
    if (isStickerPlacement({ ...source, [property]: initial + (value - initial) * mid })) low = mid
    else high = mid
  }
  return { ...source, [property]: initial + (value - initial) * low }
}
export function previewStickerEdit(value: number): void {
  const state = deviceStore.get(stickerEditorAtom)
  if (state === null || state.phase === 'saving') return
  const draft = constrainedStickerEdit(state.draft, state.property, value)
  const actual = state.property === 'wear' ? draft.wear ?? 0 : draft[state.property]
  deviceStore.set(stickerEditorAtom, { ...state, draft, message: Math.abs(actual - value) > .001 ? 'That is the edge of the backplate.' : null })
}
type StickerWrite = (placement: StickerPlacement, expectedSource?: StickerPlacement) => Promise<void>
export async function applyStickerEditor(place: StickerWrite, undo = false): Promise<void> {
  const state = deviceStore.get(stickerEditorAtom)
  if (state === null || stickerEditPending(state.source.stickerId) || sameStickerPose(state.source, state.draft)) return
  const id = state.source.stickerId, lease = session
  deviceStore.set(stickerEditorPendingAtom, (pending) => ({ ...pending, [id]: state.draft }))
  deviceStore.set(stickerEditorAtom, { ...state, phase: 'saving', message: null })
  try {
    await place(state.draft, state.source)
    if (lease !== session) return
    const saved = deviceStore.get(stickerInventoryAtom)?.placements.find((item) => item.stickerId === id)
    if (saved === undefined) {
      if (deviceStore.get(stickerEditorAtom)?.source.stickerId === id) dismissStickerEditor()
      deviceStore.set(stickerEditorFailureAtom, { stickerId: id, message: 'This sticker is no longer on your iPod.' })
    } else {
      deviceStore.set(stickerEditorUndoAtom, undo ? null : { before: state.source, after: saved })
      const current = deviceStore.get(stickerEditorAtom)
      if (current?.source.stickerId === id) deviceStore.set(stickerEditorAtom, { ...current, source: saved, draft: saved, phase: 'editing', message: null })
    }
  } catch (cause) {
    if (lease !== session || deviceStore.get(stickerInventoryAtom) === null) return
    const conflict = typeof cause === 'object' && cause !== null && 'status' in cause && cause.status === 409
    const saved = deviceStore.get(stickerInventoryAtom)?.placements.find((item) => item.stickerId === id)
    const message = conflict ? 'Changed elsewhere. Adjust again.' : 'Couldn’t save.'
    deviceStore.set(stickerEditorFailureAtom, { stickerId: id, message, ...(conflict ? {} : { attempted: state.draft, expected: state.source }) })
    if (conflict) deviceStore.set(stickerEditorUndoAtom, null)
    const current = deviceStore.get(stickerEditorAtom)
    if (current?.source.stickerId === id) {
      if (saved === undefined) dismissStickerEditor()
      else deviceStore.set(stickerEditorAtom, { ...current, source: saved, draft: saved, phase: 'editing', message })
    }
  } finally {
    if (lease === session) deviceStore.set(stickerEditorPendingAtom, (pending) => { const next = { ...pending }; delete next[id]; return next })
  }
}
export function undoStickerEdit(place: StickerWrite): void {
  const undo = deviceStore.get(stickerEditorUndoAtom)
  if (undo === null || stickerEditPending(undo.after.stickerId)) return
  const current = deviceStore.get(stickerInventoryAtom)?.placements.find((p) => p.stickerId === undo.after.stickerId)
  if (current === undefined || !sameStickerPose(current, undo.after)) { deviceStore.set(stickerEditorUndoAtom, null); return }
  selectStickerEditor(current)
  deviceStore.set(stickerEditorAtom, (state) => state === null ? null : { ...state, draft: undo.before })
  void applyStickerEditor(place, true)
}
export function retryStickerEdit(place: StickerWrite): void {
  const failure = deviceStore.get(stickerEditorFailureAtom)
  if (failure?.attempted === undefined || failure.expected === undefined || stickerEditPending(failure.stickerId)) return
  const attempted = failure.attempted
  selectStickerEditor(failure.expected)
  deviceStore.set(stickerEditorAtom, (state) => state === null ? null : { ...state, draft: attempted })
  void applyStickerEditor(place)
}
