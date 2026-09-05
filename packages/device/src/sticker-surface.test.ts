import { describe, expect, test } from 'bun:test';
import { STICKER_CATALOGUE } from '@webpod/stickers';
import { Vector3 } from 'three';
import { createStickerPeelGeometry, createStickerSurfaceGeometry, STICKER_SURFACE } from './sticker-surface';
import { createRearShellGeometry } from './product-shell';
import { DEVICE_LAYOUT } from './layout';
import { DEFAULT_DEVICE_FORM } from './form';
import { createStickerRoughness } from './sticker-textures';

function rearShell() {
  return createRearShellGeometry({ ...DEVICE_LAYOUT.body, frontThickness: DEFAULT_DEVICE_FORM.frontThickness, rearCrownInset: DEFAULT_DEVICE_FORM.rearCrownInset });
}
describe('production sticker surface', () => {
  test('all 60 manifest silhouettes preserve their UV crop and conform to the actual rear cap', () => {
    const rear = rearShell();
    for (const art of STICKER_CATALOGUE) {
      const geometry = createStickerSurfaceGeometry(art, { stickerId: art.id, surface: 'back', x: .5, y: .5, width: .2, rotationDeg: 13 }, rear);
      const positions = geometry.getAttribute('position');
      const normals = geometry.getAttribute('normal');
      for (let index = 0; index < positions.count; index++) {
        expect(positions.getZ(index)).toBeCloseTo(-DEVICE_LAYOUT.body.depth / 2 - STICKER_SURFACE.lift, 4);
        expect(normals.getZ(index)).toBe(-1);
      }
      const uv = geometry.getAttribute('uv');
      expect(uv.getX(0)).toBeCloseTo(art.visibleBounds[0] / art.width, 5);
      expect(uv.getY(0)).toBeCloseTo(1 - art.visibleBounds[1] / art.height, 5);
      geometry.dispose();
    }
    rear.dispose();
  });
  test('rear-view right placement moves toward model -X and invalid off-body points fail', () => {
    const rear = rearShell();
    const art = STICKER_CATALOGUE[0];
    const geometry = createStickerSurfaceGeometry(art, { stickerId: art.id, surface: 'back', x: .75, y: .5, width: .1, rotationDeg: 0 }, rear);
    expect(geometry.boundingBox?.getCenter(new Vector3()).x).toBeCloseTo(-DEVICE_LAYOUT.body.width / 4, 4);
    expect(() => createStickerSurfaceGeometry(art, { stickerId: art.id, surface: 'back', x: 2, y: .5, width: .2, rotationDeg: 0 }, rear)).toThrow('exceeds rear');
    geometry.dispose(); rear.dispose();
  });
  test('peel is actual continuous curvature, stable print UVs, with a fixed contact region', () => {
    const art = STICKER_CATALOGUE[0];
    const flat = createStickerPeelGeometry(art, 80, 0);
    const peeled = createStickerPeelGeometry(art, 80, .5);
    const flatPosition = flat.getAttribute('position');
    const curledPosition = peeled.getAttribute('position');
    expect(curledPosition.getZ(0)).toBeGreaterThan(10);
    expect(curledPosition.getZ(curledPosition.count - 1)).toBe(0);
    for (let index = 0; index < flatPosition.count; index++) {
      expect(flatPosition.getZ(index)).toBe(0);
      expect(peeled.getAttribute('uv').getX(index)).toBe(flat.getAttribute('uv').getX(index));
      expect(peeled.getAttribute('uv').getY(index)).toBe(flat.getAttribute('uv').getY(index));
    }
    flat.dispose(); peeled.dispose();
  });
  test('microtexture is deterministic and has nonzero green roughness data', () => {
    const first = createStickerRoughness(); const second = createStickerRoughness();
    expect(first.image.data).toEqual(second.image.data);
    expect(first.image.data?.[1]).toBeGreaterThan(230);
    expect(first.colorSpace).toBe('');
    first.dispose(); second.dispose();
  });
});
