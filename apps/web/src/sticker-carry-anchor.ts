import { atom } from 'jotai'
import { deviceStore, stickerInteractionAtom, stickerCollectionStatusAtom } from '@webpod/state'
import type { StickerPlacement } from '@webpod/stickers'
import type { StickerCarryAnchor } from '@webpod/device'

interface CapturedAnchor { readonly pull: { readonly x: number; readonly y: number }; readonly source: StickerPlacement; readonly anchor: StickerCarryAnchor }
export const stickerCarryAnchorAtom = atom<CapturedAnchor | null>(null)
const sameSource = (a: StickerPlacement, b: StickerPlacement) => a.stickerId === b.stickerId && a.surface === b.surface && a.x === b.x && a.y === b.y && a.width === b.width && a.rotationDeg === b.rotationDeg && (a.wear ?? 0) === (b.wear ?? 0)
export const stickerSourceAnchorAtom = atom(get => {
  const captured = get(stickerCarryAnchorAtom), interaction = get(stickerInteractionAtom)
  return captured !== null && interaction.sourcePlacement != null && sameSource(captured.source, interaction.sourcePlacement) && ['peeling', 'placing', 'settling'].includes(interaction.stage) && get(stickerCollectionStatusAtom) !== 'signed-out' ? captured.anchor : null
})
export const stickerSourcePullAtom = atom(get => get(stickerSourceAnchorAtom) === null ? null : get(stickerCarryAnchorAtom)?.pull ?? null)
/** Uses current pointer delta, not maximum travel or compensated free-sheet offset. */
export function updateStickerSourcePull(source: StickerPlacement, pull: { readonly x: number; readonly y: number }, owner?: StickerCarryAnchor): void {
  const captured = deviceStore.get(stickerCarryAnchorAtom)
  if (captured === null || deviceStore.get(stickerSourceAnchorAtom) === null || !sameSource(source, captured.source) || owner !== undefined && owner !== captured.anchor || !Number.isFinite(pull.x) || !Number.isFinite(pull.y)) return
  deviceStore.set(stickerCarryAnchorAtom, { ...captured, pull: { x: pull.x, y: pull.y } })
}

/** Numeric local geometry only; no renderer objects or persistence payloads. */
export function copyStickerCarryAnchor(anchor: StickerCarryAnchor): StickerCarryAnchor | null {
  if (anchor.uv.length !== 2 || anchor.point.length !== 3 || anchor.tangentU.length !== 3 || ![...anchor.uv, ...anchor.point, ...anchor.tangentU].every(Number.isFinite) || anchor.uv.some(v => v < 0 || v > 1) || Math.abs(Math.hypot(...anchor.tangentU) - 1) > .001) return null
  return { uv: [anchor.uv[0], anchor.uv[1]], point: [anchor.point[0], anchor.point[1], anchor.point[2]], tangentU: [anchor.tangentU[0], anchor.tangentU[1], anchor.tangentU[2]] }
}
export function captureStickerCarryAnchor(source: StickerPlacement, anchor: StickerCarryAnchor | undefined): void {
  const copied = anchor === undefined ? null : copyStickerCarryAnchor(anchor)
  const current = deviceStore.get(stickerInteractionAtom)
  if (current.sourcePlacement == null || !sameSource(source, current.sourcePlacement) || !['peeling', 'placing', 'settling'].includes(current.stage) || deviceStore.get(stickerCollectionStatusAtom) === 'signed-out') return
  deviceStore.set(stickerCarryAnchorAtom, copied === null ? null : { source: { ...source }, anchor: copied, pull: { x: 0, y: 0 } })
}
/** Pointer release does not end this owner: the existing return/press motion does. */
export function mountStickerCarryAnchorLifecycle(): () => void {
  const clearStale = () => { if (deviceStore.get(stickerCarryAnchorAtom) !== null && deviceStore.get(stickerSourceAnchorAtom) === null) deviceStore.set(stickerCarryAnchorAtom, null) }
  const unsubscribe = [deviceStore.sub(stickerInteractionAtom, clearStale), deviceStore.sub(stickerCollectionStatusAtom, clearStale)]
  clearStale()
  return () => { for (const stop of unsubscribe) stop(); deviceStore.set(stickerCarryAnchorAtom, null) }
}
