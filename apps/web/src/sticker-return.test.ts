import { expect, spyOn, test } from 'bun:test'
import { deviceStore, receiveStickerInventoryActionAtom, resetStickerCollectionActionAtom, stickerInteractionAtom } from '@webpod/state'
import { STICKER_GENRES } from '@webpod/stickers'
import { returnStickerToSheet, resetStickerCarry, setStickerRearVisible, stopStickerAnimation, supersedeStickerInteraction, updateStickerInteraction } from './sticker-interaction'
import { stickerPreparedIdsAtom, stickerDragOffsetAtom, stickerSheetRevealAtom, stickerWorkspaceLoweringAtom } from './sticker-collections-model'

test('missed and cancelled rear drops reverse from the displayed pose and release their frame owner', () => {
  let clock = 0
  let nextId = 0
  const frames = new Map<number, FrameRequestCallback>()
  const originalRequest = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame')
  const originalCancel = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame')
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: (callback: FrameRequestCallback) => { frames.set(++nextId, callback); return nextId } })
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: (id: number) => frames.delete(id) })
  const now = spyOn(performance, 'now').mockImplementation(() => clock)
  const advance = (): void => { clock += 16; const pending = [...frames]; frames.clear(); for (const [, callback] of pending) callback(clock) }
  try {
    deviceStore.set(receiveStickerInventoryActionAtom, { stickerIds: ['PW-C01'], packs: [{ id: 'p', source: 'starter', stickerIds: ['PW-C01'], earnedAt: 1, openedAt: 2 }], placements: [], placementRevision: 0, importStatus: 'complete', progress: STICKER_GENRES.map((genre) => ({ genre, listenedMs: 0, nextThresholdMs: 300000 })) })
    deviceStore.set(stickerPreparedIdsAtom, ['PW-C01', 'PW-C02', 'PW-C03', 'PW-C04', 'PW-C05'])
    setStickerRearVisible(true)
    const placement = { stickerId: 'PW-C01', surface: 'back', x: .5, y: .5, width: .25, rotationDeg: 0 } as const
    for (const landing of [0, .97]) {
      updateStickerInteraction({ selectedStickerId: 'PW-C01', stage: 'placing', progress: 1, peel: .8, previewPlacement: landing === 0 ? null : placement, landing })
      deviceStore.set(stickerDragOffsetAtom, { x: 120, y: -30 })
      returnStickerToSheet(false)
      expect(deviceStore.get(stickerDragOffsetAtom)?.x).toBe(120)
      expect(deviceStore.get(stickerInteractionAtom).landing).toBe(landing)
      expect(deviceStore.get(stickerInteractionAtom).previewPlacement).toEqual(landing === 0 ? null : placement)
      advance()
      expect(deviceStore.get(stickerDragOffsetAtom)?.x).toBeGreaterThan(110)
      expect(deviceStore.get(stickerDragOffsetAtom)?.x).toBeLessThan(120)
      if (landing > 0) expect(deviceStore.get(stickerInteractionAtom).landing).toBeGreaterThan(.85)
      for (let step = 0; step < 100 && frames.size > 0; step++) advance()
      expect(deviceStore.get(stickerDragOffsetAtom)).toBeNull()
      expect(deviceStore.get(stickerInteractionAtom).previewPlacement).toBeNull()
      expect(deviceStore.get(stickerInteractionAtom).stage).toBe('open')
      expect(frames.size).toBe(0)
    }
    setStickerRearVisible(false)
    deviceStore.set(stickerPreparedIdsAtom, [])
    setStickerRearVisible(true)
    updateStickerInteraction({ selectedStickerId: placement.stickerId, sourcePlacement: placement, peel: .7, stage: 'peeling' })
    deviceStore.set(stickerDragOffsetAtom, { x: 100, y: 0 })
    returnStickerToSheet(false)
    advance()
    expect(deviceStore.get(stickerDragOffsetAtom)?.x).toBeLessThan(100)
    expect(deviceStore.get(stickerInteractionAtom).sourcePlacement).toEqual(placement)
    for (let step = 0; step < 100 && frames.size > 0; step++) advance()
    expect(deviceStore.get(stickerInteractionAtom).sourcePlacement).toBeNull()
    expect(frames.size).toBe(0)
    deviceStore.set(stickerPreparedIdsAtom, ['PW-C01', 'PW-C02', 'PW-C03', 'PW-C04', 'PW-C05'])
    deviceStore.set(stickerDragOffsetAtom, { x: 100, y: 0 })
    returnStickerToSheet(false)
    supersedeStickerInteraction()
    expect(frames.size).toBe(0)
    returnStickerToSheet(true)
    expect(deviceStore.get(stickerDragOffsetAtom)).toBeNull()
    expect(frames.size).toBe(0)
    deviceStore.set(stickerWorkspaceLoweringAtom, 1)
    deviceStore.set(stickerDragOffsetAtom, { x: 80, y: 30 })
    returnStickerToSheet(false)
    advance()
    expect(deviceStore.get(stickerWorkspaceLoweringAtom)).toBeGreaterThan(0)
    resetStickerCarry() // shared by selection, collection switch, new grab and rejected save
    expect(deviceStore.get(stickerWorkspaceLoweringAtom)).toBe(0)
    expect(deviceStore.get(stickerDragOffsetAtom)).toBeNull()
    expect(frames.size).toBe(0)
    returnStickerToSheet(false)
    deviceStore.set(stickerSheetRevealAtom, 1)
    setStickerRearVisible(false)
    expect(deviceStore.get(stickerSheetRevealAtom)).toBe(0)
    expect(deviceStore.get(stickerDragOffsetAtom)).toBeNull()
    setStickerRearVisible(true)
    expect(deviceStore.get(stickerSheetRevealAtom)).toBe(0)
    expect(deviceStore.get(stickerInteractionAtom).stage).toBe('tease')
    expect(frames.size).toBe(0)
  } finally {
    stopStickerAnimation(); setStickerRearVisible(false); deviceStore.set(resetStickerCollectionActionAtom)
    now.mockRestore()
    for (const [name, descriptor] of [['requestAnimationFrame', originalRequest], ['cancelAnimationFrame', originalCancel]] as const) {
      if (descriptor !== undefined) Object.defineProperty(globalThis, name, descriptor)
      else Reflect.deleteProperty(globalThis, name)
    }
  }
})
