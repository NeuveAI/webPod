import { describe, expect, test } from 'bun:test';
import { STICKER_CATALOGUE } from '@webpod/stickers';
import { Vector3 } from 'three';
import { createStickerPeelGeometry, createStickerSurfaceGeometry, createRearStickerPeelGeometry, STICKER_SURFACE } from './sticker-surface';
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


test('rear lift preserves nondefault position, width, rotation and stationary adhesive tail', () => {
  const rear = rearShell(), art = STICKER_CATALOGUE[10];
  const placement = { stickerId: art.id, surface: 'back', x: .64, y: .32, width: .18, rotationDeg: 27 } as const;
  const flat = createStickerSurfaceGeometry(art, placement, rear);
  const lifted = createRearStickerPeelGeometry(art, placement, rear, .5);
  const a = flat.getAttribute('position'), b = lifted.getAttribute('position');
  for (let index = (Math.floor(STICKER_SURFACE.segments * .5) + 1) * (STICKER_SURFACE.segments + 1); index < a.count; index++) {
    expect(b.getX(index)).toBeCloseTo(a.getX(index), 5);
    expect(b.getY(index)).toBeCloseTo(a.getY(index), 5);
    expect(b.getZ(index)).toBeCloseTo(a.getZ(index), 5);
  }
  expect(b.getZ(0)).toBeLessThan(a.getZ(0));
  expect(Array.from(lifted.getAttribute('uv').array)).toEqual(Array.from(flat.getAttribute('uv').array));
  flat.dispose(); lifted.dispose(); rear.dispose();
});

test('prepared wrapped source keeps every attached vertex including the final vertex at partial peel', () => {
  const rear = rearShell(), art = STICKER_CATALOGUE[10];
  const placement = { stickerId: art.id, surface: 'back', x: .5, y: .5, width: .2, rotationDeg: 0 } as const;
  const source = createStickerSurfaceGeometry(art, placement, rear), positions = source.getAttribute('position');
  // Bend the real indexed/UV mesh onto a developable side-facing cylinder.
  for (let i = 0; i < positions.count; i++) { const t = positions.getY(i) / 40; positions.setXYZ(i, 165 + 40 * Math.cos(t), positions.getX(i), 40 * Math.sin(t)); }
  source.computeVertexNormals();
  const original = Array.from(positions.array);
  for (const progress of [0, .1, .4, .9, 1]) {
    const peeled = createRearStickerPeelGeometry(art, placement, rear, progress, source), output = peeled.getAttribute('position');
    let maxAttachedDelta = 0, finite = true;
    for (let i = 0; i < output.count; i++) {
      finite &&= [output.getX(i), output.getY(i), output.getZ(i)].every(Number.isFinite);
      if (Math.floor(i / (STICKER_SURFACE.segments + 1)) >= progress * STICKER_SURFACE.segments) maxAttachedDelta = Math.max(maxAttachedDelta, Math.hypot(output.getX(i) - (original[i * 3] ?? 0), output.getY(i) - (original[i * 3 + 1] ?? 0), output.getZ(i) - (original[i * 3 + 2] ?? 0)));
    }
    expect(output.count).toBe(positions.count); expect(finite).toBe(true); expect(maxAttachedDelta).toBe(0);
    expect(Array.from(peeled.getAttribute('uv').array)).toEqual(Array.from(source.getAttribute('uv').array));
    peeled.dispose();
  }
  expect(Array.from(positions.array)).toEqual(original);
  source.dispose(); rear.dispose();
});

test('full-front transport has no discontinuous tail displacement with nonzero carry offset', async () => {
  const { stickerRearTransportWeight } = await import('./sticker-surface');
  const offset = new Vector3(30, -20, 100);
  for (const row of [.9, .95, 1]) {
    const before = offset.clone().multiplyScalar(stickerRearTransportWeight(row, 1 - 1e-7, 0));
    const at = offset.clone().multiplyScalar(stickerRearTransportWeight(row, 1, 0));
    expect(before.distanceTo(at)).toBeLessThan(.001);
    const after = offset.clone().multiplyScalar(stickerRearTransportWeight(row, 1, 1e-7));
    expect(after.distanceTo(at)).toBeLessThan(.001);
    expect(stickerRearTransportWeight(row, 1, 1)).toBe(1);
  }
  expect(stickerRearTransportWeight(1, 1, 0)).toBe(0);
  expect(stickerRearTransportWeight(1, 1, .5)).toBe(.5);
});

test('captured UV inverse samples the displayed adjacency-lifted triangles exactly', async () => {
  const { sampleStickerSurfaceGrid } = await import('./sticker-surface');
  const rear = rearShell(), art = STICKER_CATALOGUE[10], width = 66, height = 66;
  const geometry = createStickerSurfaceGeometry({ ...art, width: 100, height: 100, visibleBounds: [0, 0, 100, 100] }, { stickerId: art.id, surface: 'back', x: .5, y: .5, width: .2, rotationDeg: 0 }, rear);
  const pointAt = (x: number, y: number) => new Vector3(x, 40 * Math.sin(y / 40), -40 * Math.cos(y / 40));
  const p = geometry.getAttribute('position'), n = STICKER_SURFACE.segments;
  for (let row = 0; row <= n; row++) for (let col = 0; col <= n; col++) { const point = pointAt(-((col / n - .5) * width), -((row / n - .5) * height)); p.setXYZ(row * (n + 1) + col, point.x, point.y, point.z); }
  geometry.computeVertexNormals(); const normal = geometry.getAttribute('normal');
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + normal.getX(i) * .18, p.getY(i) + normal.getY(i) * .18, p.getZ(i) + normal.getZ(i) * .18);
  for (const [u, v] of [[0, 0], [1, 1], [.13, .71], [.51, .33], [.995, .1]]) {
    if (u === undefined || v === undefined) throw new Error('Missing test UV');
    const gx = u * n, gy = v * n, col = Math.min(n - 1, Math.floor(gx)), row = Math.min(n - 1, Math.floor(gy)), x = gx - col, y = gy - row;
    const a = row * (n + 1) + col, b = a + 1, c = a + n + 1, expected = new Vector3();
    const weights = x + y <= 1 ? [[a, 1 - x - y], [b, x], [c, y]] : [[b, 1 - y], [c, 1 - x], [c + 1, x + y - 1]];
    for (const [index, weight] of weights) if (index !== undefined && weight !== undefined) expected.addScaledVector(new Vector3().fromBufferAttribute(p, index), weight);
    expect(sampleStickerSurfaceGrid(pointAt, width, height, 0, u, v).distanceTo(expected)).toBeLessThan(1e-6);
  }
  geometry.dispose(); rear.dispose();
});
