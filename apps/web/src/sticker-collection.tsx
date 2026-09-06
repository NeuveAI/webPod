import { atom, useAtomValue } from 'jotai'
import { useEffect, useRef, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react'
import { getCompositeTierSnapshot, subscribeCompositeTier } from '@webpod/composite'
import { deviceStore, stickerCollectionStatusAtom, stickerInteractionAtom, stickerInventoryAtom } from '@webpod/state'
import { getSticker, isStickerPlacement, type StickerPlacement, type StickerInventory } from '@webpod/stickers'
import type { DeviceOrientation } from '@webpod/device'
import { deviceFrontVisibility, STICKER_PACK_LAYOUT, STICKER_SHEET_SLOTS, stickerPackViewportLayout, retryStickerArtwork } from '@webpod/device'
import { animateStickerValue, returnStickerToSheet, resetStickerCarry, cancelStickerInteraction, releaseStickerPull, revealStickerPack, setStickerRearVisible, updateStickerInteraction, stickerArtworkFailureAtom, getStickerInteractionGeneration, supersedeStickerInteraction } from './sticker-interaction'
import { activeStickerCollectionAtom, stickerCollectionsAtom, selectedStickerGenreAtom, stickerSheetRevealAtom, stickerDetailIdAtom, stickerDragOffsetAtom, genreLabel, formatListeningMinutes, stickerPlacementForIntent, stickerPeelMotion, stickerWorkspaceLoweringAtom, stickerCollectionUsableAtom, stickerProjectionVersionAtom, type CollectionSlot } from './sticker-collections-model'
import { estimatePointerReleaseVelocity, type PointerMotionSample } from './device-orientation-motion'

const PACK = { ...STICKER_PACK_LAYOUT, peelTravelPx: 64, placementWidth: 0.25, releaseInertiaSeconds: 0.025 } as const
const REAR = { admit: -0.7, leave: -0.45 } as const
const SERVER_TIER: ReturnType<typeof getCompositeTierSnapshot> = { tier: 'T4', reason: 'Device rendering begins in the browser.', report: null, contextLost: false }
const readServerTier = (): ReturnType<typeof getCompositeTierSnapshot> => SERVER_TIER
interface StickerPointer {
  readonly kind: 'pull' | 'liner' | 'peel' | 'rear'
  readonly pointerId: number
  readonly startX: number
  readonly stickerId: string | null
  readonly maxDistance: number
  readonly returnWorkspace: boolean
  readonly startY: number
  readonly startProgress: number
  readonly travel: number
  readonly samples: readonly PointerMotionSample[]
}
const viewportAtom = atom({ width: 480, height: 800 })
const suppressClickAtom = atom(false)
const pointerAtom = atom<StickerPointer | null>(null)
const reducedMotionAtom = atom(false)
const rearAdmittedAtom = atom(false)
const collectionMessageAtom = atom<string | null>(null)
function releaseCapturedStickerPointer(target: HTMLElement | null): void {
  const pointer = deviceStore.get(pointerAtom)
  deviceStore.set(pointerAtom, null)
  if (pointer !== null && target?.hasPointerCapture(pointer.pointerId)) target.releasePointerCapture(pointer.pointerId)
}

export interface StickerCollectionCommands {
  readonly retry: () => Promise<void>
  readonly openPack: (id: string) => Promise<void>
  readonly place: (placement: StickerPlacement) => Promise<void>
  readonly remove: (id: string) => Promise<void>
  readonly hit: (x: number, y: number) => StickerPlacement | null
  readonly screen: (placement: StickerPlacement) => { readonly x: number; readonly y: number } | null
  readonly project: (clientX: number, clientY: number) => { readonly x: number; readonly y: number } | null
}

/** Semantic overlay for the same lit 3D pack. Drag and keyboard share store actions. */
export function StickerCollection({ orientation, commands }: { readonly orientation: DeviceOrientation; readonly commands: StickerCollectionCommands }) {
  useAtomValue(stickerProjectionVersionAtom, { store: deviceStore })
  const usable = useAtomValue(stickerCollectionUsableAtom, { store: deviceStore })
  const compositeTier = useSyncExternalStore(subscribeCompositeTier, getCompositeTierSnapshot, readServerTier)
  const interaction = useAtomValue(stickerInteractionAtom, { store: deviceStore })
  const inventory = useAtomValue(stickerInventoryAtom, { store: deviceStore })
  const status = useAtomValue(stickerCollectionStatusAtom, { store: deviceStore })
  const reducedMotion = useAtomValue(reducedMotionAtom, { store: deviceStore })
  const rear = useAtomValue(rearAdmittedAtom, { store: deviceStore })
  const message = useAtomValue(collectionMessageAtom, { store: deviceStore })
  const artworkFailure = useAtomValue(stickerArtworkFailureAtom, { store: deviceStore })
  const host = useRef<HTMLDivElement>(null)
  const lip = useRef<HTMLButtonElement>(null)
  const captureTarget = useRef<HTMLElement | null>(null)
  const collection = useAtomValue(activeStickerCollectionAtom, { store: deviceStore })
  const collections = useAtomValue(stickerCollectionsAtom, { store: deviceStore })
  const sheetReveal = useAtomValue(stickerSheetRevealAtom, { store: deviceStore })
  const workspaceLowering = useAtomValue(stickerWorkspaceLoweringAtom, { store: deviceStore })
  const detailId = useAtomValue(stickerDetailIdAtom, { store: deviceStore })
  const viewport = useAtomValue(viewportAtom, { store: deviceStore })
  const layout = stickerPackViewportLayout(viewport.width, viewport.height)
  const detail = collection?.slots.find((slot) => slot.art.id === detailId)
  const sheetOpen = sheetReveal > .98
  const selected = interaction.selectedStickerId === null ? undefined : getSticker(interaction.selectedStickerId)
  const carryingRear = interaction.sourcePlacement != null
  const expanded = interaction.progress > .9 && interaction.stage !== 'hidden' && interaction.stage !== 'tease' && interaction.stage !== 'pulling'

  useEffect(() => {
    const element = host.current
    if (element === null) return
    const observer = new ResizeObserver(([entry]) => { if (entry !== undefined) deviceStore.set(viewportAtom, { width: entry.contentRect.width, height: entry.contentRect.height }) })
    observer.observe(element)
    return () => observer.disconnect()
  }, [rear, usable, carryingRear])
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)')
    const change = (): void => {
      deviceStore.set(reducedMotionAtom, query.matches)
      if (query.matches) {
        releaseCapturedStickerPointer(captureTarget.current)
        captureTarget.current = null
        cancelStickerInteraction()
      }
    }
    change(); query.addEventListener('change', change)
    return () => { query.removeEventListener('change', change); releaseCapturedStickerPointer(captureTarget.current); setStickerRearVisible(false); deviceStore.set(rearAdmittedAtom, false) }
  }, [])
  useEffect(() => {
    const visible = deviceFrontVisibility(orientation)
    const admitted = deviceStore.get(rearAdmittedAtom)
    const next = compositeTier.tier === 'T1' && visible < (admitted ? REAR.leave : REAR.admit)
    deviceStore.set(rearAdmittedAtom, next)
    setStickerRearVisible(next)
    if (!next) releaseCapturedStickerPointer(captureTarget.current)
  }, [orientation, compositeTier.tier, usable])
  useEffect(() => {
    if (status === 'signed-out') { releaseCapturedStickerPointer(captureTarget.current); cancelStickerInteraction(); deviceStore.set(collectionMessageAtom, null); deviceStore.set(selectedStickerGenreAtom, null); deviceStore.set(stickerSheetRevealAtom, 0); resetStickerCarry() }
  }, [status])

  /** Every new command/selection/gesture owns presentation; older server writes may still finish. */
  const admitIntent = (): void => { releaseCapturedStickerPointer(captureTarget.current); captureTarget.current = null; supersedeStickerInteraction() }
  const run = (work: (isCurrent: () => boolean) => Promise<void>): void => {
    admitIntent()
    const generation = getStickerInteractionGeneration()
    const isCurrent = (): boolean => generation === getStickerInteractionGeneration()
    deviceStore.set(collectionMessageAtom, null)
    void work(isCurrent).catch(() => {
      if (!isCurrent() || deviceStore.get(stickerCollectionStatusAtom) === 'signed-out') return
      const held = deviceStore.get(stickerInteractionAtom)
      const authoritative = deviceStore.get(stickerInventoryAtom)?.placements.find((item) => item.stickerId === held.selectedStickerId)
      deviceStore.set(collectionMessageAtom, 'That change didn’t save. Try again.')
      if (held.sourcePlacement == null) { returnStickerToSheet(reducedMotion); return }
      // Reconcile the server's actual outcome from the held pose. Never move its
      // origin under the animation or restore a stale placement into inventory.
      animateStickerValue('landing', { position: held.landing, velocity: 0, target: 0 }, reducedMotion, () => {
        updateStickerInteraction({ previewPlacement: authoritative ?? null, returnToSheet: authoritative === undefined })
        animateStickerValue('landing', { position: 0, velocity: 0, target: 1 }, reducedMotion, () => {
          animateStickerValue('peel', { position: deviceStore.get(stickerInteractionAtom).peel, velocity: 0, target: 0 }, reducedMotion, () => { resetStickerCarry(); updateStickerInteraction({ stage: 'open', selectedStickerId: null }) })
        })
      })
    })
  }
  const close = (): void => {
    admitIntent(); deviceStore.set(stickerDetailIdAtom, null); resetStickerCarry()
    updateStickerInteraction({ selectedStickerId: null, peel: 0, previewPlacement: null, landing: 0, stage: 'pulling' })
    const lower = (): void => animateStickerValue('progress', { position: interaction.progress, velocity: -.8, target: 0 }, reducedMotion, () => cancelStickerInteraction())
    animateStickerValue('sheet', { position: sheetReveal, velocity: 0, target: 0 }, reducedMotion, lower)
    lip.current?.focus()
  }
  const start = (event: Pick<globalThis.PointerEvent, 'isPrimary' | 'button' | 'pointerId' | 'clientX' | 'clientY' | 'timeStamp' | 'stopPropagation'>, target: HTMLElement, kind: StickerPointer['kind'], slot?: CollectionSlot, sourcePlacement: StickerPlacement | null = null): void => {
    if (!event.isPrimary || event.button !== 0) return
    deviceStore.set(suppressClickAtom, false)
    event.stopPropagation(); if (kind === 'peel' && slot?.state !== 'earned') return
    deviceStore.set(collectionMessageAtom, null)
    admitIntent()
    deviceStore.set(stickerDetailIdAtom, null)
    resetStickerCarry()
    if (slot !== undefined) updateStickerInteraction({ selectedStickerId: slot.art.id, peel: 0, previewPlacement: null, landing: 0, sourcePlacement })
    target.setPointerCapture(event.pointerId)
    captureTarget.current = target
    deviceStore.set(pointerAtom, { kind, maxDistance: 0, returnWorkspace: false, pointerId: event.pointerId, stickerId: slot?.art.id ?? null, startX: event.clientX, startY: event.clientY, startProgress: kind === 'liner' ? deviceStore.get(stickerSheetRevealAtom) : deviceStore.get(stickerInteractionAtom).progress, travel: kind === 'liner' ? layout.height * PACK.linerTravel : layout.height + PACK.bottomGapPx - PACK.teasePx, samples: [sample(event)] })
    updateStickerInteraction({ stage: kind === 'pull' ? 'pulling' : kind === 'liner' ? 'open' : 'peeling' })
  }
  const begin = (event: ReactPointerEvent<HTMLButtonElement>, kind: StickerPointer['kind'], slot?: CollectionSlot): void => start(event, event.currentTarget, kind, slot)
  const move = (event: Pick<globalThis.PointerEvent, 'pointerId' | 'clientX' | 'clientY' | 'timeStamp' | 'stopPropagation'>): void => {
    const pointer = deviceStore.get(pointerAtom)
    if (pointer === null || pointer.pointerId !== event.pointerId) return
    event.stopPropagation()
    const maxDistance = Math.max(pointer.maxDistance, Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY))
    deviceStore.set(pointerAtom, { ...pointer, maxDistance, samples: [...pointer.samples.slice(-11), sample(event)] })
    const delta = pointer.startY - event.clientY
    if (pointer.kind === 'pull') updateStickerInteraction({ progress: pointer.startProgress + delta / pointer.travel })
    else if (pointer.kind === 'liner') deviceStore.set(stickerSheetRevealAtom, Math.max(0, Math.min(1, pointer.startProgress + delta / pointer.travel)))
    else {
      const motion = stickerPeelMotion(event.clientX - pointer.startX, event.clientY - pointer.startY, reducedMotion, PACK.peelTravelPx, maxDistance)
      const freeDistance = Math.max(0, maxDistance - (reducedMotion ? 12 : PACK.peelTravelPx))
      const exposure = Math.min(1, freeDistance / PACK.peelTravelPx)
      const returning = pointer.returnWorkspace || pointer.kind === 'rear' && event.clientY > viewport.height * .7
      if (returning) deviceStore.set(pointerAtom, (current) => current === null ? null : { ...current, returnWorkspace: true })
      deviceStore.set(stickerWorkspaceLoweringAtom, viewport.width < PACK.desktopBreakpoint && !returning ? exposure * exposure * (3 - 2 * exposure) : 0)
      const dragged = pointer.stickerId === null ? undefined : getSticker(pointer.stickerId)
      const source = deviceStore.get(stickerInteractionAtom).sourcePlacement
      const pickup = source == null ? null : commands.project(pointer.startX, pointer.startY)
      const seatBounds = source == null ? undefined : host.current?.querySelector<HTMLElement>(`[data-sticker-slot="${source.stickerId}"]`)?.getBoundingClientRect()
      const overOwnSeat = seatBounds !== undefined && event.clientX >= seatBounds.left && event.clientX <= seatBounds.right && event.clientY >= seatBounds.top && event.clientY <= seatBounds.bottom
      const projected = motion.detached && !overOwnSeat ? commands.project(event.clientX, event.clientY) : null
      const point = projected === null ? null : source == null || pickup === null ? projected : { x: projected.x - (pickup.x - source.x), y: projected.y - (pickup.y - source.y) }
      if (source != null && returning) {
        deviceStore.set(stickerWorkspaceLoweringAtom, 0)
        deviceStore.set(stickerSheetRevealAtom, 1)
        updateStickerInteraction({ progress: 1 })
      }
      const preview = dragged === undefined || point === null ? null : { stickerId: dragged.id, surface: 'back' as const, ...point, width: source?.width ?? PACK.placementWidth, rotationDeg: source?.rotationDeg ?? 0 }
      updateStickerInteraction({ peel: motion.peel, stage: preview !== null && isStickerPlacement(preview) ? 'placing' : 'peeling' })
      deviceStore.set(stickerDragOffsetAtom, motion.offset)
      // The renderer consumes the same rear projection and deformation as placement persistence.
      if (preview !== null && isStickerPlacement(preview)) {
        const wasPlacing = deviceStore.get(stickerInteractionAtom).previewPlacement !== null
        updateStickerInteraction({ previewPlacement: preview })
        if (!wasPlacing) animateStickerValue('landing', { position: 0, velocity: 0, target: 0.97 }, reducedMotion, () => {})
      }
      else { updateStickerInteraction({ previewPlacement: null, landing: 0 }) }
    }
  }
  const end = (event: Pick<globalThis.PointerEvent, 'pointerId' | 'clientX' | 'clientY' | 'timeStamp' | 'stopPropagation'>, cancelled = false): void => {
    const pointer = deviceStore.get(pointerAtom)
    if (pointer === null || pointer.pointerId !== event.pointerId) return
    if (!cancelled) { move(event); deviceStore.set(suppressClickAtom, Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) >= 4) }
    event.stopPropagation(); deviceStore.set(pointerAtom, null)
    if (captureTarget.current?.hasPointerCapture(event.pointerId)) captureTarget.current.releasePointerCapture(event.pointerId)
    captureTarget.current = null
    if (cancelled) {
      supersedeStickerInteraction()
      if (pointer.kind === 'pull') cancelStickerInteraction()
      else if (pointer.kind === 'liner') animateStickerValue('sheet', { position: deviceStore.get(stickerSheetRevealAtom), velocity: 0, target: pointer.startProgress > .5 ? 1 : 0 }, reducedMotion, () => {})
      else returnStickerToSheet(reducedMotion)
      return
    }
    if (pointer.kind === 'pull') {
      if (Math.abs(pointer.startY - event.clientY) < 4) revealStickerPack(reducedMotion)
      else releaseStickerPull(pointer.samples, event.timeStamp, pointer.travel, reducedMotion)
    }
    else if (pointer.kind === 'liner') {
      const reveal = deviceStore.get(stickerSheetRevealAtom)
      const velocity = estimatePointerReleaseVelocity(pointer.samples, event.timeStamp)
      const target = reveal - velocity.yPxPerSecond / pointer.travel * .12 > .5 ? 1 : 0
      animateStickerValue('sheet', { position: reveal, velocity: -velocity.yPxPerSecond / pointer.travel, target }, reducedMotion, () => {})
      if (target === 1) claimCollection()
    } else {
      const current = deviceStore.get(stickerInteractionAtom)
      const seat = current.sourcePlacement == null ? null : host.current?.querySelector<HTMLElement>(`[data-sticker-slot="${current.sourcePlacement.stickerId}"]`)
      const bounds = seat?.getBoundingClientRect()
      if (current.sourcePlacement != null && bounds !== undefined && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom) {
        returnPlaced(current.sourcePlacement.stickerId)
        return
      }
      if (current.previewPlacement !== null && current.previewPlacement !== undefined) {
        const velocity = estimatePointerReleaseVelocity(pointer.samples, event.timeStamp)
        const projected = commands.project(event.clientX + velocity.xPxPerSecond * PACK.releaseInertiaSeconds, event.clientY + velocity.yPxPerSecond * PACK.releaseInertiaSeconds)
        const candidate = projected === null || current.sourcePlacement != null ? current.previewPlacement : { ...current.previewPlacement, ...projected }
        const placement = isStickerPlacement(candidate) ? candidate : current.previewPlacement
        updateStickerInteraction({ stage: 'settling' })
        run(async (isCurrent) => {
          await commands.place(placement); if (!isCurrent()) return
          updateStickerInteraction({ previewPlacement: placement })
          animateStickerValue('landing', { position: deviceStore.get(stickerInteractionAtom).landing, velocity: 0, target: 1 }, reducedMotion, () => {
            // Landing preserves the raised cylinder; peel now advances the actual
            // adhesive contact line until the print matches the saved rear mesh.
            animateStickerValue('peel', { position: deviceStore.get(stickerInteractionAtom).peel, velocity: 0, target: 0 }, reducedMotion, () => {
              resetStickerCarry(); updateStickerInteraction({ stage: 'open', selectedStickerId: null, peel: 0, previewPlacement: null, landing: 0 })
              deviceStore.set(collectionMessageAtom, `${getSticker(placement.stickerId)?.name ?? 'Sticker'} stuck to your iPod.`)
            })
          })
        })
      } else returnStickerToSheet(reducedMotion)
    }
  }
  const select = (slot: CollectionSlot): void => { admitIntent(); resetStickerCarry(); deviceStore.set(stickerDetailIdAtom, slot.art.id); updateStickerInteraction({ selectedStickerId: slot.state === 'earned' || slot.state === 'placed' ? slot.art.id : null, stage: 'open', peel: 0, previewPlacement: null, landing: 0 }) }
  const keyboardPlace = (id = selected?.id): void => {
    const selected = id === undefined ? undefined : getSticker(id)
    if (selected === undefined || !collection?.slots.some((slot) => slot.art.id === selected.id && (slot.state === 'earned' || slot.state === 'placed'))) return
    const held = deviceStore.get(stickerInteractionAtom)
    const saved = deviceStore.get(stickerInventoryAtom)?.placements.find((item) => item.stickerId === selected.id)
    const placement = stickerPlacementForIntent(selected.id, held.previewPlacement ?? saved ?? null, saved?.width ?? PACK.placementWidth)
    updateStickerInteraction({ selectedStickerId: selected.id, previewPlacement: placement, stage: 'settling' })
    run(async (isCurrent) => { await commands.place(placement); if (!isCurrent()) return
      animateStickerValue('landing', { position: deviceStore.get(stickerInteractionAtom).landing, velocity: 0, target: 1 }, reducedMotion, () => {
        animateStickerValue('peel', { position: deviceStore.get(stickerInteractionAtom).peel, velocity: 0, target: 0 }, reducedMotion, () => { resetStickerCarry(); updateStickerInteraction({ selectedStickerId: null, stage: 'open', peel: 0, previewPlacement: null, landing: 0 }); deviceStore.set(collectionMessageAtom, `${selected.name} stuck to your iPod.`); lip.current?.focus() })
      })
    })
  }
  const switchCollection = (direction: number): void => {
    if (collection === null || collections.length < 2) return
    admitIntent()
    const index = collections.findIndex((item) => item.genre === collection.genre)
    const next = collections[(index + direction + collections.length) % collections.length]
    if (next === undefined) return
    deviceStore.set(selectedStickerGenreAtom, next.genre)
    deviceStore.set(stickerSheetRevealAtom, 0)
    deviceStore.set(stickerDetailIdAtom, null)
    resetStickerCarry()
    updateStickerInteraction({ selectedStickerId: null, previewPlacement: null, peel: 0, landing: 0, stage: 'open' })
  }
  const claimCollection = (): void => {
    if (collection === null) return
    const generation = getStickerInteractionGeneration()
    void (async () => { for (const id of collection.unopenedPackIds) await commands.openPack(id) })().catch(() => {
      if (generation === getStickerInteractionGeneration()) deviceStore.set(collectionMessageAtom, 'These stickers could not open yet. Try again.')
    })
  }
  const openCollection = (): void => {
    if (collection === null) return
    admitIntent()
    animateStickerValue('sheet', { position: deviceStore.get(stickerSheetRevealAtom), velocity: 0, target: 1 }, reducedMotion, () => {})
    claimCollection()
  }
  const liftKeyboard = (source: StickerPlacement): void => {
    const own = deviceStore.get(stickerCollectionsAtom).find((item) => item.slots.some((slot) => slot.art.id === source.stickerId))
    if (own === undefined) return
    admitIntent(); resetStickerCarry(); deviceStore.set(selectedStickerGenreAtom, own.genre); deviceStore.set(stickerDetailIdAtom, null)
    updateStickerInteraction({ selectedStickerId: source.stickerId, sourcePlacement: source, previewPlacement: null, landing: 0, stage: 'peeling' })
    animateStickerValue('peel', { position: 0, velocity: 0, target: .75 }, reducedMotion, () => {})
  }
  const placedKey = (event: import('react').KeyboardEvent<HTMLButtonElement>, source: StickerPlacement): void => {
    const held = deviceStore.get(stickerInteractionAtom)
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); event.stopPropagation()
      if (held.sourcePlacement?.stickerId !== source.stickerId) liftKeyboard(source)
      else keyboardPlace(source.stickerId)
      return
    }
    const offset = event.key === 'ArrowLeft' ? [-.04, 0] : event.key === 'ArrowRight' ? [.04, 0] : event.key === 'ArrowUp' ? [0, -.04] : event.key === 'ArrowDown' ? [0, .04] : null
    if (offset === null) return
    event.preventDefault(); event.stopPropagation()
    if (held.sourcePlacement?.stickerId !== source.stickerId) liftKeyboard(source)
    const current = stickerPlacementForIntent(source.stickerId, held.previewPlacement ?? source, source.width)
    const next = { ...current, x: current.x + (offset[0] ?? 0), y: current.y + (offset[1] ?? 0) }
    if (isStickerPlacement(next)) updateStickerInteraction({ previewPlacement: next, landing: .97, stage: 'placing' })
  }
  const returnPlaced = (id: string): void => {
    const source = deviceStore.get(stickerInventoryAtom)?.placements.find((item) => item.stickerId === id)
    if (source === undefined) return
    updateStickerInteraction({ sourcePlacement: source, selectedStickerId: id, returnToSheet: true, previewPlacement: null, landing: 0, stage: 'settling' })
    run(async (isCurrent) => {
      const peel = deviceStore.get(stickerInteractionAtom).peel
      let lifted = peel >= .75, saved = false
      const land = (): void => {
        if (!lifted || !saved || !isCurrent()) return
        animateStickerValue('landing', { position: 0, velocity: 0, target: 1 }, reducedMotion, () => {
          animateStickerValue('peel', { position: deviceStore.get(stickerInteractionAtom).peel, velocity: 0, target: 0 }, reducedMotion, () => { resetStickerCarry(); updateStickerInteraction({ stage: 'open' }) })
        })
      }
      // Keyboard return begins lifting immediately too; transport waits for both
      // the physical lift and the server outcome without an orphan promise/timer.
      if (!lifted) animateStickerValue('peel', { position: peel, velocity: 0, target: .75 }, reducedMotion, () => { lifted = true; land() })
      await commands.remove(id)
      saved = true; land()
    })
  }
  // Native capture arbitration sees only painted rear pixels before the shell's R3F lane.
  useEffect(() => {
    const down = (event: globalThis.PointerEvent): void => {
      if (!rear || !event.isPrimary || event.button !== 0 || !(event.target instanceof Element) || event.target.closest('[data-sticker-collection],button,a,input') !== null) return
      const canvas = event.target.closest('.webpod-device-preview__stage')?.querySelector('canvas')
      if (!(canvas instanceof HTMLCanvasElement)) return
      const source = commands.hit(event.clientX, event.clientY)
      if (source === null) return
      const own = deviceStore.get(stickerCollectionsAtom).find((item) => item.slots.some((slot) => slot.art.id === source.stickerId))
      const slot = own?.slots.find((item) => item.art.id === source.stickerId)
      if (own === undefined || slot === undefined) return
      event.preventDefault(); event.stopImmediatePropagation()
      deviceStore.set(selectedStickerGenreAtom, own.genre)
      start(event, canvas, 'rear', slot, source)
    }
    const moved = (event: globalThis.PointerEvent): void => { if (deviceStore.get(pointerAtom)?.kind === 'rear') move(event) }
    const released = (event: globalThis.PointerEvent): void => { if (deviceStore.get(pointerAtom)?.kind === 'rear') end(event) }
    const cancelled = (event: globalThis.PointerEvent): void => { if (deviceStore.get(pointerAtom)?.kind === 'rear') end(event, true) }
    const escaped = (event: globalThis.KeyboardEvent): void => { if (event.key === 'Escape' && deviceStore.get(stickerInteractionAtom).sourcePlacement != null) { event.preventDefault(); event.stopImmediatePropagation(); releaseCapturedStickerPointer(captureTarget.current); returnStickerToSheet(reducedMotion) } }
    document.addEventListener('keydown', escaped, true)
    document.addEventListener('pointerdown', down, true); document.addEventListener('pointermove', moved, true); document.addEventListener('pointerup', released, true); document.addEventListener('pointercancel', cancelled, true); document.addEventListener('lostpointercapture', cancelled, true)
    return () => { document.removeEventListener('keydown', escaped, true); document.removeEventListener('pointerdown', down, true); document.removeEventListener('pointermove', moved, true); document.removeEventListener('pointerup', released, true); document.removeEventListener('pointercancel', cancelled, true); document.removeEventListener('lostpointercapture', cancelled, true) }
  })
  if (!rear || compositeTier.tier !== 'T1') return null
  if (!usable && interaction.sourcePlacement == null) return artworkFailure !== null
    ? <p role="status" className="pointer-events-auto absolute right-4 top-16 max-w-[min(22rem,calc(100%-2rem))] rounded-sm bg-[#eee7d9]/95 px-3 py-2 text-xs text-stone-800">This pack’s artwork couldn’t load. <button type="button" className={buttonClass} onClick={() => { retryStickerArtwork() }}>Retry artwork</button></p>
    : <StickerImportStatus status={inventory?.importStatus} retry={() => run(commands.retry)} usable={false} />
  return (
    <div ref={host} className="pointer-events-none absolute inset-0 z-20" data-sticker-stage={interaction.stage} data-sticker-reduced-motion={reducedMotion} data-sticker-progress={interaction.progress} data-sticker-workspace-lowering={workspaceLowering} data-sticker-sheet-reveal={sheetReveal} data-sticker-peel={interaction.peel} data-sticker-landing={interaction.landing} onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); if (deviceStore.get(stickerInteractionAtom).sourcePlacement != null) { releaseCapturedStickerPointer(captureTarget.current); returnStickerToSheet(reducedMotion) } else if (detail !== undefined) deviceStore.set(stickerDetailIdAtom, null); else close() } }}>
      {(inventory?.placements ?? []).map((placement) => {
        const point = commands.screen(placement)
        if (point === null) return null
        return <button key={placement.stickerId} type="button" data-sticker-placed={placement.stickerId} aria-label={`Move ${getSticker(placement.stickerId)?.name ?? 'sticker'}. Enter lifts, arrows move, Enter sticks, Escape cancels.`} className="pointer-events-none absolute h-11 w-11 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#eee7d9]" style={{ left: point.x - 22, top: point.y - 22 }} onKeyDown={(event) => placedKey(event, placement)} />
      })}
      {usable ? <div className="pointer-events-auto absolute text-[#29291f]" data-sticker-collection={collection?.genre} style={{ left: layout.centerX - layout.width / 2, width: layout.width, height: layout.height, bottom: PACK.bottomGapPx, transform: `translateY(${(layout.height + PACK.bottomGapPx - PACK.teasePx) * (1 - interaction.progress) - layout.height * PACK.linerTravel * sheetReveal + (viewport.width < PACK.desktopBreakpoint ? layout.height * PACK.linerTravel * workspaceLowering : 0)}px)` }}>
        <button ref={lip} type="button" className="absolute -top-1 left-0 z-10 min-h-11 w-full touch-none rounded-sm px-4 font-mono text-[10px] font-semibold tracking-[.14em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e2ac69]" aria-label="Pull sticker pack into view" aria-expanded={expanded} onPointerDown={(event) => begin(event, 'pull')} onPointerMove={move} onPointerUp={(event) => end(event)} onPointerCancel={(event) => end(event, true)} onLostPointerCapture={(event) => end(event, true)} onClick={(event) => { if (event.detail === 0) { admitIntent(); revealStickerPack(reducedMotion) } }}>
          {expanded ? 'PLAYWORN  /  LISTENING COLLECTION' : 'PLAYWORN  /  PULL TO COLLECT ↑'}
        </button>
        {expanded ? <>
          {collection !== null ? <>
            <div className="pointer-events-none absolute inset-x-5 top-[12%]">
              <h2 className="text-[clamp(20px,3.5vw,30px)] font-black leading-none tracking-[-.04em]" style={{ fontFamily: 'Impact, Haettenschweiler, Arial Narrow, sans-serif' }}>{collection.title}</h2>
              <p className="mt-2 font-mono text-[9px] tracking-[.12em] uppercase">{genreLabel(collection.genre)} · {collection.earned} OF 5 COLLECTED</p>
            </div>
            <button type="button" aria-label="Pull sticker liner open" className="absolute z-20 left-[35%] -top-3 h-12 w-[30%] touch-none rounded-sm font-mono text-[10px] focus-visible:outline-2" onPointerDown={(event) => begin(event, 'liner')} onPointerMove={move} onPointerUp={(event) => end(event)} onPointerCancel={(event) => end(event, true)} onLostPointerCapture={(event) => end(event, true)} onClick={(event) => { if (event.detail === 0) openCollection() }}><span className="sr-only">Pull liner up</span></button>
            {sheetOpen ? collection.slots.map((slot, index) => {
              const seat = STICKER_SHEET_SLOTS[index]
              if (seat === undefined) return null
              const label = slot.state === 'placed' ? 'On your iPod' : slot.state === 'locked' ? formatListeningMinutes(slot.thresholdMinutes) : slot.state === 'sealed' ? 'New · open pack' : 'Peel ↗'
              return <button key={slot.art.id} type="button" data-sticker-slot={slot.art.id} data-sticker-slot-state={slot.state} aria-label={slot.state === 'earned' ? `Peel ${slot.art.name} and drag onto the iPod. Arrow keys position, Enter sticks.` : `${slot.art.name}. ${label}. View sticker meaning.`} aria-describedby={detail?.art.id === slot.art.id ? 'sticker-meaning' : undefined} className="absolute min-h-11 min-w-11 touch-none rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9a4c22]" style={{ left: `${(seat.x - .145) * 100}%`, top: `${(seat.y - .12) * 100}%`, width: '29%', height: '26%' }} onPointerEnter={() => { if (deviceStore.get(pointerAtom) === null) deviceStore.set(stickerDetailIdAtom, slot.art.id) }} onFocus={() => { if (deviceStore.get(pointerAtom) === null) deviceStore.set(stickerDetailIdAtom, slot.art.id) }} onPointerDown={(event) => begin(event, 'peel', slot)} onPointerMove={move} onPointerUp={(event) => end(event)} onPointerCancel={(event) => end(event, true)} onLostPointerCapture={(event) => end(event, true)} onClick={(event) => { if (event.detail > 0 && deviceStore.get(suppressClickAtom)) { deviceStore.set(suppressClickAtom, false); return } if (event.detail === 0 && (slot.state === 'earned' || slot.state === 'placed') && interaction.previewPlacement !== null) keyboardPlace(slot.art.id); else select(slot) }} onKeyDown={(event) => {
                if (slot.state !== 'earned' && slot.state !== 'placed') return
                const offset = event.key === 'ArrowLeft' ? [-.04, 0] : event.key === 'ArrowRight' ? [.04, 0] : event.key === 'ArrowUp' ? [0, -.04] : event.key === 'ArrowDown' ? [0, .04] : null
                if (offset === null) return
                event.preventDefault(); admitIntent()
                const saved = deviceStore.get(stickerInventoryAtom)?.placements.find((item) => item.stickerId === slot.art.id)
                const held = deviceStore.get(stickerInteractionAtom)
                const current = stickerPlacementForIntent(slot.art.id, held.previewPlacement ?? saved ?? null, saved?.width ?? PACK.placementWidth)
                if (saved !== undefined && held.sourcePlacement == null) updateStickerInteraction({ sourcePlacement: saved })
                const next = { ...current, x: current.x + (offset[0] ?? 0), y: current.y + (offset[1] ?? 0) }
                if (isStickerPlacement(next)) updateStickerInteraction({ selectedStickerId: slot.art.id, previewPlacement: next, landing: 1, peel: 0, stage: 'placing' })
              }}><span className="absolute inset-x-0 bottom-0 font-mono text-[9px] leading-tight uppercase">{label}</span></button>
            }) : null}
            {sheetOpen ? <div className="absolute inset-x-5 flex items-center justify-between gap-2" style={{ bottom: layout.height * .07 - layout.height * PACK.linerTravel * sheetReveal }}><span className="font-mono text-[10px] font-bold tracking-[.12em]">PLAYWORN</span><button type="button" className="min-h-11 px-2 font-mono text-[10px] uppercase focus-visible:outline-2 focus-visible:outline-offset-2" aria-label="Put pack away" onClick={close}>Slide away ↓</button></div> : null}
            <nav aria-label="Sticker collections" className="absolute -top-14 inset-x-0 flex items-center justify-between text-[#e5e6df]">
              <button type="button" aria-label="Previous sticker collection" className={navigationClass} disabled={collections.length < 2} onClick={() => switchCollection(-1)}>‹</button>
              <span className="font-mono text-[10px] uppercase tracking-[.1em]">{collections.findIndex((item) => item.genre === collection.genre) + 1} / {collections.length} COLLECTIONS</span>
              <button type="button" aria-label="Next sticker collection" className={navigationClass} disabled={collections.length < 2} onClick={() => switchCollection(1)}>›</button>
            </nav>
          </> : <div className="absolute inset-x-6 top-16 text-center text-sm"><h2 className="font-bold">Your listening, collected.</h2><p className="mt-4">{status === 'signed-out' ? 'Connect Apple Music to earn your first stickers.' : status === 'loading' ? 'Finding your listening’s first stickers…' : status === 'error' ? 'Your collection could not load.' : 'Keep listening in webPod. Your first pack is on its way.'}</p>{status === 'error' ? <button className={buttonClass} type="button" onClick={() => run(commands.retry)}>Try again</button> : null}<button type="button" className={buttonClass} onClick={close}>Put pack away</button></div>}
          {detail === undefined ? null : <div id="sticker-meaning" className="absolute z-30 w-full rounded-sm bg-[#eee7d9] p-4 text-[#292d25] shadow-xl" style={viewport.width >= PACK.desktopBreakpoint ? { right: 0, bottom: layout.height + 64 } : { left: 0, bottom: layout.height + 64 }}>
            <button type="button" aria-label="Dismiss sticker meaning" className="absolute right-0 top-0 min-h-11 min-w-11 text-lg focus-visible:outline-2" onClick={() => deviceStore.set(stickerDetailIdAtom, null)}>×</button>
            <p className="pr-8 text-sm font-bold">{detail.art.name}</p><p className="mt-1 max-w-[32ch] text-xs leading-relaxed">{detail.meaning}</p>
            <p className="mt-2 font-mono text-[10px] uppercase">{detail.state === 'locked' ? `${detail.remainingMinutes} min to go · ${formatListeningMinutes(detail.thresholdMinutes)} milestone` : detail.state === 'placed' ? 'On your iPod · seat saved on this sheet' : detail.state === 'sealed' ? 'Earned · waiting to be opened' : 'Earned · peel from the sheet'}</p>
            {detail.state === 'locked' ? <progress className="mt-2 h-1 w-full accent-[#a85d36]" value={Math.min(collection?.listenedMinutes ?? 0, detail.thresholdMinutes)} max={detail.thresholdMinutes} aria-label={`${detail.art.name} listening progress`} /> : detail.state === 'placed' ? <><button className={buttonClass} type="button" onClick={() => { const source = inventory?.placements.find((item) => item.stickerId === detail.art.id); if (source !== undefined) liftKeyboard(source) }}>Move sticker</button><button className={buttonClass} type="button" onClick={() => returnPlaced(detail.art.id)}>Return to sheet</button></> : detail.state === 'sealed' ? <button className={buttonClass} type="button" onClick={openCollection}>Open new stickers</button> : <button className={buttonClass} type="button" onClick={() => keyboardPlace(detail.art.id)}>Stick {detail.art.name}</button>}
          </div>}
        </> : null}
      </div> : null}
      {message === null ? null : <p role="status" className="absolute inset-x-4 top-32 mx-auto w-fit max-w-[calc(100%-32px)] rounded-sm bg-[#eee7d9] px-3 py-2 text-center text-xs text-[#292d25]">{message}</p>}
      {artworkFailure === null ? <StickerImportStatus status={inventory?.importStatus} retry={() => run(commands.retry)} usable={usable} /> : <p role="alert" className="pointer-events-auto absolute right-4 top-16 max-w-[min(22rem,calc(100%-2rem))] rounded-sm bg-[#eee7d9]/95 px-3 py-2 text-xs leading-relaxed text-stone-800">A sticker image could not load. <button type="button" className={buttonClass} onClick={() => { retryStickerArtwork() }}>Retry artwork</button></p>}
    </div>
  )
}
const navigationClass = 'min-h-11 min-w-11 rounded-full text-2xl hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-30'

const buttonClass = 'min-h-11 shrink-0 rounded-md px-3 py-2 font-medium hover:bg-stone-200 active:bg-stone-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:opacity-50'
const sample = (event: Pick<globalThis.PointerEvent, 'clientX' | 'clientY' | 'timeStamp'>): PointerMotionSample => ({ clientX: event.clientX, clientY: event.clientY, timestampMs: event.timeStamp })

/** Sampling is a successful bounded import; only an actual failed import offers retry. */
export function StickerImportStatus({ status, retry, usable = false }: { readonly status: StickerInventory['importStatus'] | undefined; readonly retry: () => void; readonly usable?: boolean }) {
  if (status !== 'partial' && status !== 'failed') return null
  return <p role="status" className="pointer-events-auto absolute right-4 top-16 max-w-[min(22rem,calc(100%-2rem))] rounded-sm bg-[#eee7d9]/95 px-3 py-2 text-xs leading-relaxed text-stone-800">
    {status === 'partial' ? <>{usable ? 'Your stickers are ready.' : 'Part of your library is synced.'}<span className="sr-only"> We checked part of your library. Listening in webPod earns more stickers.</span></> : <>{usable ? 'Library sync paused. Your stickers are still here.' : 'Couldn’t sync your library yet.'} <button type="button" className={buttonClass} onClick={retry}>Try again</button></>}
  </p>
}
