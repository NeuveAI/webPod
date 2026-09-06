import { expect, test } from 'bun:test';
import { ExtrudeGeometry } from 'three';
import { createStickerSleeveGeometry } from './sticker-sleeve';

test('pocket exterior coating never includes interior cap or cut rim at responsive scales', () => {
  for (const pixel of [.55, 1, 1.8]) {
    const geometry = createStickerSleeveGeometry(320 * pixel, 336 * pixel, pixel);
    const normals = geometry.getAttribute('normal'), positions = geometry.getAttribute('position');
    let covered = 0;
    const materials = new Set<number>();
    for (const group of geometry.groups) {
      expect(group.start).toBe(covered);
      materials.add(group.materialIndex ?? -1);
      for (let index = group.start; index < group.start + group.count; index++) {
        if (group.materialIndex === 0) {
          expect(normals.getZ(index)).toBe(1);
          expect(positions.getZ(index) / pixel).toBeCloseTo(.85, 5);
        } else if (group.materialIndex === 2) {
          expect(normals.getZ(index)).toBe(-1);
          expect(positions.getZ(index) / pixel).toBeCloseTo(-.15, 5);
        }
      }
      covered += group.count;
    }
    expect(materials).toEqual(new Set([2, 0, 1]));
    expect(covered).toBe(positions.count);
    // Material partition cannot alter the original notch, folded stock, or UVs.
    const original = new ExtrudeGeometry(geometry.parameters.shapes, geometry.parameters.options);
    expect(Array.from(geometry.getAttribute('uv').array)).toEqual(Array.from(original.getAttribute('uv').array));
    expect(Array.from(geometry.getAttribute('position').array)).toEqual(Array.from(original.getAttribute('position').array));
    original.dispose(); geometry.dispose();
  }
});
