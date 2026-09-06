import { atom, useAtomValue } from 'jotai'
import { useEffect, useRef, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react'
import { getCompositeTierSnapshot, subscribeCompositeTier } from '@webpod/composite'
import { deviceStore, stickerCollectionStatusAtom, stickerInteractionAtom, stickerInventoryAtom } from '@webpod/state'
import { getSticker, isStickerPlacement, type StickerPlacement, type StickerInventory } from '@webpod/stickers'
import type { DeviceOrientation } from '@webpod/device'
import { deviceFrontVisibility, STICKER_PACK_LAYOUT, retryStickerArtwork } from '@webpod/device'
import { animateStickerValue, cancelStickerInteraction, releaseStickerPull, revealStickerPack, setStickerRearVisible, updateStickerInteraction, stickerArtworkFailureAtom, getStickerInteractionGeneration, supersedeStickerInteraction } from './sticker-interaction'
import { estimatePointerReleaseVelocity, type PointerMotionSample } from './device-orientation-motion'

const PACK = { ...STICKER_PACK_LAYOUT, peelTravelPx: 100, placementWidth: 0.25, releaseInertiaSeconds: 0.025 } as const
const REAR = { admit: -0.7, leave: -0.45 } as const
const SERVER_TIER: ReturnType<typeof getCompositeTierSnapshot> = { tier: 'T4', reason: 'Device rendering begins in the browser.', report: null, contextLost: false }
const readServerTier = (): ReturnType<typeof getCompositeTierSnapshot> => SERVER_TIER
interface StickerPointer {
  readonly kind: 'pull' | 'peel'
  readonly pointerId: number
  readonly startY: number
  readonly startProgress: number
  readonly travel: number
  readonly samples: readonly PointerMotionSample[]
}
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
  const pack = inventory?.packs.find((item) => item.id === interaction.packId)
  const selected = interaction.selectedStickerId === null ? undefined : getSticker(interaction.selectedStickerId)
  const expanded = interaction.stage !== 'hidden' && interaction.stage !== 'tease' && interaction.stage !== 'pulling'

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
    if (status === 'signed-out') { releaseCapturedStickerPointer(captureTarget.current); cancelStickerInteraction(); deviceStore.set(collectionMessageAtom, null) }
  }, [status])

  /** Every new command/selection/gesture owns presentation; older server writes may still finish. */
  const admitIntent = (): void => { releaseCapturedStickerPointer(captureTarget.current); captureTarget.current = null; supersedeStickerInteraction() }
  const run = (work: (isCurrent: () => boolean) => Promise<void>): void => {
    admitIntent()
    const generation = getStickerInteractionGeneration()
    const isCurrent = (): boolean => generation === getStickerInteractionGeneration()
    deviceStore.set(collectionMessageAtom, null)
    void work(isCurrent).catch(() => { if (isCurrent() && deviceStore.get(stickerCollectionStatusAtom) !== 'signed-out') { updateStickerInteraction({ stage: 'open', previewPlacement: null, landing: 0, peel: 0 }); deviceStore.set(collectionMessageAtom, 'Your collection could not save. Try again.') } })
  }
  const close = (): void => { releaseCapturedStickerPointer(captureTarget.current); cancelStickerInteraction(); lip.current?.focus() }
  const begin = (event: ReactPointerEvent<HTMLButtonElement>, kind: StickerPointer['kind']): void => {
    if (!event.isPrimary || event.button !== 0) return
    event.stopPropagation(); admitIntent()
    const width = Math.min(PACK.maxWidthPx, (host.current?.getBoundingClientRect().width ?? 480) * PACK.widthRatio)
    event.currentTarget.setPointerCapture(event.pointerId)
    captureTarget.current = event.currentTarget
    deviceStore.set(pointerAtom, { kind, pointerId: event.pointerId, startY: event.clientY, startProgress: interaction.progress, travel: width * PACK.heightRatio + PACK.bottomGapPx - PACK.teasePx, samples: [sample(event)] })
    updateStickerInteraction({ stage: kind === 'pull' ? 'pulling' : 'peeling' })
  }
  const move = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const pointer = deviceStore.get(pointerAtom)
    if (pointer === null || pointer.pointerId !== event.pointerId) return
    event.stopPropagation()
    deviceStore.set(pointerAtom, { ...pointer, samples: [...pointer.samples.slice(-11), sample(event)] })
    const delta = pointer.startY - event.clientY
    if (pointer.kind === 'pull') updateStickerInteraction({ progress: pointer.startProgress + delta / pointer.travel })
    else {
      const point = delta >= PACK.peelTravelPx ? commands.project(event.clientX, event.clientY) : null
      const preview = selected === undefined || point === null ? null : { stickerId: selected.id, surface: 'back' as const, ...point, width: PACK.placementWidth, rotationDeg: 0 }
      updateStickerInteraction({ peel: Math.min(1, Math.max(0, delta / PACK.peelTravelPx)), stage: preview !== null && isStickerPlacement(preview) ? 'placing' : 'peeling' })
      // The renderer consumes the same rear projection and deformation as placement persistence.
      if (preview !== null && isStickerPlacement(preview)) {
        const wasPlacing = deviceStore.get(stickerInteractionAtom).previewPlacement !== null
        updateStickerInteraction({ previewPlacement: preview })
        if (!wasPlacing) animateStickerValue('landing', { position: 0, velocity: 0, target: 0.97 }, reducedMotion, () => {})
      }
      else updateStickerInteraction({ previewPlacement: null, landing: 0 })
    }
  }
  const end = (event: ReactPointerEvent<HTMLButtonElement>, cancelled = false): void => {
    const pointer = deviceStore.get(pointerAtom)
    if (pointer === null || pointer.pointerId !== event.pointerId) return
    event.stopPropagation(); deviceStore.set(pointerAtom, null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    captureTarget.current = null
    if (cancelled) {
      supersedeStickerInteraction()
      if (pointer.kind === 'pull') cancelStickerInteraction()
      else updateStickerInteraction({ stage: 'open', progress: 1, peel: 0, previewPlacement: null, landing: 0 })
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
        run(async (isCurrent) => { await commands.place(placement); if (!isCurrent()) return; updateStickerInteraction({ previewPlacement: placement, landing: 1 }); animateStickerValue('peel', { position: current.peel, velocity: 0, target: 0 }, reducedMotion, () => { updateStickerInteraction({ stage: 'open', selectedStickerId: null, peel: 0, previewPlacement: null, landing: 0 }); deviceStore.set(collectionMessageAtom, `${getSticker(placement.stickerId)?.name ?? 'Sticker'} stuck to your iPod.`) }) })
      } else animateStickerValue('peel', { position: current.peel, velocity: 0, target: 0 }, reducedMotion, () => updateStickerInteraction({ stage: 'open' }))
    }
  }
  const select = (id: string): void => { admitIntent(); updateStickerInteraction({ selectedStickerId: id, stage: 'open', peel: 0, previewPlacement: null, landing: 0 }) }
  const keyboardPlace = (): void => {
    if (selected === undefined) return
    const placement = deviceStore.get(stickerInteractionAtom).previewPlacement ?? { stickerId: selected.id, surface: 'back', x: 0.5, y: 0.5, width: PACK.placementWidth, rotationDeg: 0 }
    run(async (isCurrent) => { await commands.place(placement); if (!isCurrent()) return; updateStickerInteraction({ selectedStickerId: null, stage: 'open', peel: 0, previewPlacement: null, landing: 0 }); deviceStore.set(collectionMessageAtom, `${selected.name} stuck to your iPod.`); lip.current?.focus() })
  }
  if (!rear || compositeTier.tier !== 'T1') return null
  return (
    <div ref={host} className="pointer-events-none absolute inset-0 z-20" data-sticker-stage={interaction.stage} data-sticker-progress={interaction.progress} data-sticker-peel={interaction.peel} data-sticker-landing={interaction.landing} onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); close() } }}>
      <div className="pointer-events-auto absolute left-1/2 w-1/2 max-w-60 -translate-x-1/2" style={{ bottom: PACK.bottomGapPx, aspectRatio: `1 / ${PACK.heightRatio}`, transform: `translateY(calc((100% + ${PACK.bottomGapPx - PACK.teasePx}px) * ${1 - interaction.progress}))` }}>
        <button ref={lip} type="button" className="absolute -top-3 left-0 min-h-11 w-full touch-none rounded-sm text-xs font-semibold tracking-wide text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-900" aria-label="Pull sticker pack into view" aria-expanded={expanded} onPointerDown={(event) => begin(event, 'pull')} onPointerMove={move} onPointerUp={(event) => end(event)} onPointerCancel={(event) => end(event, true)} onLostPointerCapture={(event) => end(event, true)} onClick={(event) => { if (event.detail === 0) { admitIntent(); revealStickerPack(reducedMotion) } }}>
          {expanded ? 'PLAYWORN' : inventory?.packs.some((item) => item.openedAt === null) ? 'A pack for your listening ↑' : 'Your listening, collected ↑'}
        </button>
        {expanded ? <div className="absolute inset-x-0 top-10 flex flex-col items-center gap-2 px-4 text-center text-xs text-stone-900">
          {status === 'signed-out' ? <p>Connect Apple Music to earn your first stickers.</p> : status === 'loading' ? <p>Finding your listening’s first stickers…</p> : status === 'error' ? <><p>Your collection could not load.</p><button className={buttonClass} type="button" onClick={() => run(commands.retry)}>Try again</button></> : pack === undefined ? <p>Keep listening in webPod. Your first pack is on its way.</p> : pack.openedAt === null ? <><p>{pack.stickerIds.length} stickers, picked from your listening.</p><button type="button" className={buttonClass} onClick={() => run(async (isCurrent) => { await commands.openPack(pack.id); if (isCurrent()) select(pack.stickerIds[0] ?? '') })}>Open earned pack</button></> : selected === undefined ? <p>Pick a sticker above to peel it.</p> : <>
            <button type="button" className="min-h-20 w-full touch-none rounded-sm bg-transparent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-900" aria-label={`Peel ${selected.name} and drag onto the iPod. Arrow keys position, Enter sticks.`} onPointerDown={(event) => begin(event, 'peel')} onPointerMove={move} onPointerUp={(event) => end(event)} onPointerCancel={(event) => end(event, true)} onLostPointerCapture={(event) => end(event, true)} onKeyDown={(event) => {
              const offset = event.key === 'ArrowLeft' ? [-0.04, 0] : event.key === 'ArrowRight' ? [0.04, 0] : event.key === 'ArrowUp' ? [0, -0.04] : event.key === 'ArrowDown' ? [0, 0.04] : null
              if (offset === null) return
              event.preventDefault()
              const current = deviceStore.get(stickerInteractionAtom).previewPlacement ?? { stickerId: selected.id, surface: 'back' as const, x: 0.5, y: 0.5, width: PACK.placementWidth, rotationDeg: 0 }
              const next = { ...current, x: current.x + (offset[0] ?? 0), y: current.y + (offset[1] ?? 0) }
              if (isStickerPlacement(next)) { admitIntent(); updateStickerInteraction({ previewPlacement: next, landing: 1, peel: 0, stage: 'placing' }) }
            }} onClick={(event) => { if (event.detail === 0) keyboardPlace() }}><span className="sr-only">Peel {selected.name}</span></button>
          </>}
        </div> : null}
      </div>
      {expanded ? <div className="pointer-events-auto absolute inset-x-4 mx-auto flex max-w-lg items-center gap-2 overflow-x-auto rounded-lg bg-stone-100 p-2 text-xs text-stone-900" style={{ bottom: 'calc(min(210px, 43.75vw) + 32px)' }}>
        {inventory?.stickerIds.filter((id) => inventory.packs.some((item) => item.openedAt !== null && item.stickerIds.includes(id))).map((id) => { const art = getSticker(id); return art === undefined ? null : <button type="button" key={id} className={`${buttonClass} ${selected?.id === id ? 'bg-stone-300' : ''}`} aria-pressed={selected?.id === id} onClick={() => select(id)}>{art.name}</button> })}
        {selected !== undefined && inventory?.placements.some((item) => item.stickerId === selected.id) ? <button type="button" className={buttonClass} onClick={() => run(() => commands.remove(selected.id))}>Remove {selected.name}</button> : null}
        {selected !== undefined ? <button type="button" className={buttonClass} onClick={keyboardPlace}>Stick {selected.name}</button> : null}
        <button type="button" className={buttonClass} onClick={close}>Put pack away</button>
      </div> : null}
      <p role="status" className="absolute inset-x-4 top-32 mx-auto w-fit max-w-[calc(100%-32px)] rounded-sm bg-stone-100 px-3 text-center text-xs text-stone-900">{message}</p>
      {artworkFailure === null ? <StickerImportStatus status={inventory?.importStatus} retry={() => run(commands.retry)} /> : null}
      {artworkFailure === null ? null : <p role="alert" className="pointer-events-auto absolute inset-x-4 top-20 mx-auto max-w-md rounded-md bg-stone-100 p-3 text-sm text-stone-900">A sticker image could not load. <button type="button" className={buttonClass} onClick={() => { retryStickerArtwork() }}>Retry artwork</button></p>}
    </div>
  )
}

const buttonClass = 'min-h-11 shrink-0 rounded-md px-3 py-2 font-medium hover:bg-stone-200 active:bg-stone-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:opacity-50'
const sample = (event: ReactPointerEvent): PointerMotionSample => ({ clientX: event.clientX, clientY: event.clientY, timestampMs: event.timeStamp })

/** Sampling is a successful bounded import; only an actual failed import offers retry. */
export function StickerImportStatus({ status, retry }: { readonly status: StickerInventory['importStatus'] | undefined; readonly retry: () => void }) {
  if (status !== 'partial' && status !== 'failed') return null
  return <p role="status" className="pointer-events-auto absolute inset-x-4 top-20 mx-auto max-w-md rounded-md bg-stone-100 p-3 text-sm text-stone-900">
    {status === 'partial' ? 'We synced a sample of your Apple Music library. Keep listening in webPod to earn more.' : <>Some Apple Music data could not sync. Your earned stickers are safe. <button type="button" className={buttonClass} onClick={retry}>Retry sync</button></>}
  </p>
}
