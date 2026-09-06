import { deviceStore, stickerInteractionAtom, stickerInventoryAtom, setStickerInteractionActionAtom, INITIAL_STICKER_INTERACTION, type StickerInteraction } from '@webpod/state'
import type { PointerMotionSample } from './device-orientation-motion'
import { advanceStickerSpring, resolveStickerPullRelease, type StickerSpring } from './sticker-motion'
import { atom } from 'jotai'
import { stickerSheetRevealAtom, stickerDetailIdAtom, stickerDragOffsetAtom, stickerWorkspaceLoweringAtom, stickerCollectionUsableAtom, stickerPreparationIdsAtom } from './sticker-collections-model'

/** Development calibration only; production always enables the physical finish. */
export const stickerFinishCalibrationAtom = atom(true)
/** Development material comparison on the production scene, never a user-facing route. */
export function setStickerFinishCalibration(enabled: boolean): void {
  if (import.meta.env.DEV) deviceStore.set(stickerFinishCalibrationAtom, enabled)
}
const stickerArtworkFailuresAtom = atom<readonly string[]>([])
export const stickerArtworkFailureAtom = atom((get) => get(stickerArtworkFailuresAtom).find((id) => get(stickerPreparationIdsAtom).some((active) => active === id) || get(stickerInventoryAtom)?.placements.some((placement) => placement.stickerId === id)) ?? null)
export const reportStickerArtworkFailure = (id: string): void => { deviceStore.set(stickerArtworkFailuresAtom, (ids) => ids.includes(id) ? ids : [...ids, id]) }
export const reportStickerArtworkReady = (id: string): void => { deviceStore.set(stickerArtworkFailuresAtom, (ids) => ids.filter((failed) => failed !== id)) }

let animationFrame: number | null = null
let rearVisible = false
let interactionGeneration = 0
export const getStickerInteractionGeneration = (): number => interactionGeneration
/** A new gesture/selection takes ownership from any pending completion. */
export function supersedeStickerInteraction(): void { interactionGeneration += 1; stopStickerAnimation() }

/** All semantic and pointer actions publish through the same public device store. */
export function updateStickerInteraction(patch: Partial<StickerInteraction>): void {
  deviceStore.set(setStickerInteractionActionAtom, { ...deviceStore.get(stickerInteractionAtom), ...patch })
}

export function stopStickerAnimation(): void {
  if (animationFrame !== null) cancelAnimationFrame(animationFrame)
  animationFrame = null
}

/** A new explicit intent abandons the carried print and restores the packet pose together. */
export function resetStickerCarry(): void {
  stopStickerAnimation()
  deviceStore.set(stickerDragOffsetAtom, null)
  deviceStore.set(stickerWorkspaceLoweringAtom, 0)
  updateStickerInteraction({ selectedStickerId: null, previewPlacement: null, peel: 0, landing: 0, sourcePlacement: null, returnToSheet: false })
}

/** Cancels every transient gesture without changing an earned pack or saved placement. */
export function cancelStickerInteraction(): void {
  interactionGeneration += 1
  stopStickerAnimation()
  deviceStore.set(stickerDetailIdAtom, null)
  deviceStore.set(stickerSheetRevealAtom, 0)
  deviceStore.set(stickerWorkspaceLoweringAtom, 0)
  deviceStore.set(stickerDragOffsetAtom, null)
  const current = deviceStore.get(stickerInteractionAtom)
  updateStickerInteraction({ ...INITIAL_STICKER_INTERACTION, stage: rearVisible ? 'tease' : 'hidden', packId: current.packId })
}

/** A rear admission transition reveals one earned pack; front/edge movement cancels gestures. */
export function setStickerRearVisible(visible: boolean): void {
  const changed = rearVisible !== visible
  rearVisible = visible
  if (!visible) { if (changed) cancelStickerInteraction(); return }
  // Existing rear vinyl owns a valid gesture lane even while its sheet is loading.
  // Readiness admits only the packet, never the physical rear animation clock.
  if (!deviceStore.get(stickerCollectionUsableAtom)) return
  const current = deviceStore.get(stickerInteractionAtom)
  if (!changed && current.stage !== 'hidden' && !(current.progress === 0 && current.sourcePlacement == null)) return
  const inventory = deviceStore.get(stickerInventoryAtom)
  const pack = inventory?.packs.find((item) => item.openedAt === null) ?? inventory?.packs.at(-1)
  updateStickerInteraction({ ...INITIAL_STICKER_INTERACTION, stage: 'tease', packId: pack?.id ?? null })
}

/** Reduced motion uses the exact same stable state without scheduling an animation. */
export function animateStickerValue(field: 'progress' | 'peel' | 'landing' | 'sheet' | 'return', spring: StickerSpring, reducedMotion: boolean, onComplete: () => void): void {
  stopStickerAnimation()
  const returnOrigin = deviceStore.get(stickerDragOffsetAtom)
  const returnPeel = deviceStore.get(stickerInteractionAtom).peel
  const workspace = deviceStore.get(stickerWorkspaceLoweringAtom)
  const returnLanding = deviceStore.get(stickerInteractionAtom).landing
  const publish = (value: number): void => {
    if (field === 'return' || field === 'peel') deviceStore.set(stickerWorkspaceLoweringAtom, workspace * (field === 'return' ? value : spring.position === 0 ? 0 : value / spring.position))
    if (field === 'sheet') deviceStore.set(stickerSheetRevealAtom, Math.max(0, Math.min(1, value)))
    else if (field === 'return') { if (returnOrigin !== null) deviceStore.set(stickerDragOffsetAtom, { x: returnOrigin.x * value, y: returnOrigin.y * value }); updateStickerInteraction({ peel: returnPeel * value, landing: returnLanding * value }) }
    else updateStickerInteraction({ [field]: value })
  }
  if (reducedMotion) { publish(spring.target); onComplete(); return }
  let current = spring
  let previous = performance.now()
  const frame = (timestamp: number): void => {
    animationFrame = null
    if (!rearVisible) return
    const next = advanceStickerSpring(current, (timestamp - previous) / 1000)
    previous = timestamp
    // The liner is visibly closed at its first clamped zero; do not wait through invisible undershoot.
    if (next === null || field === 'sheet' && spring.target === 0 && next.position <= 0) { publish(spring.target); onComplete(); return }
    current = next
    publish(next.position)
    animationFrame = requestAnimationFrame(frame)
  }
  animationFrame = requestAnimationFrame(frame)
}

export function releaseStickerPull(samples: readonly PointerMotionSample[], timestamp: number, travelPx: number, reducedMotion: boolean): void {
  const current = deviceStore.get(stickerInteractionAtom)
  const spring = resolveStickerPullRelease(current.progress, samples, timestamp, travelPx)
  animateStickerValue('progress', spring, reducedMotion, () => updateStickerInteraction({ stage: spring.target === 1 ? 'open' : 'tease' }))
}

/** Keyboard/click equivalent of pulling the pack lip. Interruptible by a new drag. */
export function revealStickerPack(reducedMotion: boolean): void {
  supersedeStickerInteraction()
  resetStickerCarry()
  const inventory = deviceStore.get(stickerInventoryAtom)
  const current = deviceStore.get(stickerInteractionAtom)
  const pack = inventory?.packs.find((item) => item.openedAt === null)
    ?? inventory?.packs.find((item) => item.id === current.packId) ?? inventory?.packs.at(-1)
  updateStickerInteraction({ stage: 'pulling', packId: pack?.id ?? null })
  animateStickerValue('progress', { position: current.progress, velocity: 0, target: 1 }, reducedMotion, () => updateStickerInteraction({ stage: 'open' }))
}

/** Keeps a missed or cancelled peel continuous from its actual pointer position to its seat. */
export function returnStickerToSheet(reducedMotion: boolean): void {
  supersedeStickerInteraction()
  updateStickerInteraction({ stage: 'peeling' })
  animateStickerValue('return', { position: 1, velocity: 0, target: 0 }, reducedMotion, () => { deviceStore.set(stickerDragOffsetAtom, null); updateStickerInteraction({ stage: 'open', peel: 0, previewPlacement: null, landing: 0, sourcePlacement: null, returnToSheet: false }) })
}
