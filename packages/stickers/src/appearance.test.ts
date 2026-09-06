import { expect, test } from 'bun:test'
import { isStickerInventory, stickerWear, STICKER_GENRES, type StickerInventory } from './index'
const inventory: StickerInventory = { stickerIds: ['PW-C01'], packs: [], progress: STICKER_GENRES.map((genre) => ({ genre, listenedMs: 0, nextThresholdMs: null })), placements: [], placementRevision: 0, importStatus: 'complete' }
test('legacy inventory defaults to original and validates canonical owned appearance identity', () => {
  expect(isStickerInventory(inventory)).toBe(true); expect(stickerWear(inventory, 'PW-C01')).toBe(0)
  expect(isStickerInventory({ ...inventory, appearances: [{ stickerId: 'PW-C01', wear: .5 }] })).toBe(true)
  expect(stickerWear({ appearances: [{ stickerId: 'PW-C01', wear: .5 }] }, 'PW-C01')).toBe(.5)
  for (const appearances of [null, {}, [{ stickerId: 'PW-C02', wear: .5 }], [{ stickerId: 'unknown', wear: .5 }], [{ stickerId: 'PW-C01', wear: .5 }, { stickerId: 'PW-C01', wear: .8 }], ...[undefined, null, NaN, Infinity, -.1, 1.1, '0.5'].map((wear) => [{ stickerId: 'PW-C01', wear }])]) expect(isStickerInventory({ ...inventory, appearances })).toBe(false)
  expect(isStickerInventory({ ...inventory, appearances: Array.from({ length: 61 }, () => ({ stickerId: 'PW-C01', wear: 0 })) })).toBe(false)
})
