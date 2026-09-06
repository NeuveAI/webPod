import { expect, test } from 'bun:test'
import { STICKER_GENRES, type StickerInventory } from '@webpod/stickers'
import { collectStickerSheets, COLLECTION_MINUTES, stickerPlacementForIntent, stickerPeelMotion } from './sticker-collections-model'
import { LISTENING_THRESHOLDS_MS } from '../../../packages/server-core/src/stickers/policy'
import { stickerPackViewportLayout, STICKER_SHEET_SLOTS } from '@webpod/device'

const inventory: StickerInventory = {
  stickerIds: ['PW-C01', 'PW-F01', 'PW-C02'],
  packs: [
    { id: 'mixed-starter', source: 'starter', stickerIds: ['PW-C01', 'PW-F01'], earnedAt: 1, openedAt: 2 },
    { id: 'rock-listening', source: 'listening', stickerIds: ['PW-C02'], earnedAt: 3, openedAt: null },
  ],
  placements: [{ stickerId: 'PW-C01', surface: 'back', x: .5, y: .5, width: .25, rotationDeg: 0 }],
  placementRevision: 1, importStatus: 'partial',
  progress: STICKER_GENRES.map((genre) => ({ genre, listenedMs: genre === 'rock' ? 15 * 60_000 : 0, nextThresholdMs: 60 * 60_000 })),
}
test('mixed starter remains two genre sheets with five honest seats each', () => {
  const sheets = collectStickerSheets(inventory)
  expect(sheets.map((sheet) => sheet.genre)).toEqual(['rock', 'electronic'])
  expect(sheets.map((sheet) => sheet.slots.length)).toEqual([5, 5])
  expect(sheets[0]?.slots.map((slot) => slot.state)).toEqual(['placed', 'sealed', 'locked', 'locked', 'locked'])
  expect(sheets[0]?.unopenedPackIds).toEqual(['rock-listening'])
  expect(sheets[0]?.slots[2]?.remainingMinutes).toBe(45)
  expect(sheets[1]?.slots[0]?.state).toBe('earned')
  expect(sheets[1]?.listenedMinutes).toBe(0)
  expect(sheets[1]?.slots[0]?.meaning).toContain('Apple Music library')
})
test('opening a mixed grant reveals earned seats across its genre sheets without granting future art', () => {
  const sealed = { ...inventory, packs: inventory.packs.map((pack) => ({ ...pack, openedAt: null })), placements: [] }
  const before = collectStickerSheets(sealed)
  expect(before[0]?.unopenedPackIds).toEqual(['mixed-starter', 'rock-listening'])
  expect(before[1]?.unopenedPackIds).toEqual(['mixed-starter'])
  const opened = collectStickerSheets({ ...sealed, packs: sealed.packs.map((pack) => ({ ...pack, openedAt: 10 })) })
  expect(opened[0]?.slots[0]?.state).toBe('earned')
  expect(opened[1]?.slots[0]?.state).toBe('earned')
  expect(opened[0]?.slots[4]?.state).toBe('locked')
})
test('display thresholds stay identical to server earning policy and unknown collections are absent', () => {
  expect(COLLECTION_MINUTES.map((minutes) => minutes * 60_000)).toEqual(LISTENING_THRESHOLDS_MS)
  expect(collectStickerSheets(null)).toEqual([])
  expect(collectStickerSheets({ ...inventory, stickerIds: [], packs: [] })).toEqual([])
})
test('shared liner layout fits narrow and short viewports and retains five reachable seats', () => {
  for (const [width, height] of [[375, 812], [320, 568], [844, 390], [1280, 900]]) {
    if (width === undefined || height === undefined) throw new Error('Fixture invalid')
    const layout = stickerPackViewportLayout(width, height)
    expect(layout.centerX - layout.width / 2).toBeGreaterThanOrEqual(0)
    expect(layout.centerX + layout.width / 2).toBeLessThanOrEqual(width)
    expect(layout.height).toBeLessThanOrEqual(height * .55)
    expect(STICKER_SHEET_SLOTS.every((slot) => slot.x >= .145 && slot.x <= .855 && slot.y >= .12 && slot.y <= .86)).toBe(true)
  }
})

test('keyboard and meaning intents cannot borrow another earned sticker preview', () => {
  const first = stickerPlacementForIntent('PW-C01', null, .25)
  const moved = { ...first, x: .62, y: .3 }
  expect(stickerPlacementForIntent('PW-C01', moved, .25)).toBe(moved)
  const second = stickerPlacementForIntent('PW-C02', moved, .25)
  expect(second.stickerId).toBe('PW-C02')
  expect(second.x).toBe(.5)
  expect(second.y).toBe(.5)
  expect(stickerPlacementForIntent('PW-C01', second, .25).stickerId).toBe('PW-C01')
})

test('partial peel anchors remaining contact, releases continuously, and reduced motion follows directly', () => {
  expect(stickerPeelMotion(48, 0, false)).toEqual({ peel: .75, detached: false, offset: null })
  expect(stickerPeelMotion(64, 0, false)).toEqual({ peel: 1, detached: false, offset: null })
  const released = stickerPeelMotion(64.01, 0, false)
  expect(released.detached).toBe(true)
  expect(released.offset?.x).toBeCloseTo(.01)
  expect(released.peel).toBeGreaterThan(.99)
  const free = stickerPeelMotion(164, 0, false)
  expect(free.offset?.x).toBe(164)
  expect(free.peel).toBeCloseTo(.18)
  expect(stickerPeelMotion(10, 5, false, 64, 164)).toEqual({ peel: free.peel, detached: true, offset: { x: 10, y: 5 } })
  expect(stickerPeelMotion(50, 20, true)).toEqual({ peel: 0, detached: true, offset: { x: 50, y: 20 } })
})
