import { expect, test } from 'bun:test'
import { BODY_CORNER_R as r, BODY_H, BODY_W } from '@webpod/tokens'
import { isStickerPlacement, isStickerRearCenter, STICKER_CATALOGUE } from './index'

const perimeter = [
  { x: 0, y: .5 }, { x: 1, y: .5 }, { x: .5, y: 0 }, { x: .5, y: 1 },
  ...[-1, 1].flatMap((sx) => [-1, 1].map((sy) => ({
    x: .5 + sx * (BODY_W / 2 - r + r / Math.sqrt(2)) / BODY_W,
    y: .5 + sy * (BODY_H / 2 - r + r / Math.sqrt(2)) / BODY_H,
  }))),
]
test('all catalogue aspects and rotations may wrap at every full rear edge and rounded corner', () => {
  for (const art of STICKER_CATALOGUE) for (const point of perimeter) for (const width of [.08, .35, .8, 1.2]) for (const rotationDeg of [-180, -137, -45, 0, 37, 90, 180]) {
    expect(isStickerPlacement({ stickerId: art.id, surface: 'back', ...point, width, rotationDeg, wear: 1 })).toBe(true)
  }
})
test('rounded rear center excludes empty bounding-box corners and off-shell points', () => {
  for (const x of [0, 1]) for (const y of [0, 1]) expect(isStickerRearCenter(x, y)).toBe(false)
  for (const point of perimeter.slice(4)) {
    expect(isStickerRearCenter(point.x, point.y)).toBe(true)
    expect(isStickerRearCenter(.5 + (point.x - .5) * 1.000001, .5 + (point.y - .5) * 1.000001)).toBe(false)
  }
  for (const value of [NaN, Infinity, -Infinity, -.00001, 1.00001]) {
    expect(isStickerRearCenter(value, .5)).toBe(false)
    expect(isStickerRearCenter(.5, value)).toBe(false)
  }
})
test('legacy body-space coordinates retain exact values and strict placement fields', () => {
  const saved = { stickerId: 'PW-C01', surface: 'back', x: .37, y: .61, width: .25, rotationDeg: 35, wear: .7 }
  const before = JSON.stringify(saved)
  expect(isStickerPlacement(saved)).toBe(true)
  expect(JSON.stringify(saved)).toBe(before)
  for (const bad of [{ x: NaN }, { y: Infinity }, { width: .079 }, { width: 1.201 }, { rotationDeg: 181 }, { rotationDeg: NaN }, { wear: -1 }, { wear: 1.001 }, { stickerId: 'foreign' }, { surface: 'front' }]) expect(isStickerPlacement({ ...saved, ...bad })).toBe(false)
})
