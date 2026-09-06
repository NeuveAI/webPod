import { expect, test } from 'bun:test';
import { isStickerCarried, type StickerPackVisual } from './sticker-contract';

test('a carried print owns its static rear and sheet seat across native write publication', () => {
  const placement = { stickerId: 'PW-C01', surface: 'back', x: .55, y: .4, width: .18, rotationDeg: 23 } as const;
  const idle: StickerPackVisual = { stickerId: placement.stickerId, progress: 1, peel: 0, landing: 0, placement: null };
  expect(isStickerCarried(idle, placement.stickerId)).toBe(false);
  for (const phase of [
    { ...idle, sourcePlacement: placement }, // initial rear lift, still flush
    { ...idle, peel: .8 }, // sheet origin, before persistence
    { ...idle, placement, landing: 1 }, // canonical rear published, press still owned
    { ...idle, dragOffset: { x: 80, y: 40 } }, // reduced-motion free drag
    { ...idle, sourcePlacement: placement, returnToSheet: true }, // canonical removal before return animation
  ]) {
    expect(isStickerCarried(phase, placement.stickerId)).toBe(true);
    expect(isStickerCarried(phase, 'PW-C02')).toBe(false);
  }
  expect(isStickerCarried(null, placement.stickerId)).toBe(false);
});
