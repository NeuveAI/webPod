import { deviceStore, stickerInteractionAtom, stickerInventoryAtom, setStickerInteractionActionAtom, INITIAL_STICKER_INTERACTION, type StickerInteraction } from '@webpod/state'
import type { PointerMotionSample } from './device-orientation-motion'
import { advanceStickerSpring, resolveStickerPullRelease, type StickerSpring } from './sticker-motion'
import { atom } from 'jotai'

/** Development calibration only; production always enables the physical finish. */
export const stickerFinishCalibrationAtom = atom(true)
/** Development material comparison on the production scene, never a user-facing route. */
export function setStickerFinishCalibration(enabled: boolean): void {
  if (import.meta.env.DEV) deviceStore.set(stickerFinishCalibrationAtom, enabled)
}
const stickerArtworkFailuresAtom = atom<readonly string[]>([])
export const stickerArtworkFailureAtom = atom((get) => get(stickerArtworkFailuresAtom)[0] ?? null)
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

/** Cancels every transient gesture without changing an earned pack or saved placement. */
export function cancelStickerInteraction(): void {
  interactionGeneration += 1
  stopStickerAnimation()
  const current = deviceStore.get(stickerInteractionAtom)
  updateStickerInteraction({ ...INITIAL_STICKER_INTERACTION, stage: rearVisible ? 'tease' : 'hidden', packId: current.packId })
}

/** A rear admission transition reveals one earned pack; front/edge movement cancels gestures. */
export function setStickerRearVisible(visible: boolean): void {
  if (rearVisible === visible) return
  rearVisible = visible
  if (!visible) { cancelStickerInteraction(); return }
  const inventory = deviceStore.get(stickerInventoryAtom)
  const pack = inventory?.packs.find((item) => item.openedAt === null) ?? inventory?.packs.at(-1)
  updateStickerInteraction({ ...INITIAL_STICKER_INTERACTION, stage: 'tease', packId: pack?.id ?? null })
}

/** Reduced motion uses the exact same stable state without scheduling an animation. */
export function animateStickerValue(field: 'progress' | 'peel' | 'landing', spring: StickerSpring, reducedMotion: boolean, onComplete: () => void): void {
  stopStickerAnimation()
  if (reducedMotion) { updateStickerInteraction({ [field]: spring.target }); onComplete(); return }
  let current = spring
  let previous = performance.now()
  const frame = (timestamp: number): void => {
    animationFrame = null
    if (!rearVisible) return
    const next = advanceStickerSpring(current, (timestamp - previous) / 1000)
    previous = timestamp
    if (next === null) { updateStickerInteraction({ [field]: spring.target }); onComplete(); return }
    current = next
    updateStickerInteraction({ [field]: next.position })
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
  const inventory = deviceStore.get(stickerInventoryAtom)
  const current = deviceStore.get(stickerInteractionAtom)
  const pack = inventory?.packs.find((item) => item.openedAt === null)
    ?? inventory?.packs.find((item) => item.id === current.packId) ?? inventory?.packs.at(-1)
  updateStickerInteraction({ stage: 'pulling', packId: pack?.id ?? null })
  animateStickerValue('progress', { position: current.progress, velocity: 0, target: 1 }, reducedMotion, () => updateStickerInteraction({ stage: 'open' }))
}
