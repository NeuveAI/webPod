import { expect, test } from 'bun:test';
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Matrix4, Vector3 } from 'three';
import { createStickerCollision } from './sticker-collision';

function triangle(points: readonly number[]) { const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(points, 3)); return geometry; }

test('ray entry pruning retains inside starts and returned hits own their scratch-independent vectors', () => {
  const enclosing = new BoxGeometry(20, 20, 20), inner = triangle([-2, -2, 1, 2, -2, 1, 0, 2, 1]);
  const collider = createStickerCollision([{ geometry: enclosing, source: 'outer', kind: 'surface' }, { geometry: inner, source: 'inner', kind: 'surface' }]);
  const hit = collider.castSegment(new Vector3(), new Vector3(0, 0, 2));
  expect(hit?.source).toBe('inner'); expect(hit?.distance).toBe(1);
  const point = hit?.point.toArray(), normal = hit?.normal.toArray();
  expect(collider.castSegment(new Vector3(0, 0, 30), new Vector3(0, 0, 20))).toBeNull();
  expect(collider.castSegment(new Vector3(10, 0, 30), new Vector3(10, 0, -30))?.distance).toBe(20);
  expect(hit?.point.toArray()).toEqual(point); expect(hit?.normal.toArray()).toEqual(normal);
  expect(() => collider.castSegment(new Vector3(NaN, 0, 0), new Vector3())).toThrow('Nonfinite');
  collider.dispose(); enclosing.dispose(); inner.dispose();
});

test('finite segment reports first actual transformed facet and preserves hidden-face provenance', () => {
  const plane = triangle([-2, -2, 0, 2, -2, 0, 0, 2, 0]);
  const collider = createStickerCollision([
    { geometry: plane, source: 'hidden-bottom', kind: 'surface' },
    { geometry: plane, transform: new Matrix4().makeTranslation(0, 0, 2), source: 'outer', kind: 'surface' },
  ]);
  const hit = collider.castSegment(new Vector3(0, 0, 5), new Vector3(0, 0, -1));
  expect(hit?.source).toBe('outer'); expect(hit?.point.z).toBe(2); expect(hit?.distance).toBe(3);
  expect(collider.castSegment(new Vector3(0, 0, 5), new Vector3(0, 0, 3))).toBeNull();
  // Through a missing outer opening, earliest contact alone cannot label adhesive support.
  expect(collider.castSegment(new Vector3(0, 0, 1), new Vector3(0, 0, -1))?.source).toBe('hidden-bottom');
  expect(collider.stats.triangleCount).toBe(2); expect(collider.stats.typedBytes).toBe(224);
  collider.dispose(); plane.dispose();
});

test('complete triangle query detects collider edges crossing an otherwise external sheet triangle', () => {
  const body = new BoxGeometry(2, 2, 2);
  const collider = createStickerCollision([{ geometry: body, source: 'body', kind: 'surface' }]);
  // All query vertices and edges lie outside the box; its face interiors still cut the box.
  expect(collider.intersectsTriangle(new Vector3(-10, -10, 0), new Vector3(10, -10, 0), new Vector3(0, 10, 0))).toBe(true);
  expect(collider.intersectsTriangle(new Vector3(-10, -10, 3), new Vector3(10, -10, 3), new Vector3(0, 10, 3))).toBe(false);
  // Document the required exterior-start invariant: wholly-inside is not surface intersection.
  expect(collider.intersectsTriangle(new Vector3(0, 0, 0), new Vector3(.1, 0, 0), new Vector3(0, .1, 0))).toBe(false);
  collider.dispose(); body.dispose();
});

test('coplanar contact, separated triangles and bridge provenance remain explicit', () => {
  const plane = triangle([0, 0, 0, 4, 0, 0, 0, 4, 0]);
  const collider = createStickerCollision([{ geometry: plane, source: 'seam-endpoints', kind: 'bridge' }]);
  expect(collider.intersectsTriangle(new Vector3(.1, .1, 0), new Vector3(.2, .1, 0), new Vector3(.1, .2, 0))).toBe(true);
  expect(collider.intersectsTriangle(new Vector3(10, 10, 0), new Vector3(11, 10, 0), new Vector3(10, 11, 0))).toBe(false);
  expect(collider.castSegment(new Vector3(1, 1, 1), new Vector3(1, 1, -1))?.kind).toBe('bridge');
  collider.dispose(); plane.dispose();
});

test('disposal releases owned data, rejects reuse and never disposes borrowed geometry', () => {
  const geometry = new BoxGeometry(2, 2, 2); let disposed = 0;
  geometry.addEventListener('dispose', () => disposed++);
  const collider = createStickerCollision([{ geometry, source: 'borrowed', kind: 'surface' }]);
  collider.dispose(); collider.dispose(); expect(disposed).toBe(0);
  expect(() => collider.castSegment(new Vector3(), new Vector3(1, 0, 0))).toThrow('disposed');
  expect(() => collider.intersectsTriangle(new Vector3(), new Vector3(1, 0, 0), new Vector3(0, 1, 0))).toThrow('disposed');
  geometry.dispose(); expect(disposed).toBe(1);
});

test('nearest support excludes unapproved hidden facets even when closer', () => {
  const plane = triangle([-2, -2, 0, 2, -2, 0, 0, 2, 0]);
  const collider = createStickerCollision([
    { geometry: plane, source: 'approved-outer', kind: 'surface', adhesiveSupport: true },
    { geometry: plane, transform: new Matrix4().makeTranslation(0, 0, .5), source: 'unclassified', kind: 'surface' },
  ]);
  expect(collider.closestApprovedSupport(new Vector3(0, 0, 1), 2)?.source).toBe('approved-outer');
  expect(collider.closestApprovedSupport(new Vector3(0, 0, 1), .75)).toBeNull();
  expect(collider.closestApprovedSupport(new Vector3(0, 0, -1), 2)?.signedDistance).toBe(-1);
  collider.dispose(); plane.dispose();
});

test('warm facet queries remain exact across deterministic face crossings and resource invalidation', () => {
  const geometry = new BoxGeometry(10, 12, 14, 4, 4, 4);
  const collider = createStickerCollision([{ geometry, source: 'box-exterior', kind: 'surface', adhesiveSupport: true }]);
  const query = collider.createSupportQuery(); let seed = 1234567;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
  for (let i = 0; i < 200; i++) {
    const point = new Vector3((random() - .5) * 30, (random() - .5) * 30, (random() - .5) * 30);
    const cold = collider.closestApprovedSupport(point, 100), warm = query.sample(point, 100);
    expect(warm?.distance).toBeCloseTo(cold?.distance ?? -1, 11);
    expect(warm?.point.distanceTo(cold?.point ?? new Vector3(Infinity, 0, 0))).toBeLessThan(1e-10);
    expect(warm?.source).toBe(cold?.source);
  }
  query.dispose(); expect(() => query.sample(new Vector3(), 100)).toThrow('disposed');
  const other = collider.createSupportQuery(); collider.dispose();
  expect(() => other.sample(new Vector3(), 100)).toThrow('disposed');
  other.dispose(); geometry.dispose();
});

test('actual long rear facet admits roundoff at its edge without filling a geometric gap', () => {
  const geometry = triangle([158.96742248535156,250,-25.964189529418945,159.23223876953125,250,-25.483020782470703,159.23223876953125,-250,-25.483020782470703]);
  const collider = createStickerCollision([{ geometry, source:'actual rear edge', kind:'surface' }]);
  const start = new Vector3(224.3351308892041,197.30766549398962,-61.22874684263272);
  const end = new Vector3(159.21470753498485,197.30766549398962,-25.47339499339762);
  const hit = collider.castSegment(start,end);
  expect(hit?.source).toBe('actual rear edge');
  expect(hit?.point.distanceTo(new Vector3(159.23223876953125,197.30766549398962,-25.483020782470703))).toBeLessThan(1e-10);
  collider.dispose(); geometry.dispose();
  const flat = triangle([0,0,0,1,0,0,0,1,0]);
  const bounded = createStickerCollision([{ geometry:flat, source:'bounded', kind:'surface' }]);
  expect(bounded.castSegment(new Vector3(.5,-1e-7,1),new Vector3(.5,-1e-7,-1))).toBeNull();
  expect(bounded.castSegment(new Vector3(.5,0,1),new Vector3(.5,0,-1))?.source).toBe('bounded');
  expect(bounded.castSegment(new Vector3(0,0,0),new Vector3(1,0,0))).toBeNull();
  bounded.dispose(); flat.dispose();
});
