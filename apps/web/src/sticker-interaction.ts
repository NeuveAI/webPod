import { stickerHaptics } from './sticker-haptics'
import { setStickerPackTucked } from './sticker-pack-tuck'
import { animateStickerPackPresence } from './sticker-pack-presence'
import { dismissStickerEditor, stickerToolEditorPropertyAtom } from './sticker-editor-model'
import { deviceStore, stickerInteractionAtom, stickerInventoryAtom, setStickerInteractionActionAtom, INITIAL_STICKER_INTERACTION, type StickerInteraction } from '@webpod/state'
import type { PointerMotionSample } from './device-orientation-motion'
import { advanceStickerSpring, resolveStickerPullRelease, type StickerSpring } from './sticker-motion'
import { atom } from 'jotai'
import { stickerCarryAnchorAtom, stickerSourceAnchorAtom, stickerSourcePullAtom, updateStickerSourcePull } from './sticker-carry-anchor'
import { isStickerPlacement, type StickerPlacement } from '@webpod/stickers'
import { stickerLiftAnimation, stickerLiftPhase, stickerLiftProgress } from './sticker-lift-phase'
import { stickerPackTurnAtom, stickerSheetRevealAtom, stickerDetailIdAtom, stickerDragOffsetAtom, stickerWorkspaceLoweringAtom, stickerCollectionUsableAtom, stickerPreparationIdsAtom, stickerCollectionTransitionAtom, activeStickerCollectionAtom, selectedStickerGenreAtom } from './sticker-collections-model'

/** Development calibration only; production always enables the physical finish. */
export const stickerFinishCalibrationAtom = atom(true)
/** Development material comparison on the production scene, never a user-facing route. */
export function setStickerFinishCalibration(enabled: boolean): void {
  if (import.meta.env.DEV) deviceStore.set(stickerFinishCalibrationAtom, enabled)
}
const stickerArtworkFailuresAtom = atom<readonly string[]>([])
export const stickerArtworkFailureAtom = atom((get) => get(stickerArtworkFailuresAtom).find((id) => get(stickerPreparationIdsAtom).some((active) => active === id) || get(stickerInventoryAtom)?.placements.some((placement) => placement.stickerId === id)) ?? null)
export const reportStickerArtworkFailure = (id: string): void => { deviceStore.set(stickerArtworkFailuresAtom, (ids) => ids.includes(id) ? ids : [...ids, id]) }
export const reportStickerArtworkReady = (id: string): void => { deviceStore.set(stickerArtworkFailuresAtom, (ids) => ids.includes(id) ? ids.filter((failed) => failed !== id) : ids) }

let animationFrame: number | null = null
let animationGeneration = 0
let rearVisible = false
/** Ownership of asynchronous geometry, including the release animation boundary. */
export const stickerComputationEpochAtom = atom(0)
const advanceComputationEpoch = (): void => { deviceStore.set(stickerComputationEpochAtom, value => value + 1) }
let interactionGeneration = 0
export const getStickerInteractionGeneration = (): number => interactionGeneration
/** A new gesture/selection takes ownership from any pending completion. */
export function supersedeStickerInteraction(): void { deviceStore.set(stickerCollectionTransitionAtom, null); stickerHaptics.cancel(); interactionGeneration += 1; advanceComputationEpoch(); deviceStore.set(stickerToolEditorPropertyAtom, null); stopStickerAnimation(); deviceStore.set(stickerPackTurnAtom, 0) }

/** All semantic and pointer actions publish through the same public device store. */
export function updateStickerInteraction(patch: Partial<StickerInteraction>): void {
  const physical = patch.peel !== undefined && patch.sourcePeelFront === undefined && patch.detachTransport === undefined ? stickerLiftPhase(patch.peel) : {}
  deviceStore.set(setStickerInteractionActionAtom, { ...deviceStore.get(stickerInteractionAtom), ...physical, ...patch })
}

/** A held target is advisory; docking begins only after a valid release. */
export function updateHeldStickerPreview(candidate: StickerPlacement | null): void {
  const previewPlacement = candidate !== null && isStickerPlacement(candidate) ? candidate : null
  updateStickerInteraction({ previewPlacement, stage: previewPlacement === null ? 'peeling' : 'placing', landing: 0 })
}

export function stopStickerAnimation(): void {
  animationGeneration += 1
  if (animationFrame !== null) cancelAnimationFrame(animationFrame)
  animationFrame = null
}

/** A new explicit intent abandons the carried print and restores the packet pose together. */
export function resetStickerCarry(): void {
  advanceComputationEpoch()
  stickerHaptics.cancel()
  deviceStore.set(stickerToolEditorPropertyAtom, null)
  stopStickerAnimation()
  deviceStore.set(stickerDragOffsetAtom, null)
  deviceStore.set(stickerCarryAnchorAtom, null)
  deviceStore.set(stickerWorkspaceLoweringAtom, 0)
  updateStickerInteraction({ selectedStickerId: null, previewPlacement: null, peel: 0, landing: 0, sourcePlacement: null, returnToSheet: false })
}

/** Cancels every transient gesture without changing an earned pack or saved placement. */
export function cancelStickerInteraction(): void {
  deviceStore.set(stickerCollectionTransitionAtom, null)
  stickerHaptics.cancel()
  deviceStore.set(stickerToolEditorPropertyAtom, null)
  interactionGeneration += 1; advanceComputationEpoch()
  stopStickerAnimation()
  deviceStore.set(stickerPackTurnAtom, 0)
  deviceStore.set(stickerDetailIdAtom, null)
  deviceStore.set(stickerSheetRevealAtom, 0)
  deviceStore.set(stickerWorkspaceLoweringAtom, 0)
  deviceStore.set(stickerDragOffsetAtom, null)
  deviceStore.set(stickerCarryAnchorAtom, null)
  const current = deviceStore.get(stickerInteractionAtom)
  updateStickerInteraction({ ...INITIAL_STICKER_INTERACTION, stage: rearVisible ? 'tease' : 'hidden', packId: current.packId })
}

/** A rear admission transition reveals one earned pack; front/edge movement cancels gestures. */
export function setStickerRearVisible(visible: boolean): void {
  const changed = rearVisible !== visible
  rearVisible = visible
  if (!visible) {
    deviceStore.set(stickerCollectionTransitionAtom, null)
    if (changed && deviceStore.get(stickerInteractionAtom).sourcePlacement == null) {
      interactionGeneration += 1; advanceComputationEpoch()
      stopStickerAnimation()
      animateStickerPackPresence(0, () => { if (!rearVisible) cancelStickerInteraction() })
    }
    return
  }
  // Existing rear vinyl owns a valid gesture lane even while its sheet is loading.
  // Readiness admits only the packet, never the physical rear animation clock.
  if (!deviceStore.get(stickerCollectionUsableAtom)) return
  animateStickerPackPresence(1, () => {})
  const current = deviceStore.get(stickerInteractionAtom)
  if (current.sourcePlacement != null) return
  if (!changed && current.stage !== 'hidden' && !(current.progress === 0 && current.sourcePlacement == null)) return
  const inventory = deviceStore.get(stickerInventoryAtom)
  const pack = inventory?.packs.find((item) => item.openedAt === null) ?? inventory?.packs.at(-1)
  updateStickerInteraction({ ...INITIAL_STICKER_INTERACTION, stage: 'tease', packId: pack?.id ?? null })
}

/** Reduced motion uses the exact same stable state without scheduling an animation. */
export function animateStickerValue(field: 'progress' | 'peel' | 'landing' | 'sheet' | 'return' | 'turn', spring: StickerSpring, reducedMotion: boolean, onComplete: () => void, direction = 1): void {
  advanceComputationEpoch()
  stopStickerAnimation()
  const animation = animationGeneration, gesture = interactionGeneration
  const isCurrent = () => animation === animationGeneration && gesture === interactionGeneration
  const returnOrigin = deviceStore.get(stickerDragOffsetAtom)
  const returnPull = deviceStore.get(stickerSourcePullAtom), returnAnchor = deviceStore.get(stickerSourceAnchorAtom)
  const returnSource = deviceStore.get(stickerInteractionAtom).sourcePlacement
  const returnPeel = deviceStore.get(stickerInteractionAtom).peel
  const initialLift = stickerLiftProgress(deviceStore.get(stickerInteractionAtom))
  const workspace = deviceStore.get(stickerWorkspaceLoweringAtom)
  const returnLanding = deviceStore.get(stickerInteractionAtom).landing
  const publish = (value: number): void => {
    if (field === 'return' || field === 'peel') deviceStore.set(stickerWorkspaceLoweringAtom, workspace * (field === 'return' ? value : spring.position === 0 ? 0 : value / spring.position))
    if (!isCurrent()) return
    if (field === 'turn') deviceStore.set(stickerPackTurnAtom, Math.max(0, Math.min(1, value)) * direction)
    else if (field === 'sheet') deviceStore.set(stickerSheetRevealAtom, Math.max(0, Math.min(1, value)))
    else if (field === 'return') { if (returnOrigin !== null) deviceStore.set(stickerDragOffsetAtom, { x: returnOrigin.x * value, y: returnOrigin.y * value }); if (!isCurrent()) return; if (returnPull !== null && returnAnchor !== null && returnSource != null) { const scale = spring.position === 0 ? 0 : Math.max(0, Math.min(1, value / spring.position)); updateStickerSourcePull(returnSource, { x: returnPull.x * scale, y: returnPull.y * scale }, returnAnchor) }; if (!isCurrent() || returnAnchor !== null && deviceStore.get(stickerSourceAnchorAtom) !== returnAnchor) return; updateStickerInteraction({ peel: returnPeel * value, ...stickerLiftPhase(initialLift * Math.max(0, Math.min(1, value))), landing: returnLanding * value }) }
    else if (field === 'peel') updateStickerInteraction({ peel: value, ...stickerLiftAnimation(initialLift, spring.position, spring.target, value) })
    else updateStickerInteraction({ [field]: value })
  }
  if (reducedMotion) { publish(spring.target); if (isCurrent()) onComplete(); return }
  let current = spring
  let previous = performance.now()
  const frame = (timestamp: number): void => {
    animationFrame = null
    if ((!rearVisible && deviceStore.get(stickerInteractionAtom).sourcePlacement == null) || !isCurrent()) return
    const next = advanceStickerSpring(current, (timestamp - previous) / 1000)
    previous = timestamp
    // The liner is visibly closed at its first clamped zero; do not wait through invisible undershoot.
    if (next === null || field === 'turn' && spring.target === 1 && next.position >= 1 || field === 'sheet' && spring.target === 0 && next.position <= 0) { publish(spring.target); if (isCurrent()) onComplete(); return }
    current = next
    publish(next.position)
    if (isCurrent()) animationFrame = requestAnimationFrame(frame)
  }
  animationFrame = requestAnimationFrame(frame)
}

export function releaseStickerPull(samples: readonly PointerMotionSample[], timestamp: number, travelPx: number, reducedMotion: boolean): void {
  const current = deviceStore.get(stickerInteractionAtom)
  const spring = resolveStickerPullRelease(current.progress, samples, timestamp, travelPx)
  animateStickerValue('progress', spring, reducedMotion, () => updateStickerInteraction({ stage: spring.target === 1 ? 'open' : 'tease' }))
}

/** Keyboard/click equivalent of pulling the pack lip. Interruptible by a new drag. */
export function revealStickerPack(reducedMotion: boolean, onComplete?: () => void): void {
  dismissStickerEditor()
  setStickerPackTucked(false)
  supersedeStickerInteraction()
  resetStickerCarry()
  const inventory = deviceStore.get(stickerInventoryAtom)
  const current = deviceStore.get(stickerInteractionAtom)
  const pack = inventory?.packs.find((item) => item.openedAt === null)
    ?? inventory?.packs.find((item) => item.id === current.packId) ?? inventory?.packs.at(-1)
  updateStickerInteraction({ stage: 'pulling', packId: pack?.id ?? null })
  animateStickerValue('progress', { position: current.progress, velocity: 0, target: 1 }, reducedMotion, () => { updateStickerInteraction({ stage: 'open' }); onComplete?.() })
}

/** Open the displayed genre's liner without allowing pack selection to change its target. */
export function revealStickerLiner(reducedMotion: boolean, signal?: AbortSignal) {
  signal?.throwIfAborted()
  const target = deviceStore.get(activeStickerCollectionAtom)
  if (target === null) throw new Error('No earned sticker collection is loaded.')
  deviceStore.set(selectedStickerGenreAtom, target.genre)
  revealStickerPack(reducedMotion, () => {
    if (!signal?.aborted) animateStickerValue('sheet', { position: deviceStore.get(stickerSheetRevealAtom), velocity: 0, target: 1 }, reducedMotion, () => {})
  })
  return target
}

/** Keeps a missed or cancelled peel continuous from its actual pointer position to its seat. */
export function returnStickerToSheet(reducedMotion: boolean): void {
  setStickerPackTucked(false)
  supersedeStickerInteraction()
  updateStickerInteraction({ stage: 'peeling' })
  animateStickerValue('return', { position: 1, velocity: 0, target: 0 }, reducedMotion, () => { deviceStore.set(stickerDragOffsetAtom, null); updateStickerInteraction({ stage: 'open', peel: 0, previewPlacement: null, landing: 0, sourcePlacement: null, returnToSheet: false }) })
}
