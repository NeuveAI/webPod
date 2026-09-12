import { setStickerPackTucked, stickerPackTuckAtom, stickerPackTuckedAtom } from './sticker-pack-tuck'
import { atom } from 'jotai'
import { deviceStore, stickerCollectionStatusAtom, stickerInteractionAtom, stickerInventoryAtom } from '@webpod/state'
import { getSticker, STICKER_CATALOGUE, stickerWear, isStickerPlacement, type StickerPlacement } from '@webpod/stickers'
import type { StickerToolControls } from '@webpod/tools'
import { activeStickerCollectionAtom, requestedStickerCollectionAtom, stickerCollectionsAtom, stickerCollectionUsableAtom, stickerPreparationIdsAtom, stickerPreparedIdsAtom, stickerSheetRevealAtom, stickerPlacementForIntent, stickerCollectionTransitionAtom, stickerPackTurnAtom, stickerClaimStateAtom } from './sticker-collections-model'
import { animateStickerValue, cancelStickerInteraction, getStickerInteractionGeneration, resetStickerCarry, supersedeStickerInteraction, updateStickerInteraction, stickerArtworkFailureAtom } from './sticker-interaction'
import { constrainedStickerEdit, dismissStickerEditor, sameStickerPose, stickerEditPending, stickerEditorPendingAtom, stickerToolEditorPropertyAtom } from './sticker-editor-model'

/** Narrow live seam to the same mounted handlers used by the physical overlay. */
export interface StickerUiActions {
  readonly rear: () => boolean
  readonly humanBusy: () => boolean
  readonly reducedMotion: () => boolean
  readonly open: (signal: AbortSignal) => Promise<void>
  readonly close: () => void
  readonly navigate: (direction: number) => void
  readonly lift: (source: StickerPlacement) => void
  readonly place: (placement: StickerPlacement, expectedSource?: StickerPlacement) => Promise<void>
}
const stickerOperationAtom = atom<{ readonly startedAtMs: number; readonly completedAtMs: number | null; readonly error: string | null; readonly saving: boolean } | null>(null)
const stickerSaveAtom = atom<{ readonly placement: StickerPlacement; readonly startedAtMs: number } | null>(null)
let mounted: StickerToolControls | null = null
let mountedActions: (() => StickerUiActions) | null = null
/** Tools are global but require exactly one mounted production collection owner. */
export function getStickerToolControls(): StickerToolControls {
  if (mounted === null) throw new Error('Sticker controls are not mounted.')
  return mounted
}
/** Read real preparation counts; unknown operation starts and progress remain null. */
export function readStickerPageState() {
  const operation = deviceStore.get(stickerOperationAtom)
  const save = deviceStore.get(stickerSaveAtom)
  const pendingSaves = Object.keys(deviceStore.get(stickerEditorPendingAtom)).length
  const ids = deviceStore.get(stickerPreparationIdsAtom), prepared = deviceStore.get(stickerPreparedIdsAtom)
  const loadedItems = ids.filter(id => prepared.includes(id)).length
  const claims = deviceStore.get(stickerClaimStateAtom)
  const collectionStatus = deviceStore.get(stickerCollectionStatusAtom)
  const usable = deviceStore.get(stickerCollectionUsableAtom)
  const interaction = deviceStore.get(stickerInteractionAtom)
  const preparing = loadedItems < ids.length
  const sheet = deviceStore.get(stickerSheetRevealAtom)
  const animating = sheet > 0 && sheet < .99 || deviceStore.get(stickerPackTurnAtom) !== 0 || deviceStore.get(stickerCollectionTransitionAtom) !== null || interaction.stage === 'pulling' || interaction.stage === 'settling'
  const rearReady = mountedActions?.().rear() ?? false
  const humanBusy = mountedActions?.().humanBusy() ?? false
  const unavailable = mounted === null || deviceStore.get(stickerInventoryAtom) === null || !rearReady
  const error = deviceStore.get(stickerArtworkFailureAtom) ?? operation?.error ?? claims.error ?? null
  const status = claims.pending > 0 || pendingSaves > 0 ? 'saving' : unavailable ? 'unavailable' : error !== null || collectionStatus === 'error' ? 'error' : operation?.saving ? 'saving' : preparing ? 'loading' : animating ? 'animating' : usable ? 'ready' : 'unavailable'
  return { status, pendingCollection: deviceStore.get(stickerCollectionTransitionAtom), interactionReady: status === 'ready' && !humanBusy, pendingSaves, rearReady, humanBusy, collectionStatus, loadedItems, totalItems: ids.length, progressPercent: ids.length === 0 ? null : loadedItems / ids.length * 100, startedAtMs: save?.startedAtMs ?? operation?.startedAtMs ?? null, elapsedMs: save !== null ? Date.now() - save.startedAtMs : operation === null ? null : (operation.completedAtMs ?? Date.now()) - operation.startedAtMs, stage: interaction.stage, packOpen: interaction.progress > .9 && !deviceStore.get(stickerPackTuckedAtom), sheetOpen: deviceStore.get(stickerSheetRevealAtom) > .98 && !deviceStore.get(stickerPackTuckedAtom), packClosing: deviceStore.get(stickerPackTuckedAtom) && deviceStore.get(stickerPackTuckAtom) < .99 }
}
/** Full catalogue status includes untouched genres and never infers ownership. */
export function readStickerList() {
  const inventory = deviceStore.get(stickerInventoryAtom)
  const collections = deviceStore.get(stickerCollectionsAtom)
  const requested = deviceStore.get(requestedStickerCollectionAtom)
  const held = deviceStore.get(stickerInteractionAtom)
  const items = STICKER_CATALOGUE.map(art => {
    const owned = inventory?.stickerIds.includes(art.id) ?? false
    const placement = inventory?.placements.find(item => item.stickerId === art.id) ?? null
    const opened = inventory?.packs.some(pack => pack.openedAt !== null && pack.stickerIds.includes(art.id)) ?? false
    const slot = collections.flatMap(collection => collection.slots).find(slot => slot.art.id === art.id)
    return { id: art.id, name: art.name, collection: art.collection, genre: art.genre, artworkUrl: art.url, owned, claimable: owned && !opened && inventory?.packs.some(pack => pack.openedAt === null && pack.stickerIds.includes(art.id)) === true, available: owned && (placement !== null || opened), state: !owned ? 'locked' : placement !== null ? 'placed' : opened ? 'earned' : 'sealed', placement, scale: placement?.width ?? null, wear: placement?.wear ?? stickerWear(inventory ?? {}, art.id), meaning: slot?.meaning ?? null, remainingMinutes: owned ? 0 : slot?.remainingMinutes ?? null }
  })
  const active = deviceStore.get(activeStickerCollectionAtom)
  return { count: items.length, items, availabilityMeaning: 'available means earned and unsealed or placed; collection grabs also require the current prepared open sheet. For claimable sealed stickers, navigate to their genre and call webpod_open_sticker_pack.', activeCollection: active === null ? null : { genre: active.genre, index: collections.findIndex(item => item.genre === active.genre) }, selectedCollection: requested === null ? null : { genre: requested.genre, index: collections.findIndex(item => item.genre === requested.genre) }, held: held.selectedStickerId === null || held.previewPlacement === null && held.sourcePlacement == null && held.peel === 0 && held.stage === 'open' ? null : { stickerId: held.selectedStickerId, source: held.sourcePlacement == null ? 'collection' : 'placed', placement: held.previewPlacement, origin: held.sourcePlacement ?? null, scale: held.previewPlacement?.width ?? held.sourcePlacement?.width ?? null, wear: held.previewPlacement?.wear ?? held.sourcePlacement?.wear ?? stickerWear(inventory ?? {}, held.selectedStickerId) }, pageState: readStickerPageState() }
}

/** Mounts shared sticker actions. Saved inventory remains authoritative through aborts,
 * superseding human gestures, frontend teardown and failed asynchronous writes. */
export function mountStickerToolControls(actions: () => StickerUiActions, options: { readonly saveTimeoutMs?: number } = {}): () => void {
  if (mounted !== null) throw new Error('Sticker controls already mounted.')
  let disposed = false
  let saving = false
  let heldGeneration: number | null = null
  let inventoryAtGrab = deviceStore.get(stickerInventoryAtom)
  const begin = () => deviceStore.set(stickerOperationAtom, { startedAtMs: Date.now(), completedAtMs: null, error: null, saving: false })
  const complete = (error: string | null = null) => { if (!disposed) deviceStore.set(stickerOperationAtom, current => current === null ? null : { ...current, completedAtMs: Date.now(), saving: false, error }) }
  const requireUi = (signal: AbortSignal, prepared = false) => {
    signal.throwIfAborted()
    if (disposed) throw new Error('Sticker controls have unmounted. Read webpod_page_state before retrying.')
    if (deviceStore.get(stickerInventoryAtom) === null) throw new Error('Sticker inventory has not loaded. Read webpod_page_state before retrying.')
    if (!actions().rear()) throw new Error('The rendered back face is not ready for sticker interaction. Read webpod_device_state and stickers.pageState.rearReady. If visibleFace is already back, repeating flicks will not establish readiness; the rendered device and orientation state may be out of sync.')
    if (saving || deviceStore.get(stickerClaimStateAtom).pending > 0 || Object.keys(deviceStore.get(stickerEditorPendingAtom)).length > 0 || actions().humanBusy()) throw new Error('A sticker gesture or save is running.')
    if (prepared && deviceStore.get(stickerCollectionTransitionAtom) !== null) throw new Error('The collection is still turning. Wait for webpod_page_state stickers readiness before opening or grabbing.')
    if (prepared && deviceStore.get(activeStickerCollectionAtom)?.genre !== deviceStore.get(requestedStickerCollectionAtom)?.genre) throw new Error('The requested collection is still turning or preparing. Read webpod_page_state until activeCollection matches selectedCollection in webpod_sticker_list.')
    if (prepared && !deviceStore.get(stickerCollectionUsableAtom)) throw new Error('The current sticker sheet is still preparing. Read page state.')
  }
  const clearHeld = () => { heldGeneration = null; resetStickerCarry() }
  const requireHeld = (signal: AbortSignal) => {
    requireUi(signal)
    const held = deviceStore.get(stickerInteractionAtom)
    if (heldGeneration === null || heldGeneration !== getStickerInteractionGeneration() || inventoryAtGrab !== deviceStore.get(stickerInventoryAtom) || held.selectedStickerId === null || held.previewPlacement === null) throw new Error('No current agent-held sticker. Grab an available sticker again.')
    if (stickerEditPending(held.selectedStickerId)) throw new Error('This sticker already has a pending save.')
    return held.previewPlacement
  }
  const controls: StickerToolControls = {
    list: readStickerList,
    open: async signal => {
      requireUi(signal, true); begin(); heldGeneration = null; saving = true
      deviceStore.set(stickerOperationAtom, current => current === null ? null : { ...current, saving: true })
      try { await actions().open(signal); signal.throwIfAborted(); if (disposed) throw new Error('Sticker controls have unmounted.'); complete(); return readStickerList() }
      catch (error) { complete(error instanceof Error ? error.message : 'Earned packs could not open. Retry webpod_open_sticker_pack.'); throw error }
      finally { saving = false }
    },
    close: async signal => { requireUi(signal); actions().close(); begin(); heldGeneration = null; if (deviceStore.get(stickerInteractionAtom).stage !== 'pulling') complete(); return readStickerList() },
    navigate: async (direction, signal) => { requireUi(signal, true); actions().navigate(direction === 'next' ? 1 : -1); begin(); heldGeneration = null; inspectPreparation(); return readStickerList() },
    grab: async (id, source, signal) => {
      requireUi(signal, source === 'collection')
      const inventory = deviceStore.get(stickerInventoryAtom), art = getSticker(id)
      if (art === undefined || inventory === null || !inventory.stickerIds.includes(art.id)) throw new Error(art === undefined ? 'Unknown sticker identifier. Call webpod_sticker_list and use an exact item id; do not substitute another sticker without user authorization.' : 'This sticker is locked. Listen to earn it; opening a pack cannot unlock unearned stickers.')
      if (readStickerList().held !== null) throw new Error('Release the held sticker before grabbing another.')
      if (stickerEditPending(id)) throw new Error('This sticker already has a pending save.')
      const saved = inventory.placements.find(item => item.stickerId === id)
      const slot = deviceStore.get(activeStickerCollectionAtom)?.slots.find(item => item.art.id === id)
      if (source === 'placed' ? saved === undefined : saved !== undefined || slot?.state !== 'earned' || deviceStore.get(stickerPackTuckedAtom) || deviceStore.get(stickerInteractionAtom).progress < .99 || deviceStore.get(stickerSheetRevealAtom) < .99 || deviceStore.get(stickerPackTurnAtom) !== 0) throw new Error('Sticker is not available at that source. For collection source, navigate to its genre, call webpod_open_sticker_pack to open already-earned sealed packs, then wait for pageState readiness. Placed stickers require source placed.')
      begin(); dismissStickerEditor()
      if (saved !== undefined) actions().lift(saved)
      else { supersedeStickerInteraction(); resetStickerCarry(); deviceStore.set(stickerSheetRevealAtom, 1) }
      const draft = { ...stickerPlacementForIntent(art.id, saved ?? null, .25), wear: saved?.wear ?? stickerWear(inventory, id) }
      updateStickerInteraction({ selectedStickerId: art.id, sourcePlacement: saved ?? null, previewPlacement: draft, landing: .97, peel: .75, stage: 'placing' })
      heldGeneration = getStickerInteractionGeneration(); inventoryAtGrab = inventory
      deviceStore.set(stickerToolEditorPropertyAtom, 'rotationDeg')
      setStickerPackTucked(true)
      complete(); return readStickerList()
    },
    release: async signal => { requireHeld(signal); begin(); supersedeStickerInteraction(); clearHeld(); updateStickerInteraction({ stage: deviceStore.get(stickerInteractionAtom).progress > .9 ? 'open' : 'tease' }); complete(); return readStickerList() },
    rotate: async (degrees, signal) => {
      const draft = requireHeld(signal); begin()
      deviceStore.set(stickerToolEditorPropertyAtom, 'rotationDeg')
      const next = constrainedStickerEdit(draft, 'rotationDeg', draft.rotationDeg + degrees)
      updateStickerInteraction({ previewPlacement: next }); complete()
      return { ...readStickerList(), requestedDegrees: degrees, appliedDegrees: next.rotationDeg - draft.rotationDeg }
    },
    wear: async (amount, signal) => {
      const draft = requireHeld(signal); begin()
      const next = constrainedStickerEdit(draft, 'wear', (draft.wear ?? 0) + amount)
      updateStickerInteraction({ previewPlacement: next }); complete()
      return { ...readStickerList(), requestedAmount: amount, appliedAmount: (next.wear ?? 0) - (draft.wear ?? 0) }
    },
    scale: async (percent, signal) => {
      const draft = requireHeld(signal); begin()
      deviceStore.set(stickerToolEditorPropertyAtom, 'width')
      const next = constrainedStickerEdit(draft, 'width', draft.width * (1 + percent / 100))
      updateStickerInteraction({ previewPlacement: next }); complete()
      return { ...readStickerList(), requestedPercent: percent, appliedPercent: (next.width / draft.width - 1) * 100 }
    },
    place: async (x, y, signal) => {
      const draft = requireHeld(signal), placement = { ...draft, x, y }
      if (!isStickerPlacement(placement)) throw new TypeError('The requested center is outside the current rear placement silhouette.')
      const origin = deviceStore.get(stickerInteractionAtom).sourcePlacement ?? undefined
      const generation = getStickerInteractionGeneration()
      begin(); saving = true
      const saveLease = { placement, startedAtMs: Date.now() }
      deviceStore.set(stickerSaveAtom, saveLease)
      deviceStore.set(stickerOperationAtom, current => current === null ? null : { ...current, saving: true })
      deviceStore.set(stickerEditorPendingAtom, pending => ({ ...pending, [placement.stickerId]: placement }))
      updateStickerInteraction({ previewPlacement: placement, stage: 'settling' })
      const isCurrent = () => !disposed && generation === getStickerInteractionGeneration() && heldGeneration === generation
      const abort = () => { if (isCurrent()) { supersedeStickerInteraction(); clearHeld(); updateStickerInteraction({ stage: actions().rear() ? 'open' : 'hidden' }) } }
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) abort()
      // Keep a physical save lease until the real write settles, even if the tool caller leaves.
      const work = (async () => {
        try {
          signal.throwIfAborted()
          if (!isCurrent() || !actions().rear()) throw new Error('Sticker save interrupted before persistence.')
          await actions().place(placement, origin)
          const saved = deviceStore.get(stickerInventoryAtom)?.placements.find(item => item.stickerId === placement.stickerId)
          if (saved === undefined || !sameStickerPose(saved, placement)) throw new Error('Placement did not reconcile to the requested saved pose.')
          if (isCurrent()) {
            heldGeneration = null
            animateStickerValue('landing', { position: deviceStore.get(stickerInteractionAtom).landing, velocity: 0, target: 1 }, actions().reducedMotion(), () => {
              animateStickerValue('peel', { position: deviceStore.get(stickerInteractionAtom).peel, velocity: 0, target: 0 }, actions().reducedMotion(), () => { resetStickerCarry(); updateStickerInteraction({ stage: 'open' }) })
            })
          }
          complete(); return { ...readStickerList(), placement: saved }
        } catch (error) {
          if (isCurrent()) {
            const inventory = deviceStore.get(stickerInventoryAtom)
            const saved = inventory?.placements.find(item => item.stickerId === placement.stickerId)
            const sourceValid = origin === undefined ? saved === undefined : saved !== undefined && sameStickerPose(saved, origin)
            if (inventory !== null && sourceValid) { inventoryAtGrab = inventory; updateStickerInteraction({ stage: 'placing' }) }
            else { supersedeStickerInteraction(); clearHeld(); updateStickerInteraction({ stage: 'open' }) }
          }
          if (!disposed) complete('Placement failed. Read sticker status and retry or grab again.')
          throw error
        } finally {
          saving = false
          if (deviceStore.get(stickerSaveAtom) === saveLease) deviceStore.set(stickerSaveAtom, null)
          signal.removeEventListener('abort', abort)
          if (deviceStore.get(stickerEditorPendingAtom)[placement.stickerId] === placement) deviceStore.set(stickerEditorPendingAtom, pending => { const next = { ...pending }; delete next[placement.stickerId]; return next })
        }
      })()
      return await boundedStickerWrite(work, signal, options.saveTimeoutMs ?? 30_000)
    },
  }
  mounted = controls
  mountedActions = actions
  const stopInteraction = deviceStore.sub(stickerInteractionAtom, () => {
    if (heldGeneration !== null && heldGeneration !== getStickerInteractionGeneration()) heldGeneration = null
    const operation = deviceStore.get(stickerOperationAtom), interaction = deviceStore.get(stickerInteractionAtom)
    if (operation !== null && operation.completedAtMs === null && !operation.saving && interaction.stage !== 'pulling' && interaction.stage !== 'settling' && !['loading', 'animating'].includes(readStickerPageState().status)) complete()
  })
  const inspectPreparation = () => {
    const state = readStickerPageState()
    if (state.status === 'ready' && deviceStore.get(stickerOperationAtom)?.completedAtMs === null) complete()
  }
  const stopPrepared = deviceStore.sub(stickerPreparedIdsAtom, inspectPreparation)
  const stopInventory = deviceStore.sub(stickerInventoryAtom, () => {
    if (saving || heldGeneration === null || inventoryAtGrab === deviceStore.get(stickerInventoryAtom)) return
    const inventory = deviceStore.get(stickerInventoryAtom), held = deviceStore.get(stickerInteractionAtom)
    const id = held.selectedStickerId, art = id === null ? undefined : getSticker(id)
    const saved = inventory?.placements.find(item => item.stickerId === id)
    const origin = held.sourcePlacement
    const valid = inventory !== null && art !== undefined && inventory.stickerIds.includes(art.id)
      && (origin == null ? saved === undefined && inventory.packs.some(pack => pack.openedAt !== null && pack.stickerIds.includes(art.id)) && stickerWear(inventory, art.id) === stickerWear(inventoryAtGrab ?? {}, art.id) : saved !== undefined && sameStickerPose(origin, saved))
    if (valid) { inventoryAtGrab = inventory; return }
    supersedeStickerInteraction(); clearHeld()
  })
  return () => { disposed = true; stopInteraction(); stopInventory(); stopPrepared(); if (mounted === controls) { mounted = null; mountedActions = null }; if (heldGeneration !== null) { cancelStickerInteraction(); heldGeneration = null }; deviceStore.set(stickerOperationAtom, null) }
}
/** Caller waits at most thirty seconds; the underlying persistence lease remains live. */
function boundedStickerWrite(work: Promise<object>, signal: AbortSignal, timeoutMs: number): Promise<object> {
  return new Promise((resolve, reject) => {
    const finish = (error: unknown, value?: object) => { clearTimeout(timer); signal.removeEventListener('abort', abort); if (error !== undefined) reject(error); else resolve(value ?? {}) }
    const abort = () => finish(signal.reason)
    const timer = setTimeout(() => finish(new Error('Sticker save is still pending. Read page state; do not assume it failed.')), timeoutMs)
    signal.addEventListener('abort', abort, { once: true })
    void work.then(value => finish(undefined, value), error => finish(error))
    if (signal.aborted) abort()
  })
}
