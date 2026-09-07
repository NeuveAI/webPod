import { expect, test } from 'bun:test'
import { adaptStickerGrab, pickStickerSource, releaseStickerCandidate, sampleOwnedStickerRelease, type StickerGrab } from './sticker-grab'
const placement = { stickerId: 'PW-F01' as const, surface: 'back' as const, x: 0, y: .5, width: .35, rotationDeg: 0 }
test('production grab adapter retains original UV projection and live validity without legacy fallback', () => {
  let valid = true
  const deviceGrab = { placement, projectCenter: (x: number, y: number) => valid ? { x: x / 100, y: y / 100 } : null, isValid: () => valid }
  const adapted = adaptStickerGrab(deviceGrab)
  expect(adapted?.placement).toBe(placement)
  expect(adapted?.projectCenter(12, 34)).toEqual({ x: .12, y: .34 })
  // A new handle for presentation does not invalidate the captured geometry closure.
  expect(adaptStickerGrab({ ...deviceGrab })).not.toBeNull()
  expect(adapted?.isValid?.()).toBe(true)
  valid = false
  expect(adapted?.isValid?.()).toBe(false)
  expect(adapted?.projectCenter(12, 34)).toBeNull()
  expect(adaptStickerGrab(deviceGrab)).toBeNull()
  expect(adaptStickerGrab(null)).toBeNull()
  expect(adaptStickerGrab(undefined)).toBeNull()
  expect(adaptStickerGrab({ ...deviceGrab, placement: { ...placement, stickerId: 'invalid' }, isValid: () => true })).toBeNull()
})
test('visible wrapped hit admits side/front independently of pack rear gate', () => {
  const grab: StickerGrab = { placement, projectCenter: () => ({ x: .1, y: .5 }), isValid: () => true }
  const picked = pickStickerSource(false, { grab: () => grab, hit: () => { throw new Error('legacy hit must not run') } }, 1, 2)
  expect(picked?.grab).toBe(grab); expect(picked?.source).toBe(placement)
})
test('absent visible capability and hidden/invalid hits cannot steal off-rear shell gestures', () => {
  expect(pickStickerSource(false, { hit: () => placement }, 0, 0)).toBeNull()
  expect(pickStickerSource(true, { grab: () => null, hit: () => placement }, 0, 0)).toBeNull()
  expect(pickStickerSource(false, { grab: () => ({ placement, projectCenter: () => null, isValid: () => false }), hit: () => placement }, 0, 0)).toBeNull()
  expect(pickStickerSource(true, { hit: () => placement }, 0, 0)?.source).toBe(placement)
})

for (const reason of ['missing collection', 'Escape']) test(`${reason} candidate cancellation clears ownership before capture release`, () => {
    let owned: { event: { pointerId: number }; canvas: { hasPointerCapture(): boolean; releasePointerCapture(): void } } | null = null
    let releases = 0
    owned = { event: { pointerId: 7 }, canvas: { hasPointerCapture: () => true, releasePointerCapture: () => { expect(owned).toBeNull(); releases++ } } }
    const released = releaseStickerCandidate(() => owned, () => { owned = null })
    expect(released?.event.pointerId).toBe(7)
    expect(releases).toBe(1)
    // The following move/up sees no candidate, so neither selects nor starts carry.
    expect(owned).toBeNull()
    expect(releaseStickerCandidate(() => owned, () => { owned = null })).toBeNull()
    expect(releases).toBe(1)
})
test('invalid final grab sample and same-pointer supersession prevent release settlement', () => {
  let pointer: number | null = 7, generation = 1, settled = 0
  if (sampleOwnedStickerRelease(7, () => pointer, () => generation, () => { pointer = null; generation++ })) settled++
  expect(settled).toBe(0)
  pointer = 7
  if (sampleOwnedStickerRelease(7, () => pointer, () => generation, () => { generation++ })) settled++
  expect(settled).toBe(0)
  if (sampleOwnedStickerRelease(7, () => pointer, () => generation, () => {})) settled++
  expect(settled).toBe(1)
})


test('grab anchor is copied as finite local material data and malformed anchors reject admission', () => {
  const anchor = { uv: [.2, .7] as [number, number], point: [1, 2, 3] as [number, number, number], tangentU: [1, 0, 0] as [number, number, number] }
  const grab = { placement, anchor, projectCenter: () => ({ x: 0, y: .5 }), isValid: () => true }
  const adapted = adaptStickerGrab(grab)
  expect(adapted?.anchor).toEqual(anchor)
  anchor.point[0] = 99; expect(adapted?.anchor?.point[0]).toBe(1)
  expect(adaptStickerGrab({ ...grab, anchor: { ...anchor, uv: [NaN, .7] } })).toBeNull()
  expect(adaptStickerGrab({ ...grab, anchor: { ...anchor, tangentU: [0, 0, 0] } })).toBeNull()
})
