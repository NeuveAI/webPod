import { atom, useAtomValue } from 'jotai'
import { useEffect, useRef, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react'
import { getCompositeTierSnapshot, subscribeCompositeTier } from '@webpod/composite'
import { deviceStore, stickerCollectionStatusAtom, stickerInteractionAtom, stickerInventoryAtom } from '@webpod/state'
import { getSticker, isStickerPlacement, type StickerPlacement, type StickerInventory } from '@webpod/stickers'
import type { DeviceOrientation } from '@webpod/device'
import { deviceFrontVisibility, STICKER_PACK_LAYOUT, STICKER_SHEET_SLOTS, stickerPackViewportLayout, retryStickerArtwork } from '@webpod/device'
import { animateStickerValue, returnStickerToSheet, resetStickerCarry, cancelStickerInteraction, releaseStickerPull, revealStickerPack, setStickerRearVisible, updateStickerInteraction, stickerArtworkFailureAtom, getStickerInteractionGeneration, supersedeStickerInteraction } from './sticker-interaction'
import { activeStickerCollectionAtom, stickerCollectionsAtom, selectedStickerGenreAtom, stickerSheetRevealAtom, stickerDetailIdAtom, stickerDragOffsetAtom, genreLabel, formatListeningMinutes, stickerPlacementForIntent, stickerPeelMotion, stickerWorkspaceLoweringAtom, type CollectionSlot } from './sticker-collections-model'
import { estimatePointerReleaseVelocity, type PointerMotionSample } from './device-orientation-motion'

const PACK = { ...STICKER_PACK_LAYOUT, peelTravelPx: 64, placementWidth: 0.25, releaseInertiaSeconds: 0.025 } as const
const REAR = { admit: -0.7, leave: -0.45 } as const
const SERVER_TIER: ReturnType<typeof getCompositeTierSnapshot> = { tier: 'T4', reason: 'Device rendering begins in the browser.', report: null, contextLost: false }
const readServerTier = (): ReturnType<typeof getCompositeTierSnapshot> => SERVER_TIER
interface StickerPointer {
  readonly kind: 'pull' | 'peel'
  readonly pointerId: number
  readonly startX: number
  readonly stickerId: string | null
  readonly maxDistance: number
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
function releaseCapturedStickerPointer(target: HTMLButtonElement | null): void {
  const pointer = deviceStore.get(pointerAtom)
  deviceStore.set(pointerAtom, null)
  if (pointer !== null && target?.hasPointerCapture(pointer.pointerId)) target.releasePointerCapture(pointer.pointerId)
}

export interface StickerCollectionCommands {
  readonly retry: () => Promise<void>
  readonly openPack: (id: string) => Promise<void>
  readonly place: (placement: StickerPlacement) => Promise<void>
  readonly remove: (id: string) => Promise<void>
  readonly project: (clientX: number, clientY: number) => { readonly x: number; readonly y: number } | null
}

/** Semantic overlay for the same lit 3D pack. Drag and keyboard share store actions. */
export function StickerCollection({ orientation, commands }: { readonly orientation: DeviceOrientation; readonly commands: StickerCollectionCommands }) {
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
  const captureTarget = useRef<HTMLButtonElement | null>(null)
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
  const expanded = interaction.stage !== 'hidden' && interaction.stage !== 'tease' && interaction.stage !== 'pulling'

  useEffect(() => {
    const element = host.current
    if (element === null) return
    const observer = new ResizeObserver(([entry]) => { if (entry !== undefined) deviceStore.set(viewportAtom, { width: entry.contentRect.width, height: entry.contentRect.height }) })
    observer.observe(element)
    return () => observer.disconnect()
  }, [rear])
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
  }, [orientation, compositeTier.tier])
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
    void work(isCurrent).catch(() => { if (isCurrent() && deviceStore.get(stickerCollectionStatusAtom) !== 'signed-out') { resetStickerCarry(); updateStickerInteraction({ stage: 'open', previewPlacement: null, landing: 0, peel: 0 }); deviceStore.set(collectionMessageAtom, 'Your collection could not save. Try again.') } })
  }
  const close = (): void => {
    admitIntent(); deviceStore.set(stickerDetailIdAtom, null); resetStickerCarry()
    updateStickerInteraction({ selectedStickerId: null, peel: 0, previewPlacement: null, landing: 0, stage: 'pulling' })
    const lower = (): void => animateStickerValue('progress', { position: interaction.progress, velocity: -.8, target: 0 }, reducedMotion, () => cancelStickerInteraction())
    animateStickerValue('sheet', { position: sheetReveal, velocity: 0, target: 0 }, reducedMotion, lower)
    lip.current?.focus()
  }
  const begin = (event: ReactPointerEvent<HTMLButtonElement>, kind: StickerPointer['kind'], slot?: CollectionSlot): void => {
    if (!event.isPrimary || event.button !== 0) return
    deviceStore.set(suppressClickAtom, false)
    event.stopPropagation(); if (kind === 'peel' && slot?.state !== 'earned') return
    deviceStore.set(collectionMessageAtom, null)
    admitIntent()
    deviceStore.set(stickerDetailIdAtom, null)
    resetStickerCarry()
    if (slot !== undefined) updateStickerInteraction({ selectedStickerId: slot.art.id, peel: 0, previewPlacement: null, landing: 0 })
    event.currentTarget.setPointerCapture(event.pointerId)
    captureTarget.current = event.currentTarget
    deviceStore.set(pointerAtom, { kind, maxDistance: 0, pointerId: event.pointerId, stickerId: slot?.art.id ?? null, startX: event.clientX, startY: event.clientY, startProgress: interaction.progress, travel: layout.height + PACK.bottomGapPx - PACK.teasePx, samples: [sample(event)] })
    updateStickerInteraction({ stage: kind === 'pull' ? 'pulling' : 'peeling' })
  }
  const move = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const pointer = deviceStore.get(pointerAtom)
    if (pointer === null || pointer.pointerId !== event.pointerId) return
    event.stopPropagation()
    const maxDistance = Math.max(pointer.maxDistance, Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY))
    deviceStore.set(pointerAtom, { ...pointer, maxDistance, samples: [...pointer.samples.slice(-11), sample(event)] })
    const delta = pointer.startY - event.clientY
    if (pointer.kind === 'pull') updateStickerInteraction({ progress: pointer.startProgress + delta / pointer.travel })
    else {
      const motion = stickerPeelMotion(event.clientX - pointer.startX, event.clientY - pointer.startY, reducedMotion, PACK.peelTravelPx, maxDistance)
      const freeDistance = Math.max(0, maxDistance - (reducedMotion ? 12 : PACK.peelTravelPx))
      const exposure = Math.min(1, freeDistance / PACK.peelTravelPx)
      deviceStore.set(stickerWorkspaceLoweringAtom, viewport.width < PACK.desktopBreakpoint ? exposure * exposure * (3 - 2 * exposure) : 0)
      const dragged = pointer.stickerId === null ? undefined : getSticker(pointer.stickerId)
      const point = motion.detached ? commands.project(event.clientX, event.clientY) : null
      const preview = dragged === undefined || point === null ? null : { stickerId: dragged.id, surface: 'back' as const, ...point, width: PACK.placementWidth, rotationDeg: 0 }
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
  const end = (event: ReactPointerEvent<HTMLButtonElement>, cancelled = false): void => {
    const pointer = deviceStore.get(pointerAtom)
    if (pointer === null || pointer.pointerId !== event.pointerId) return
    if (!cancelled) { move(event); deviceStore.set(suppressClickAtom, Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) >= 4) }
    event.stopPropagation(); deviceStore.set(pointerAtom, null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    captureTarget.current = null
    if (cancelled) {
      supersedeStickerInteraction()
      if (pointer.kind === 'pull') cancelStickerInteraction()
      else returnStickerToSheet(reducedMotion)
      return
    }
    if (pointer.kind === 'pull') {
      if (Math.abs(pointer.startY - event.clientY) < 4) revealStickerPack(reducedMotion)
      else releaseStickerPull(pointer.samples, event.timeStamp, pointer.travel, reducedMotion)
    }
    else {
      const current = deviceStore.get(stickerInteractionAtom)
      if (current.previewPlacement !== null && current.previewPlacement !== undefined) {
        const velocity = estimatePointerReleaseVelocity(pointer.samples, event.timeStamp)
        const projected = commands.project(event.clientX + velocity.xPxPerSecond * PACK.releaseInertiaSeconds, event.clientY + velocity.yPxPerSecond * PACK.releaseInertiaSeconds)
        const candidate = projected === null ? current.previewPlacement : { ...current.previewPlacement, ...projected }
        const placement = isStickerPlacement(candidate) ? candidate : current.previewPlacement
        updateStickerInteraction({ stage: 'settling' })
        run(async (isCurrent) => { await commands.place(placement); if (!isCurrent()) return; updateStickerInteraction({ previewPlacement: placement, landing: 1 }); animateStickerValue('peel', { position: current.peel, velocity: 0, target: 0 }, reducedMotion, () => { resetStickerCarry(); updateStickerInteraction({ stage: 'open', selectedStickerId: null, peel: 0, previewPlacement: null, landing: 0 }); deviceStore.set(collectionMessageAtom, `${getSticker(placement.stickerId)?.name ?? 'Sticker'} stuck to your iPod.`) }) })
      } else returnStickerToSheet(reducedMotion)
    }
  }
  const select = (slot: CollectionSlot): void => { admitIntent(); resetStickerCarry(); deviceStore.set(stickerDetailIdAtom, slot.art.id); updateStickerInteraction({ selectedStickerId: slot.state === 'earned' || slot.state === 'placed' ? slot.art.id : null, stage: 'open', peel: 0, previewPlacement: null, landing: 0 }) }
  const keyboardPlace = (id = selected?.id): void => {
    const selected = id === undefined ? undefined : getSticker(id)
    if (selected === undefined || collection?.slots.find((slot) => slot.art.id === selected.id)?.state !== 'earned') return
    const placement = stickerPlacementForIntent(selected.id, deviceStore.get(stickerInteractionAtom).previewPlacement, PACK.placementWidth)
    run(async (isCurrent) => { await commands.place(placement); if (!isCurrent()) return; resetStickerCarry(); updateStickerInteraction({ selectedStickerId: null, stage: 'open', peel: 0, previewPlacement: null, landing: 0 }); deviceStore.set(collectionMessageAtom, `${selected.name} stuck to your iPod.`); lip.current?.focus() })
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
  const openCollection = (): void => {
    if (collection === null) return
    run(async (isCurrent) => {
      for (const id of collection.unopenedPackIds) { await commands.openPack(id); if (!isCurrent()) return }
      animateStickerValue('sheet', { position: sheetReveal, velocity: 0, target: 1 }, reducedMotion, () => {})
    })
  }
  if (!rear || compositeTier.tier !== 'T1') return null
  return (
    <div ref={host} className="pointer-events-none absolute inset-0 z-20" data-sticker-stage={interaction.stage} data-sticker-reduced-motion={reducedMotion} data-sticker-progress={interaction.progress} data-sticker-workspace-lowering={workspaceLowering} data-sticker-sheet-reveal={sheetReveal} data-sticker-peel={interaction.peel} data-sticker-landing={interaction.landing} onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); if (detail !== undefined) deviceStore.set(stickerDetailIdAtom, null); else close() } }}>
      <div className="pointer-events-auto absolute text-[#29291f]" data-sticker-collection={collection?.genre} style={{ left: layout.centerX - layout.width / 2, width: layout.width, height: layout.height, bottom: PACK.bottomGapPx, transform: `translateY(${(layout.height + PACK.bottomGapPx - PACK.teasePx) * (1 - interaction.progress) - layout.height * PACK.linerTravel * sheetReveal + (viewport.width < PACK.desktopBreakpoint ? layout.height * PACK.linerTravel * workspaceLowering : 0)}px)` }}>
        <button ref={lip} type="button" className="absolute -top-1 left-0 z-10 min-h-11 w-full touch-none rounded-sm px-4 font-mono text-[10px] font-semibold tracking-[.14em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e2ac69]" aria-label="Pull sticker pack into view" aria-expanded={expanded} onPointerDown={(event) => begin(event, 'pull')} onPointerMove={move} onPointerUp={(event) => end(event)} onPointerCancel={(event) => end(event, true)} onLostPointerCapture={(event) => end(event, true)} onClick={(event) => { if (event.detail === 0) { admitIntent(); revealStickerPack(reducedMotion) } }}>
          {expanded ? 'PLAYWORN  /  LISTENING COLLECTION' : 'PLAYWORN  /  PULL TO COLLECT ↑'}
        </button>
        {expanded ? <>
          {collection !== null ? <>
            <div className="pointer-events-none absolute inset-x-5 top-[12%]">
              <h2 className="text-[clamp(20px,3.5vw,30px)] font-black leading-none tracking-[-.04em]" style={{ fontFamily: 'Impact, Haettenschweiler, Arial Narrow, sans-serif' }}>{collection.title}</h2>
              <p className="mt-2 font-mono text-[9px] tracking-[.12em] uppercase">{genreLabel(collection.genre)} · {collection.earned} OF 5 COLLECTED</p>
            </div>
            {!sheetOpen ? <button type="button" aria-label="Open earned pack" className="absolute inset-x-4 bottom-[7%] top-[27%] flex items-end justify-center rounded-sm pb-3 font-mono text-[10px] uppercase tracking-wide focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#29291f]" onClick={openCollection}><span className="bg-[#eee7d4] px-4 py-3">Slide out the sticker sheet ↑</span></button> : collection.slots.map((slot, index) => {
              const seat = STICKER_SHEET_SLOTS[index]
              if (seat === undefined) return null
              const label = slot.state === 'placed' ? 'On your iPod' : slot.state === 'locked' ? formatListeningMinutes(slot.thresholdMinutes) : slot.state === 'sealed' ? 'New · open pack' : 'Peel ↗'
              return <button key={slot.art.id} type="button" data-sticker-slot={slot.art.id} data-sticker-slot-state={slot.state} aria-label={slot.state === 'earned' ? `Peel ${slot.art.name} and drag onto the iPod. Arrow keys position, Enter sticks.` : `${slot.art.name}. ${label}. View sticker meaning.`} aria-describedby={detail?.art.id === slot.art.id ? 'sticker-meaning' : undefined} className="absolute min-h-11 min-w-11 touch-none rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9a4c22]" style={{ left: `${(seat.x - .145) * 100}%`, top: `${(seat.y - .12) * 100}%`, width: '29%', height: '26%' }} onPointerEnter={() => { if (deviceStore.get(pointerAtom) === null) deviceStore.set(stickerDetailIdAtom, slot.art.id) }} onFocus={() => { if (deviceStore.get(pointerAtom) === null) deviceStore.set(stickerDetailIdAtom, slot.art.id) }} onPointerDown={(event) => begin(event, 'peel', slot)} onPointerMove={move} onPointerUp={(event) => end(event)} onPointerCancel={(event) => end(event, true)} onLostPointerCapture={(event) => end(event, true)} onClick={(event) => { if (event.detail > 0 && deviceStore.get(suppressClickAtom)) { deviceStore.set(suppressClickAtom, false); return } if (event.detail === 0 && slot.state === 'earned' && interaction.previewPlacement !== null) keyboardPlace(slot.art.id); else select(slot) }} onKeyDown={(event) => {
                if (slot.state !== 'earned') return
                const offset = event.key === 'ArrowLeft' ? [-.04, 0] : event.key === 'ArrowRight' ? [.04, 0] : event.key === 'ArrowUp' ? [0, -.04] : event.key === 'ArrowDown' ? [0, .04] : null
                if (offset === null) return
                event.preventDefault(); admitIntent()
                const current = stickerPlacementForIntent(slot.art.id, deviceStore.get(stickerInteractionAtom).previewPlacement, PACK.placementWidth)
                const next = { ...current, x: current.x + (offset[0] ?? 0), y: current.y + (offset[1] ?? 0) }
                if (isStickerPlacement(next)) updateStickerInteraction({ selectedStickerId: slot.art.id, previewPlacement: next, landing: 1, peel: 0, stage: 'placing' })
              }}><span className="absolute inset-x-0 bottom-0 font-mono text-[9px] leading-tight uppercase">{label}</span></button>
            })}
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
            {detail.state === 'locked' ? <progress className="mt-2 h-1 w-full accent-[#a85d36]" value={Math.min(collection?.listenedMinutes ?? 0, detail.thresholdMinutes)} max={detail.thresholdMinutes} aria-label={`${detail.art.name} listening progress`} /> : detail.state === 'placed' ? <button className={buttonClass} type="button" onClick={() => run(() => commands.remove(detail.art.id))}>Return to sheet</button> : detail.state === 'sealed' ? <button className={buttonClass} type="button" onClick={openCollection}>Open new stickers</button> : <button className={buttonClass} type="button" onClick={() => keyboardPlace(detail.art.id)}>Stick {detail.art.name}</button>}
          </div>}
        </> : null}
      </div>
      {message === null ? null : <p role="status" className="absolute inset-x-4 top-32 mx-auto w-fit max-w-[calc(100%-32px)] rounded-sm bg-[#eee7d9] px-3 py-2 text-center text-xs text-[#292d25]">{message}</p>}
      {artworkFailure === null ? <StickerImportStatus status={inventory?.importStatus} retry={() => run(commands.retry)} /> : <p role="alert" className="pointer-events-auto absolute inset-x-4 top-20 mx-auto max-w-md rounded-md bg-stone-100 p-3 text-sm text-stone-900">A sticker image could not load. <button type="button" className={buttonClass} onClick={() => { retryStickerArtwork() }}>Retry artwork</button></p>}
    </div>
  )
}
const navigationClass = 'min-h-11 min-w-11 rounded-full text-2xl hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-30'

const buttonClass = 'min-h-11 shrink-0 rounded-md px-3 py-2 font-medium hover:bg-stone-200 active:bg-stone-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:opacity-50'
const sample = (event: ReactPointerEvent): PointerMotionSample => ({ clientX: event.clientX, clientY: event.clientY, timestampMs: event.timeStamp })

/** Sampling is a successful bounded import; only an actual failed import offers retry. */
export function StickerImportStatus({ status, retry }: { readonly status: StickerInventory['importStatus'] | undefined; readonly retry: () => void }) {
  if (status !== 'partial' && status !== 'failed') return null
  return <p role="status" className="pointer-events-auto absolute inset-x-4 top-20 mx-auto max-w-md rounded-md bg-stone-100 p-3 text-sm text-stone-900">
    {status === 'partial' ? 'We synced a sample of your Apple Music library. Keep listening in webPod to earn more.' : <>Some Apple Music data could not sync. Your earned stickers are safe. <button type="button" className={buttonClass} onClick={retry}>Retry sync</button></>}
  </p>
}
