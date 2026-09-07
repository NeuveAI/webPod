import { expect, test } from 'bun:test';
import { stickerInsertBridgeHeight } from './sticker-insert-bridge';
const rect = { centerX: 0, centerY: 0, width: 40, height: 40, cornerR: 4 };
const support = (x: number, y: number) => Math.abs(x) >= 20 || Math.abs(y) >= 20 ? 2 : 0;
test('known insert ramp keeps endpoints and support, with zero endpoint slope', () => {
  expect(stickerInsertBridgeHeight(21, 0, rect, support)).toBe(2);
  expect(stickerInsertBridgeHeight(12, 0, rect, support)).toBe(0);
  expect(stickerInsertBridgeHeight(19.999, 0, rect, support)).toBeCloseTo(2, 6);
  for (let d = 0.1; d < 8; d += .1) {
    const height = stickerInsertBridgeHeight(20 - d, 0, rect, support);
    expect(height).toBeGreaterThanOrEqual(0); expect(height).toBeLessThanOrEqual(2);
  }
});
