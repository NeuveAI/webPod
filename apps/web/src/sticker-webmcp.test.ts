import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { deviceStore, receiveStickerInventoryActionAtom, resetStickerCollectionActionAtom, stickerInteractionAtom, stickerInventoryAtom } from '@webpod/state'
import { STICKER_GENRES, type StickerInventory, type StickerPlacement } from '@webpod/stickers'
import { getStickerToolControls, mountStickerToolControls, readStickerList, readStickerPageState, type StickerUiActions } from './sticker-webmcp'
import { activeStickerCollectionAtom, selectedStickerGenreAtom, stickerPreparedIdsAtom } from './sticker-collections-model'
import { cancelStickerInteraction, revealStickerPack, setStickerRearVisible, supersedeStickerInteraction, updateStickerInteraction } from './sticker-interaction'
import { stickerEditorPendingAtom } from './sticker-editor-model'
import { createDeviceStateTool } from './device-state-webmcp'
import { createDevicePreviewStore } from './device-preview-orientation'

const original: StickerPlacement = { stickerId: 'PW-B01', surface: 'back', x: .4, y: .6, width: .2, rotationDeg: 17, wear: .3 }
const seed = (): StickerInventory => ({ stickerIds: ['PW-A01', 'PW-B01', 'PW-C01'], packs: [{ id: 'opened', source: 'starter', stickerIds: ['PW-A01', 'PW-B01'], earnedAt: 1, openedAt: 2 }, { id: 'sealed', source: 'listening', stickerIds: ['PW-C01'], earnedAt: 1, openedAt: null }], progress: STICKER_GENRES.map(genre => ({ genre, listenedMs: 0, nextThresholdMs: 300000 })), placements: [original], placementRevision: 0, importStatus: 'complete' })
let dispose: (() => void) | undefined
let saved: StickerPlacement[] = [], expected: (StickerPlacement | undefined)[] = []
let rear = true, human = false
let persist: StickerUiActions['place']
const signal = () => new AbortController().signal
function inventory(): StickerInventory { const value = deviceStore.get(stickerInventoryAtom); if (value === null) throw new Error('Missing fixture'); return value }
function prepare() { const ids = deviceStore.get(activeStickerCollectionAtom)?.slots.map(slot => slot.art.id) ?? []; deviceStore.set(stickerPreparedIdsAtom, ids) }
function mount(saveTimeoutMs?: number) {
  dispose = mountStickerToolControls(() => ({ rear: () => rear, humanBusy: () => human, reducedMotion: () => true, open: () => revealStickerPack(true), close: () => cancelStickerInteraction(), navigate: direction => { supersedeStickerInteraction(); deviceStore.set(selectedStickerGenreAtom, direction === 1 ? 'pop' : 'metal'); prepare() }, lift: source => { supersedeStickerInteraction(); updateStickerInteraction({ sourcePlacement: source, selectedStickerId: source.stickerId, stage: 'peeling' }) }, place: persist }), saveTimeoutMs === undefined ? {} : { saveTimeoutMs })
  return getStickerToolControls()
}
beforeEach(() => {
  saved = []; expected = []; rear = true; human = false
  deviceStore.set(resetStickerCollectionActionAtom); deviceStore.set(receiveStickerInventoryActionAtom, seed()); deviceStore.set(selectedStickerGenreAtom, 'metal'); deviceStore.set(stickerEditorPendingAtom, {})
  prepare(); setStickerRearVisible(true)
  persist = async (placement, source) => { saved.push(placement); expected.push(source); deviceStore.set(receiveStickerInventoryActionAtom, { ...inventory(), placements: [...inventory().placements.filter(item => item.stickerId !== placement.stickerId), placement], placementRevision: inventory().placementRevision + 1 }) }
})
afterEach(() => { dispose?.(); dispose = undefined; setStickerRearVisible(false); deviceStore.set(resetStickerCollectionActionAtom) })

describe('mounted sticker adapter shared state and persistence', () => {
  test('device state exposes a rendered rear mismatch and rejected sticker calls remain recoverable', async () => {
    const controls = mount()
    const preview = createDevicePreviewStore()
    preview.setPose('rear')
    rear = false
    const definition = createDeviceStateTool(() => ({ read: preview.getSnapshot, isActive: () => false, isAnimating: () => false }))
    expect(await definition.execute({}, { signal: signal() })).toMatchObject({
      visibleFace: 'back',
      stickers: { inventoryLoaded: true, pageState: { rearReady: false, interactionReady: false } },
    })
    await expect(controls.open(signal())).rejects.toThrow('rendered back face is not ready')
    rear = true
    await controls.open(signal())
    expect(await definition.execute({}, { signal: signal() })).toMatchObject({
      stickers: { pageState: { rearReady: true, interactionReady: true } },
    })
    expect(saved).toEqual([])
  })
  test('device state reads live faces and saved placements without opening the sticker UI', async () => {
    const preview = createDevicePreviewStore()
    let moving = false
    const definition = createDeviceStateTool(() => ({ read: preview.getSnapshot, isActive: () => false, isAnimating: () => moving }))
    const read = () => definition.execute({}, { signal: signal() })
    const before = inventory()
    expect(definition.name).toBe('webpod_device_state')
    expect(definition.annotations.readOnlyHint).toBe(true)
    expect(await read()).toMatchObject({ visibleFace: 'front', isAnimating: false, stickers: { inventoryLoaded: true, placed: [{ id: original.stickerId, name: expect.any(String), placement: original }], held: null } })
    preview.setPose('rear')
    expect(await read()).toMatchObject({ visibleFace: 'back', pose: 'rear', orientation: { yawDeg: 180 } })
    moving = true
    preview.setOrientation({ pitchDeg: 15, yawDeg: 90, rollDeg: 5 })
    expect(await read()).toMatchObject({ visibleFace: 'edge', pose: 'custom', isAnimating: true, orientation: { pitchDeg: 15, yawDeg: 90, rollDeg: 5 } })
    expect(inventory()).toBe(before)
    expect(saved).toEqual([])
    await expect(definition.execute({ rotate: true }, { signal: signal() })).rejects.toThrow('Unknown input field')
    deviceStore.set(resetStickerCollectionActionAtom)
    expect(await read()).toMatchObject({ stickers: { inventoryLoaded: false, placed: null } })
    deviceStore.set(receiveStickerInventoryActionAtom, { ...seed(), placements: [] })
    expect(await read()).toMatchObject({ stickers: { inventoryLoaded: true, placed: [] } })
  })
  test('device state separates held edits from saved placement until persistence', async () => {
    const controls = mount()
    await controls.open(signal())
    await controls.grab(original.stickerId, 'placed', signal())
    await controls.rotate(20, signal())
    const preview = createDevicePreviewStore()
    preview.setPose('rear')
    const definition = createDeviceStateTool(() => ({ read: preview.getSnapshot, isActive: () => false, isAnimating: () => false }))
    expect(await definition.execute({}, { signal: signal() })).toMatchObject({ stickers: {
      placed: [{ placement: original }],
      held: { stickerId: original.stickerId, placement: { rotationDeg: original.rotationDeg + 20 }, origin: original },
    } })
    expect(saved).toEqual([])
  })
  test('device state and grab report comparable saved scale/wear and separate draft wear', async () => {
    const legacy = { stickerId: 'PW-A01' as const, surface: 'back' as const, x: .2, y: .3, width: .1, rotationDeg: 0 }
    deviceStore.set(receiveStickerInventoryActionAtom, { ...seed(), placements: [original, legacy], appearances: [{ stickerId: legacy.stickerId, wear: .8 }] })
    const preview = createDevicePreviewStore()
    const definition = createDeviceStateTool(() => ({ read: preview.getSnapshot, isActive: () => false, isAnimating: () => false }))
    const controls = mount()
    expect(await definition.execute({}, { signal: signal() })).toMatchObject({ stickers: { placed: [
      { id: 'PW-A01', scale: .1, wear: .8 }, { id: 'PW-B01', scale: .2, wear: .3 },
    ] } })
    expect(await controls.grab('PW-A01', 'placed', signal())).toMatchObject({
      items: expect.arrayContaining([expect.objectContaining({ id: 'PW-A01', scale: .1, wear: .8 })]),
      held: { stickerId: 'PW-A01', scale: .1, wear: .8, origin: legacy },
    })
    await controls.wear(.1, signal())
    expect(await definition.execute({}, { signal: signal() })).toMatchObject({ stickers: {
      placed: [{ id: 'PW-A01', scale: .1, wear: .8 }, { id: 'PW-B01', scale: .2, wear: .3 }],
      held: { scale: .1, wear: expect.closeTo(.9) },
    } })
    expect(saved).toEqual([])
  })
  test('legacy wear defaults to zero and unplaced stickers have no saved scale', () => {
    const { wear: _wear, ...legacy } = original
    void _wear
    deviceStore.set(receiveStickerInventoryActionAtom, { ...seed(), placements: [legacy] })
    expect(readStickerList().items.find(item => item.id === original.stickerId)).toMatchObject({ scale: .2, wear: 0 })
    expect(readStickerList().items.find(item => item.id === 'PW-A01')).toMatchObject({ scale: null, wear: 0 })
  })
  test('all catalogue statuses include locked/sealed/owned/placed and open UI never claims packs', async () => {
    const controls = mount(), before = inventory()
    await controls.open(signal())
    const list = readStickerList()
    expect(list.count).toBe(60)
    expect(list.items.find(item => item.id === 'PW-A01')).toMatchObject({ owned: true, available: true, state: 'earned' })
    expect(list.items.find(item => item.id === 'PW-B01')).toMatchObject({ state: 'placed', placement: original })
    expect(list.items.find(item => item.id === 'PW-C01')).toMatchObject({ owned: true, available: false, state: 'sealed' })
    expect(list.items.find(item => item.id === 'PW-A02')).toMatchObject({ owned: false, available: false, state: 'locked' })
    expect(inventory()).toBe(before)
    await expect(controls.grab('PW-C01', 'collection', signal())).rejects.toThrow()
    await expect(controls.grab('nope', 'placed', signal())).rejects.toThrow()
    expect(saved).toEqual([])
  })
  test('collection carry uses visible shared preview, clamps edits and release writes nothing', async () => {
    const controls = mount(); await controls.open(signal()); await controls.grab('PW-A01', 'collection', signal())
    expect(deviceStore.get(stickerInteractionAtom)).toMatchObject({ selectedStickerId: 'PW-A01', stage: 'placing', sourcePlacement: null })
    await controls.rotate(360, signal()); await controls.wear(1, signal()); await controls.wear(.5, signal())
    expect(deviceStore.get(stickerInteractionAtom).previewPlacement).toMatchObject({ rotationDeg: expect.closeTo(180, 3), wear: 1 })
    await controls.release(signal())
    expect(readStickerList().held).toBeNull(); expect(inventory().placements).toEqual([original]); expect(saved).toEqual([])
  })
  test('placed release restores exact origin; placement keeps all properties and passes expectedSource', async () => {
    const controls = mount(); await controls.grab('PW-B01', 'placed', signal()); await controls.rotate(20, signal()); await controls.wear(.2, signal()); await controls.release(signal())
    expect(inventory().placements).toEqual([original])
    await controls.grab('PW-B01', 'placed', signal()); await controls.rotate(10, signal()); await controls.place(.6, .4, signal())
    expect(expected).toEqual([original]); expect(saved[0]).toEqual({ ...original, x: .6, y: .4, rotationDeg: 27 })
    expect(readStickerList().held).toBeNull()
  })
  test('invalid physical silhouette is rejected; failed save retains draft and retry uses real command', async () => {
    const real = persist
    persist = async () => { throw new Error('network') }
    const controls = mount(); await controls.open(signal()); await controls.grab('PW-A01', 'collection', signal())
    await expect(controls.place(0, 0, signal())).rejects.toThrow('silhouette')
    await expect(controls.place(.6, .4, signal())).rejects.toThrow('network')
    expect(readStickerList().held?.placement).toMatchObject({ x: .6, y: .4 })
    persist = real; await controls.place(.6, .4, signal()); expect(saved).toHaveLength(1)
  })
  test('background inventory refresh keeps unchanged carry; lost ownership or origin invalidates', async () => {
    const controls = mount(); await controls.grab('PW-B01', 'placed', signal())
    deviceStore.set(receiveStickerInventoryActionAtom, { ...inventory(), progress: inventory().progress.map(row => ({ ...row, listenedMs: 1000 })) })
    await controls.rotate(5, signal())
    deviceStore.set(receiveStickerInventoryActionAtom, { ...inventory(), placements: [{ ...original, x: .7 }] })
    expect(readStickerList().held).toBeNull(); await expect(controls.release(signal())).rejects.toThrow()
  })
  test('passive human detail selection is not held and explicit grab supersedes it', async () => {
    const controls = mount(); await controls.open(signal())
    updateStickerInteraction({ selectedStickerId: 'PW-A01', previewPlacement: null, peel: 0, stage: 'open' })
    expect(readStickerList().held).toBeNull()
    await controls.grab('PW-A01', 'collection', signal()); expect(readStickerList().held?.stickerId).toBe('PW-A01')
    human = true; expect(readStickerPageState().interactionReady).toBe(false)
    human = false; rear = false; expect(readStickerPageState()).toMatchObject({ interactionReady: false, rearReady: false })
  })
  test('human takeover, face flip, aborted invocation and unmount prevent stale carry mutations', async () => {
    const controls = mount(); await controls.grab('PW-B01', 'placed', signal()); human = true
    await expect(controls.rotate(5, signal())).rejects.toThrow('gesture'); human = false
    supersedeStickerInteraction(); updateStickerInteraction({ selectedStickerId: null, sourcePlacement: null, previewPlacement: null })
    await expect(controls.rotate(5, signal())).rejects.toThrow('agent-held')
    await controls.grab('PW-B01', 'placed', signal()); setStickerRearVisible(false); rear = false
    await expect(controls.rotate(5, signal())).rejects.toThrow('back face')
    dispose?.(); dispose = undefined; expect(() => getStickerToolControls()).toThrow('not mounted')
  })
  test('abort synchronously during settling publication never admits persistence', async () => {
    const controls = mount(), abort = new AbortController(); await controls.grab('PW-B01', 'placed', signal())
    const stop = deviceStore.sub(stickerInteractionAtom, () => { if (deviceStore.get(stickerInteractionAtom).stage === 'settling') abort.abort() })
    try { await expect(controls.place(.5, .5, abort.signal)).rejects.toThrow(); expect(saved).toEqual([]); expect(readStickerList().held).toBeNull(); expect(deviceStore.get(stickerEditorPendingAtom)).toEqual({}) } finally { stop() }
  })
  test('abort after persistence admission preserves eventual saved inventory; late write cannot mutate remounted operation', async () => {
    const real = persist; let finish: (() => void) | undefined
    persist = async (placement, source) => { await new Promise<void>(resolve => { finish = resolve }); await real(placement, source) }
    const controls = mount(), abort = new AbortController(); await controls.grab('PW-B01', 'placed', signal())
    const pending = controls.place(.6, .5, abort.signal); expect(readStickerPageState().status).toBe('saving')
    abort.abort(); await expect(pending).rejects.toThrow(); expect(readStickerList().held).toBeNull()
    dispose?.(); dispose = undefined; mount(); expect(readStickerPageState()).toMatchObject({ status: 'saving', pendingSaves: 1 }); const remountedStart = readStickerPageState().startedAtMs
    finish?.(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(inventory().placements[0]).toMatchObject({ x: .6 }); expect(remountedStart).not.toBeNull(); expect(readStickerPageState()).toMatchObject({ status: 'ready', pendingSaves: 0, startedAtMs: null, elapsedMs: null })
  })
  test('bounded timeout keeps actual save pending until it really settles, including remount', async () => {
    const real = persist; let finish: (() => void) | undefined
    persist = async (placement, source) => { await new Promise<void>(resolve => { finish = resolve }); await real(placement, source) }
    const controls = mount(0); await controls.grab('PW-B01', 'placed', signal())
    await expect(controls.place(.6, .5, signal())).rejects.toThrow('still pending')
    expect(readStickerPageState()).toMatchObject({ status: 'saving', pendingSaves: 1 })
    dispose?.(); dispose = undefined; const replacement = mount()
    await expect(replacement.grab('PW-A01', 'collection', signal())).rejects.toThrow('save')
    finish?.(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(readStickerPageState().pendingSaves).toBe(0)
  })
  test('save rejects concurrent sticker changes and reports elapsed frozen on completion', async () => {
    const real = persist; let finish: (() => void) | undefined
    persist = async (placement, source) => { await new Promise<void>(resolve => { finish = resolve }); await real(placement, source) }
    const controls = mount(); await controls.grab('PW-B01', 'placed', signal())
    const pending = controls.place(.6, .5, signal())
    await expect(controls.close(signal())).rejects.toThrow('save'); expect(readStickerPageState().status).toBe('saving')
    finish?.(); await pending
    expect(readStickerPageState().elapsedMs).not.toBeNull(); const elapsed = readStickerPageState().elapsedMs
    expect(readStickerPageState().elapsedMs).toBe(elapsed)
  })
})
