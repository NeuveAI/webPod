import { expect, test } from 'bun:test';
import { BufferGeometry, Float32BufferAttribute, Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { constrainStickerCarryContacts, createStickerFreeCarryGeometry, stickerGeometryUvPoint, interpolateStickerCarryGeometry, stickerCarryPointerOffset } from './sticker-free-carry';
import { createRearStickerPeelGeometry, createStickerSurfaceGeometry, STICKER_SURFACE } from './sticker-surface';

test('bounded contact keeps attached nodes exact and slides a moving node along its first exterior plane', () => {
  const source = new BufferGeometry(); source.setAttribute('position', new Float32BufferAttribute([0, 0, .18, 0, 0, 1], 3));
  const shown = source.clone(); shown.getAttribute('position').setXYZ(1, 2, 0, -1);
  const world = new Matrix4().makeRotationY(.7); world.setPosition(10, 20, 30); shown.applyMatrix4(world);
  const attached = [...shown.getAttribute('position').array].slice(0, 3);
  const result = constrainStickerCarryContacts(source, shown, world, (a, b) => {
    if (b.z >= 0 || a.z <= 0) return null;
    const point = a.clone().lerp(b, a.z / (a.z - b.z));
    return { point, normal: new Vector3(0, 0, -1), distance: a.distanceTo(point), source: 'plane', kind: 'surface' };
  });
  expect([...shown.getAttribute('position').array].slice(0, 3)).toEqual(attached);
  const point = new Vector3().fromBufferAttribute(shown.getAttribute('position'), 1).applyMatrix4(world.clone().invert());
  expect(point.x).toBeCloseTo(2, 5); expect(point.z).toBeCloseTo(.18, 5);
  expect(result.contacts).toBe(1); expect(result.unresolved).toBe(0); expect(result.queries).toBeLessThanOrEqual(6);
  shown.dispose(); source.dispose();
});

test('free sheet restores full original material rows and anchors the exact continuous picked UV', () => {
  const art = { id: 'test', url: '', width: 100, height: 180, visibleBounds: [0, 0, 100, 180] as const }, placement = { stickerId: 'test', surface: 'back' as const, x: .5, y: .5, width: .2, rotationDeg: 23 };
  const rear = new BufferGeometry(), source = createStickerSurfaceGeometry(art, placement, rear), world = new Matrix4().makeRotationY(.7); world.setPosition(23, -11, 7);
  const camera = new PerspectiveCamera(40, 1.4, 1, 3000); camera.position.set(0, 0, -1000); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const picked = stickerGeometryUvPoint(source, .273, .618), anchor = { uv: [.273, .618] as const, point: picked.toArray() as [number, number, number], tangentU: [-1, 0, 0] as const }, expected = picked.clone().applyMatrix4(world);
  const n = STICKER_SURFACE.segments;
  for (const curl of [0, .4, 1]) {
    const free = createStickerFreeCarryGeometry(art, placement, source, world, camera, anchor, curl), p = free.getAttribute('position');
    expect(stickerGeometryUvPoint(free, ...anchor.uv).distanceTo(expected)).toBeLessThan(2e-5);
    expect([...free.getAttribute('uv').array]).toEqual([...source.getAttribute('uv').array]); expect(free.index?.array).toEqual(source.index?.array);
    for (let row = 0; row <= n; row++) {
      const a = new Vector3().fromBufferAttribute(p, row * (n + 1)), b = new Vector3().fromBufferAttribute(p, row * (n + 1) + n);
      expect(a.distanceTo(b)).toBeCloseTo(66, 4);
    }
    for (let row = 0; row < n; row++) {
      const a = new Vector3().fromBufferAttribute(p, row * (n + 1)), b = new Vector3().fromBufferAttribute(p, (row + 1) * (n + 1));
      expect(a.distanceTo(b)).toBeGreaterThan(66 * 1.8 / n * .999); expect(a.distanceTo(b)).toBeLessThan(66 * 1.8 / n * 1.001);
    }
    free.dispose();
  }
  // Existing partial peel is unchanged, including every attached row and last vertex.
  const partial = createRearStickerPeelGeometry(art, placement, rear, .5, source, .625);
  for (let i = 60 * (n + 1); i < source.getAttribute('position').count; i++) for (let c = 0; c < 3; c++) expect(partial.getAttribute('position').array[i * 3 + c]).toBe(source.getAttribute('position').array[i * 3 + c]);
  partial.dispose(); source.dispose(); rear.dispose();
});


test('proper-frame carry transition keeps exact endpoints, reversible samples and displayed anchor offset', () => {
  const art = { id: 'test', url: '', width: 100, height: 180, visibleBounds: [0, 0, 100, 180] as const }, placement = { stickerId: 'test', surface: 'back' as const, x: .5, y: .5, width: .2, rotationDeg: 0 };
  const rear = new BufferGeometry(), source = createStickerSurfaceGeometry(art, placement, rear), world = new Matrix4().makeRotationY(2.5);
  const camera = new PerspectiveCamera(40, 1.4, 1, 3000); camera.position.set(0, 0, -1000); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const uv = [.273, .618] as const, point = stickerGeometryUvPoint(source, ...uv), anchor = { uv, point: point.toArray() as [number, number, number], tangentU: [-1, 0, 0] as const };
  const start = createRearStickerPeelGeometry(art, placement, rear, 1, source, 1); start.applyMatrix4(world);
  const free = createStickerFreeCarryGeometry(art, placement, source, world, camera, anchor, 1), prior = new Map<number, Float32Array>();
  for (const t of [0, .5, 1, .5, 0]) {
    const shown = start.clone(); interpolateStickerCarryGeometry(shown, free, ...uv, t); const p = shown.getAttribute('position');
    expect([...p.array].every(Number.isFinite)).toBe(true);
    if (t === 0) expect(p.array).toEqual(start.getAttribute('position').array);
    if (t === 1) expect(p.array).toEqual(free.getAttribute('position').array);
    const previous = prior.get(t); if (previous) expect(p.array).toEqual(previous); else prior.set(t, new Float32Array(p.array));
    shown.dispose();
  }
  const at = point.clone().applyMatrix4(world), before = at.clone().project(camera), delta = stickerCarryPointerOffset(at, camera, 840, 600, 81, 123), after = at.clone().add(delta).project(camera);
  expect((after.x - before.x) * 420).toBeCloseTo(81, 8); expect((before.y - after.y) * 300).toBeCloseTo(123, 8);
  source.dispose(); start.dispose(); free.dispose(); rear.dispose();
});
