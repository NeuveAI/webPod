import { atom } from 'jotai'
import { deviceStore, stickerInventoryAtom } from '@webpod/state'
import type { DeviceStickerPlacement, StickerRearProjection } from '@webpod/device'
import type { StickerContourQueryState } from '../../../packages/device/src/sticker-contour-query'

const empty: StickerContourQueryState = { result: null, error: null, pending: false }
export const stickerContourQueryAtom = atom<StickerContourQueryState>(empty)
let projection: StickerRearProjection | null = null
let detach: (() => void) | null = null
let demand: { placement: DeviceStickerPlacement; session: number } | null = null
let publication = 0
let sourceKey: string | undefined
/** Publish outside another renderer root's commit; stale owner callbacks cannot
 * overwrite its replacement. Results retain their actual sampled pose/lineage. */
function publish(): void {
  const revision = ++publication, owner = projection
  queueMicrotask(() => {
    if (revision !== publication || owner !== projection) return
    deviceStore.set(stickerContourQueryAtom, owner?.contourQuery?.getSnapshot() ?? empty)
  })
}
export function setStickerContourProjection(next: StickerRearProjection | null): void {
  if (projection === next) return
  detach?.(); detach = null
  projection?.contourQuery?.clear()
  projection = next
  detach = next?.contourQuery?.subscribe(publish) ?? null
  publish()
}
/** Invoked by the existing coalesced projection notification, never during render. */
export function refreshStickerContour(): void {
  if (demand) {
    const source = deviceStore.get(stickerInventoryAtom)?.placements.find(value => value.stickerId === demand?.placement.stickerId)
    const nextKey = JSON.stringify(source ?? null)
    if (sourceKey !== undefined && sourceKey !== nextKey) projection?.contourQuery?.clear()
    sourceKey = nextKey
    projection?.contourQuery?.request(demand.placement, demand.session)
  }
}
export function requestStickerContour(placement: DeviceStickerPlacement, session: number): void {
  if (demand?.session !== session || demand.placement.stickerId !== placement.stickerId) sourceKey = undefined
  demand = { placement, session }
  refreshStickerContour()
}
/** True presentation lifetime barrier; ordinary compatible pose updates never clear. */
export function clearStickerContour(): void {
  demand = null; sourceKey = undefined
  projection?.contourQuery?.clear()
  publish()
}
