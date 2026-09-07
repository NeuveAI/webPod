import { expect, test } from 'bun:test';
import { PlaneGeometry, Vector3 } from 'three';
import { createStickerWrapSurface } from './sticker-wrap';
import { DEFAULT_DEVICE_FORM } from './form';
import { DEVICE_LAYOUT } from './layout';

function fixture() {
  // Synthetic complete front support isolates chart/root continuity; actual
  // assembly fidelity is covered by the native source-bound captures.
  const front = new PlaneGeometry(330, 552); front.translate(0, 0, DEVICE_LAYOUT.body.depth / 2);
  return { front, wrap: createStickerWrapSurface(DEFAULT_DEVICE_FORM, [{ geometry: front }]) };
}
test('steel chart retains flat artwork and fits legacy edge centers behind the seam', () => {
  const { front, wrap } = fixture();
  for (const [x, y] of [[0, 0], [0, 100], [100, 0], [156.09, 266.616], [165, 0], [0, 276], [-156.09, -266.616]]) {
    if (x === undefined || y === undefined) throw new Error('Missing fixture center');
    const cage = wrap.cornerCage(x, y, { width: 115.5, height: 228.32284768211915, angle: 0 }), root = cage.point(0, 0);
    const fitted = wrap.fit(x, y, { width: 115.5, height: 228.32284768211915, angle: 0 });
    expect(root.x).toBeCloseTo(fitted.x, 6); expect(root.y).toBeCloseTo(fitted.y, 6);
    expect(root.z).toBeLessThan(wrap.seamZ);
  }
  const flat = wrap.cornerCage(0, 100, { width: 115.5, height: 228.32284768211915, angle: 0 });
  for (const dx of [-57, 0, 57]) for (const dy of [-114, 0, 114]) expect(flat.point(dx, dy).distanceTo(new Vector3(dx, 100 + dy, -DEVICE_LAYOUT.body.depth / 2))).toBeLessThan(1e-6);
  front.dispose();
});
test('tangencies and full-perimeter wrap seam do not select another mapping', () => {
  const { front, wrap } = fixture();
  for (const [x, y, axis] of [[156.09, 250, 'y'], [139, 266.616, 'x'], [0, 266.616, 'x'], [156.09, 0, 'y']] as const) {
    const before = wrap.cornerCage(x - (axis === 'x' ? .0001 : 0), y - (axis === 'y' ? .0001 : 0), { width: 115.5, height: 228.32284768211915, angle: 0 });
    const after = wrap.cornerCage(x + (axis === 'x' ? .0001 : 0), y + (axis === 'y' ? .0001 : 0), { width: 115.5, height: 228.32284768211915, angle: 0 });
    for (const dx of [-57, 0, 57]) for (const dy of [-114, 0, 114]) {
      const a = before.point(dx, dy), b = after.point(dx, dy);
      expect([a.x, a.y, a.z, b.x, b.y, b.z].every(Number.isFinite)).toBe(true);
      expect(a.distanceTo(b)).toBeLessThan(.01);
    }
  }
  front.dispose();
});

test('initial child geometry uses explicit sampler before effect setup; replay and stale cleanup retain ownership', async () => {
  const { BufferGeometry } = await import('three');
  const { bindStickerWrapSurface, stickerWrapSurface } = await import('./sticker-wrap');
  const { createStickerSurfaceGeometry } = await import('./sticker-surface');
  const { front, wrap } = fixture(), rear = new BufferGeometry();
  expect(stickerWrapSurface(rear)).toBeUndefined();
  const geometry = createStickerSurfaceGeometry({ id: 'fixture', url: '', width: 100, height: 100, visibleBounds: [0, 0, 100, 100] }, { stickerId: 'fixture', surface: 'back', x: 0, y: .5, width: .2, rotationDeg: 0 }, rear, wrap);
  expect(stickerWrapSurface(rear)).toBeUndefined(); // No render-phase publication.
  expect(geometry.boundingBox?.max.z).toBeGreaterThan(0);
  const cleanup = bindStickerWrapSurface(rear, wrap); expect(stickerWrapSurface(rear)).toBe(wrap);
  cleanup(); expect(stickerWrapSurface(rear)).toBeUndefined();
  const replayCleanup = bindStickerWrapSurface(rear, wrap); expect(stickerWrapSurface(rear)).toBe(wrap);
  cleanup(); expect(stickerWrapSurface(rear)).toBe(wrap); // Old cleanup cannot remove a newer same-sampler binding.
  replayCleanup(); expect(stickerWrapSurface(rear)).toBeUndefined();
  geometry.dispose(); rear.dispose(); front.dispose();
});

test('legacy front-carry centers relocate onto complete steel-only meshes, including the opposite-edge crash', async () => {
  const { BufferGeometry } = await import('three');
  const { getSticker } = await import('@webpod/stickers');
  const { createStickerSurfaceGeometry } = await import('./sticker-surface');
  const { default: trajectory } = await import('./__fixtures__/sticker-front-carry-centers.json');
  const { front, wrap } = fixture(), rear = new BufferGeometry(), art = getSticker('PW-C03');
  if (art === undefined) throw new Error('Missing original catalogue artwork');
  const crash = { x: .314332653716106, y: .0205851851589971 };
  const cases = [
    ...trajectory.centers.map(p => ({ ...p, rotationDeg: 0 })),
    ...[-.01, 0, .01].flatMap(delta => [-.1, 0, .1, 27, 45, 90, 173].map(rotationDeg => ({ x: crash.x + delta / 330, y: crash.y, rotationDeg }))),
  ];
  for (const pose of cases) {
    const geometry = createStickerSurfaceGeometry(art, { stickerId: art.id, surface: 'back', width: .35, wear: 1, ...pose }, rear, wrap);
    const positions = geometry.getAttribute('position'), indices = geometry.index;
    expect(positions.count).toBe(97 * 97);
    expect(indices?.count).toBe(96 * 96 * 6);
    expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
    const bounds = geometry.boundingBox;
    if (bounds === null) throw new Error('Missing shown geometry bounds');
    expect(bounds.min.x).toBeGreaterThanOrEqual(-165.2);
    expect(bounds.max.x).toBeLessThanOrEqual(165.2);
    geometry.dispose();
  }
  rear.dispose(); front.dispose();
});

test('fitted flat regions retain the exact artwork metric', () => {
  const { front, wrap } = fixture();
  const cage = wrap.cornerCage(-100, 200, { width: 115.5, height: 228.32284768211915, angle: 173 * Math.PI / 180 });
  const fitted = wrap.fit(-100, 200, { width: 115.5, height: 228.32284768211915, angle: 173 * Math.PI / 180 });
  for (const dx of [-20, 0, 70]) for (const dy of [-80, 0, 40]) {
    expect(cage.point(dx, dy).distanceTo(new Vector3(fitted.x + dx, fitted.y + dy, -DEVICE_LAYOUT.body.depth / 2))).toBeLessThan(1e-6);
  }
  front.dispose();
});
