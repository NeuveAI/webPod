import { isStickerPlacement, type StickerPlacement } from '@webpod/stickers'
import { copyStickerCarryAnchor } from './sticker-carry-anchor'
import type { StickerCarryAnchor, StickerSurfaceGrab } from '@webpod/device'

/** Geometry-owned visible material hit; closure freezes the actual grabbed UV. */
export interface StickerGrab {
  readonly anchor?: StickerCarryAnchor
  readonly placement: StickerPlacement
  readonly projectCenter: (x: number, y: number) => { readonly x: number; readonly y: number } | null
  readonly isValid?: () => boolean
}
/** Validate the domain identity while retaining the geometry-owned frozen closure. */
export function adaptStickerGrab(grab: StickerSurfaceGrab | null | undefined): StickerGrab | null {
  if (grab == null || !isStickerPlacement(grab.placement) || !grab.isValid()) return null
  const anchor = grab.anchor === undefined ? undefined : copyStickerCarryAnchor(grab.anchor)
  if (anchor === null) return null
  return { anchor, placement: grab.placement, projectCenter: (x, y) => grab.projectCenter(x, y), isValid: () => grab.isValid() }
}
export function pickStickerSource(rear: boolean, commands: {
  readonly grab?: (x: number, y: number) => StickerGrab | null
  readonly hit: (x: number, y: number) => StickerPlacement | null
}, x: number, y: number): { source: StickerPlacement; grab: StickerGrab | null } | null {
  if (commands.grab !== undefined) {
    const grab = commands.grab(x, y)
    return grab !== null && grab.isValid?.() !== false && isStickerPlacement(grab.placement) ? { source: grab.placement, grab } : null
  }
  // Old alpha-only hit does not prove shell visibility off the rear view.
  const source = rear ? commands.hit(x, y) : null
  return source !== null && isStickerPlacement(source) ? { source, grab: null } : null
}

interface CapturedCandidate {
  readonly event: { readonly pointerId: number }
  readonly canvas: { hasPointerCapture(id: number): boolean; releasePointerCapture(id: number): void }
}
/** Clear ownership before native release can synchronously dispatch lostcapture. */
export function releaseStickerCandidate<T extends CapturedCandidate>(read: () => T | null, clear: () => void): T | null {
  const candidate = read()
  clear()
  if (candidate?.canvas.hasPointerCapture(candidate.event.pointerId)) candidate.canvas.releasePointerCapture(candidate.event.pointerId)
  return candidate
}
/** Final pointer samples can synchronously cancel or supersede their own lane. */
export function sampleOwnedStickerRelease(pointerId: number, readPointer: () => number | null, readGeneration: () => number, sample: () => void): boolean {
  const generation = readGeneration()
  sample()
  return readPointer() === pointerId && readGeneration() === generation
}


/** Ownership must be captured before any preceding synchronous store publication. */
export function publishOwnedStickerPull(ownsMove: () => boolean, publish: () => void): boolean {
  if (!ownsMove()) return false
  publish()
  return ownsMove()
}
