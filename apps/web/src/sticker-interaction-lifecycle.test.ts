import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { deviceStore, receiveStickerInventoryActionAtom, resetStickerCollectionActionAtom, setStickerCollectionStatusActionAtom, stickerInteractionAtom } from '@webpod/state'
import { captureStickerCarryAnchor, mountStickerCarryAnchorLifecycle, stickerCarryAnchorAtom, stickerSourceAnchorAtom, stickerSourcePullAtom, updateStickerSourcePull } from './sticker-carry-anchor'
import { publishOwnedStickerPull } from './sticker-grab'
import { STICKER_GENRES } from '@webpod/stickers'
import { animateStickerValue, getStickerInteractionGeneration, cancelStickerInteraction, resetStickerCarry, returnStickerToSheet, setStickerRearVisible, supersedeStickerInteraction, updateHeldStickerPreview, updateStickerInteraction } from './sticker-interaction'
import { activeStickerCollectionAtom, stickerPreparedIdsAtom, stickerDragOffsetAtom } from './sticker-collections-model'

const frames = new Map<number, FrameRequestCallback>()
let sequence = 0
const oldRequest = globalThis.requestAnimationFrame, oldCancel = globalThis.cancelAnimationFrame
beforeEach(() => {
  globalThis.requestAnimationFrame = callback => { const id = ++sequence; frames.set(id, callback); return id }
  globalThis.cancelAnimationFrame = id => { frames.delete(id) }
  deviceStore.set(receiveStickerInventoryActionAtom, { stickerIds: ['PW-A01'], packs: [{ id: 'one', source: 'starter', stickerIds: ['PW-A01'], earnedAt: 0, openedAt: 1 }], progress: STICKER_GENRES.map(genre => ({ genre, listenedMs: 0, nextThresholdMs: null })), placements: [], placementRevision: 0, importStatus: 'complete' })
  deviceStore.set(stickerPreparedIdsAtom, deviceStore.get(activeStickerCollectionAtom)?.slots.map(slot => slot.art.id) ?? [])
  setStickerRearVisible(true)
})
afterEach(() => { cancelStickerInteraction(); setStickerRearVisible(false); deviceStore.set(resetStickerCollectionActionAtom); frames.clear(); globalThis.requestAnimationFrame = oldRequest; globalThis.cancelAnimationFrame = oldCancel })
describe('shared sticker spring publication ownership', () => {
  test('synchronous cancellation at intermediate publication cannot requeue the old frame', () => {
    let completed = false
    const stop = deviceStore.sub(stickerInteractionAtom, () => { supersedeStickerInteraction() })
    animateStickerValue('progress', { position: 0, velocity: 0, target: 1 }, false, () => { completed = true })
    const entry = frames.entries().next().value
    if (entry === undefined) throw new Error('Missing frame')
    frames.delete(entry[0]); entry[1](performance.now() + 16)
    expect(frames.size).toBe(0); expect(completed).toBe(false); stop()
  })
  test('synchronous supersede at final reduced publication suppresses old completion', () => {
    let completed = false
    const stop = deviceStore.sub(stickerInteractionAtom, () => supersedeStickerInteraction())
    animateStickerValue('progress', { position: 0, velocity: 0, target: 1 }, true, () => { completed = true })
    expect(completed).toBe(false); stop()
  })
  test('synchronous supersede at final animated publication suppresses old completion', () => {
    let completed = false
    const stop = deviceStore.sub(stickerInteractionAtom, () => supersedeStickerInteraction())
    animateStickerValue('progress', { position: 1, velocity: 0, target: 1 }, false, () => { completed = true })
    const entry = frames.entries().next().value
    if (entry === undefined) throw new Error('Missing frame')
    frames.delete(entry[0]); entry[1](performance.now() + 16)
    expect(frames.size).toBe(0); expect(completed).toBe(false); stop()
  })
})

test('visible source carry animates with rear packet hidden; cancellation stops the owned clock', () => {
  setStickerRearVisible(false)
  const source = { stickerId: 'PW-A01' as const, surface: 'back' as const, x: 0, y: .5, width: .25, rotationDeg: 0 }
  updateStickerInteraction({ selectedStickerId: source.stickerId, sourcePlacement: source, stage: 'peeling', peel: .5 })
  let completed = false
  animateStickerValue('peel', { position: .5, velocity: 0, target: 0 }, false, () => { completed = true })
  const entry = frames.entries().next().value
  if (entry === undefined) throw new Error('Missing side carry frame')
  frames.delete(entry[0]); entry[1](performance.now() + 16)
  expect(deviceStore.get(stickerInteractionAtom).peel).toBeLessThan(.5)
  expect(frames.size).toBe(1)
  setStickerRearVisible(true)
  expect(deviceStore.get(stickerInteractionAtom).sourcePlacement).toEqual(source)
  cancelStickerInteraction(); expect(frames.size).toBe(0); expect(completed).toBe(false)
})
test('hidden packet alone does not keep an animation loop alive', () => {
  setStickerRearVisible(false)
  animateStickerValue('progress', { position: 0, velocity: 0, target: 1 }, false, () => { throw new Error('hidden completion') })
  const entry = frames.entries().next().value
  if (entry === undefined) throw new Error('Missing bounded admission frame')
  frames.delete(entry[0]); entry[1](performance.now() + 16)
  expect(frames.size).toBe(0)
})

test('existing clock reverses transport before contact and retargets either physical subphase', () => {
  for (const initial of [{ peel: .3, sourcePeelFront: .375, detachTransport: 0 }, { peel: .9, sourcePeelFront: 1, detachTransport: .5 }, { peel: .4, sourcePeelFront: 1, detachTransport: 1 }]) {
    updateStickerInteraction(initial)
    let oldCompleted = false, completed = false
    animateStickerValue('peel', { position: initial.peel, velocity: 0, target: 1 }, false, () => { oldCompleted = true })
    // A reverse intent owns the same frame channel; no physical phase resets at admission.
    animateStickerValue('peel', { position: initial.peel, velocity: 0, target: 0 }, false, () => { completed = true })
    expect(deviceStore.get(stickerInteractionAtom).sourcePeelFront).toBe(initial.sourcePeelFront)
    let time = performance.now()
    for (let n = 0; n < 160 && frames.size > 0; n++) {
      time += 16
      const pending = [...frames]; frames.clear()
      for (const [, frame] of pending) frame(time)
      const current = deviceStore.get(stickerInteractionAtom)
      if ((current.sourcePeelFront ?? 0) < 1) expect(current.detachTransport).toBe(0)
    }
    expect(completed).toBe(true); expect(oldCompleted).toBe(false)
    expect(deviceStore.get(stickerInteractionAtom).sourcePeelFront).toBe(0)
    expect(deviceStore.get(stickerInteractionAtom).detachTransport).toBe(0)
  }
  updateStickerInteraction({ peel: 0, sourcePeelFront: 1, detachTransport: 1 })
  animateStickerValue('peel', { position: 0, velocity: 0, target: 0 }, true, () => {})
  expect(deviceStore.get(stickerInteractionAtom).sourcePeelFront).toBe(0)
  expect(deviceStore.get(stickerInteractionAtom).detachTransport).toBe(0)
  expect(frames.size).toBe(0)
})

test('held target changes stay free, clear invalid targets and reenter without stale landing', () => {
  const source = { stickerId: 'PW-A01' as const, surface: 'back' as const, x: .4, y: .32, width: .2, rotationDeg: 0, wear: .5 }
  updateStickerInteraction({ selectedStickerId: source.stickerId, sourcePlacement: source, peel: .4, sourcePeelFront: 1, detachTransport: 1 })
  const target = { ...source, x: .65 }
  updateHeldStickerPreview(target)
  expect(deviceStore.get(stickerInteractionAtom)).toMatchObject({ stage: 'placing', previewPlacement: target, landing: 0, peel: .4, sourcePeelFront: 1, detachTransport: 1 })
  expect(frames.size).toBe(0)
  updateHeldStickerPreview({ ...target, x: NaN })
  expect(deviceStore.get(stickerInteractionAtom)).toMatchObject({ stage: 'peeling', previewPlacement: null, landing: 0, sourcePlacement: source })
  updateHeldStickerPreview(null)
  updateHeldStickerPreview(target)
  expect(deviceStore.get(stickerInteractionAtom).previewPlacement).toEqual(target)
  expect(deviceStore.get(stickerInteractionAtom).landing).toBe(0)
  expect(frames.size).toBe(0)
  let settled = false
  animateStickerValue('landing', { position: deviceStore.get(stickerInteractionAtom).landing, velocity: 0, target: 1 }, false, () => { settled = true })
  const entry = frames.entries().next().value
  if (entry === undefined) throw new Error('Release must own the existing landing clock')
  frames.delete(entry[0]); entry[1](performance.now() + 16)
  expect(deviceStore.get(stickerInteractionAtom).landing).toBeGreaterThan(0)
  expect(deviceStore.get(stickerInteractionAtom).landing).toBeLessThan(1)
  expect(settled).toBe(false)
  cancelStickerInteraction(); expect(frames.size).toBe(0)
})


test('captured material anchor survives release and return but clears on source or lifecycle loss', () => {
  const source = { stickerId: 'PW-A01' as const, surface: 'back' as const, x: .1, y: .2, width: .35, rotationDeg: 0 }
  const anchor = { uv: [.2, .7] as const, point: [1, 2, 3] as const, tangentU: [1, 0, 0] as const }
  const unmount = mountStickerCarryAnchorLifecycle()
  const admit = () => { resetStickerCarry(); updateStickerInteraction({ selectedStickerId: source.stickerId, sourcePlacement: source, stage: 'peeling' }); captureStickerCarryAnchor(source, anchor) }
  try {
    admit(); expect(deviceStore.get(stickerSourceAnchorAtom)).toEqual(anchor)
    expect(deviceStore.get(stickerSourceAnchorAtom)).not.toBe(anchor)
    updateStickerInteraction({ stage: 'placing', previewPlacement: { ...source, x: .4 }, peel: .4, sourcePeelFront: 1, detachTransport: 1 })
    updateStickerInteraction({ stage: 'settling' }) // Pointer has released; the material owner remains.
    expect(deviceStore.get(stickerSourceAnchorAtom)).toEqual(anchor)
    returnStickerToSheet(false)
    expect(deviceStore.get(stickerSourceAnchorAtom)).toEqual(anchor)
    let time = performance.now()
    for (let i = 0; i < 180 && frames.size; i++) { time += 16; const pending = [...frames]; frames.clear(); for (const [, frame] of pending) frame(time) }
    expect(deviceStore.get(stickerCarryAnchorAtom)).toBeNull()
    admit(); updateStickerInteraction({ sourcePlacement: { ...source, rotationDeg: 45 } }); expect(deviceStore.get(stickerCarryAnchorAtom)).toBeNull()
    admit(); cancelStickerInteraction(); expect(deviceStore.get(stickerCarryAnchorAtom)).toBeNull()
    admit(); returnStickerToSheet(true); expect(deviceStore.get(stickerCarryAnchorAtom)).toBeNull()
    admit(); deviceStore.set(setStickerCollectionStatusActionAtom, 'signed-out'); expect(deviceStore.get(stickerCarryAnchorAtom)).toBeNull()
    deviceStore.set(setStickerCollectionStatusActionAtom, 'ready'); admit(); unmount(); expect(deviceStore.get(stickerCarryAnchorAtom)).toBeNull()
  } finally { unmount() }
})


test('raw partial pull is current finite delta, reverses from a frozen origin and cannot revive after takeover', () => {
  const source = { stickerId: 'PW-A01' as const, surface: 'back' as const, x: .1, y: .2, width: .35, rotationDeg: 0 }
  const anchor = { uv: [.2, .7] as const, point: [1, 2, 3] as const, tangentU: [1, 0, 0] as const }
  const unmount = mountStickerCarryAnchorLifecycle()
  const admit = () => { resetStickerCarry(); updateStickerInteraction({ selectedStickerId: source.stickerId, sourcePlacement: source, stage: 'peeling', peel: .5 }); captureStickerCarryAnchor(source, anchor) }
  try {
    admit(); updateStickerSourcePull(source, { x: 12, y: -8 }); expect(deviceStore.get(stickerSourcePullAtom)).toEqual({ x: 12, y: -8 })
    updateStickerSourcePull(source, { x: 3, y: 2 }); expect(deviceStore.get(stickerSourcePullAtom)).toEqual({ x: 3, y: 2 })
    updateStickerSourcePull(source, { x: NaN, y: 2 }); expect(deviceStore.get(stickerSourcePullAtom)).toEqual({ x: 3, y: 2 })
    const previousOwner = deviceStore.get(stickerSourceAnchorAtom)
    admit(); if (previousOwner === null) throw new Error('Missing captured owner')
    updateStickerSourcePull(source, { x: 99, y: 99 }, previousOwner); expect(deviceStore.get(stickerSourcePullAtom)).toEqual({ x: 0, y: 0 })
    updateStickerSourcePull(source, { x: 20, y: -10 }); updateStickerInteraction({ stage: 'settling' })
    expect(deviceStore.get(stickerSourcePullAtom)).toEqual({ x: 20, y: -10 })
    animateStickerValue('return', { position: .5, velocity: 0, target: 0 }, false, () => {})
    expect(deviceStore.get(stickerSourcePullAtom)).toEqual({ x: 20, y: -10 })
    const entry = frames.entries().next().value; if (entry === undefined) throw new Error('Missing return frame')
    frames.delete(entry[0]); entry[1](performance.now() + 16)
    const current = deviceStore.get(stickerSourcePullAtom)
    expect(current?.x).toBeGreaterThan(0); expect(current?.x).toBeLessThan(20); expect(current?.y).toBeCloseTo(-(current?.x ?? 0) / 2)
    cancelStickerInteraction(); expect(deviceStore.get(stickerSourcePullAtom)).toBeNull()
    admit(); updateStickerSourcePull(source, { x: 20, y: 10 })
    let completed = false, cancelled = false
    const stop = deviceStore.sub(stickerCarryAnchorAtom, () => { if (!cancelled && (deviceStore.get(stickerSourcePullAtom)?.x ?? 20) < 20) { cancelled = true; cancelStickerInteraction() } })
    animateStickerValue('return', { position: 1, velocity: 0, target: 0 }, false, () => { completed = true })
    const pending = frames.entries().next().value; if (pending === undefined) throw new Error('Missing cancellation frame')
    frames.delete(pending[0]); pending[1](performance.now() + 16)
    stop(); expect(cancelled).toBe(true); expect(completed).toBe(false); expect(frames.size).toBe(0); expect(deviceStore.get(stickerSourcePullAtom)).toBeNull(); expect(deviceStore.get(stickerInteractionAtom).peel).toBe(0)
    admit(); updateStickerSourcePull(source, { x: 20, y: 10 }); returnStickerToSheet(true); expect(deviceStore.get(stickerSourcePullAtom)).toBeNull()
  } finally { unmount() }
})


test('a stale move cannot adopt a same-source owner replaced during preceding phase or offset publication', () => {
  const source = { stickerId: 'PW-A01' as const, surface: 'back' as const, x: .1, y: .2, width: .35, rotationDeg: 0 }
  const anchor = { uv: [.2, .7] as const, point: [1, 2, 3] as const, tangentU: [1, 0, 0] as const }
  const unmount = mountStickerCarryAnchorLifecycle()
  const admit = () => { resetStickerCarry(); updateStickerInteraction({ selectedStickerId: source.stickerId, sourcePlacement: source, stage: 'peeling', peel: .2 }); captureStickerCarryAnchor(source, anchor) }
  try {
    for (const phase of ['physical', 'offset'] as const) {
      admit()
      const generation = getStickerInteractionGeneration(), owner = deviceStore.get(stickerSourceAnchorAtom)
      if (owner === null) throw new Error('Missing original material owner')
      const ownsMove = () => generation === getStickerInteractionGeneration() && deviceStore.get(stickerSourceAnchorAtom) === owner
      let replaced = false
      const replace = () => { if (!replaced) { replaced = true; cancelStickerInteraction(); admit() } }
      const stop = phase === 'physical' ? deviceStore.sub(stickerInteractionAtom, replace) : deviceStore.sub(stickerDragOffsetAtom, replace)
      if (phase === 'physical') updateStickerInteraction({ peel: .7 }); else deviceStore.set(stickerDragOffsetAtom, { x: 20, y: 10 })
      stop()
      let published = false
      const retained = publishOwnedStickerPull(ownsMove, () => { published = true; updateStickerSourcePull(source, { x: 99, y: 99 }, owner) })
      expect(replaced).toBe(true); expect(published).toBe(false); expect(retained).toBe(false)
      expect(deviceStore.get(stickerSourceAnchorAtom)).not.toBe(owner)
      expect(deviceStore.get(stickerSourcePullAtom)).toEqual({ x: 0, y: 0 })
      expect(deviceStore.get(stickerInteractionAtom).peel).toBe(.2)
    }
  } finally { unmount() }
})
