import { expect, test } from 'bun:test';
import { BoxGeometry, Group, Matrix4, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { createStickerCollision } from './sticker-collision';
import { prepareCollisionInWorker } from './sticker-collision-preparation';
import { createStickerVisibility } from './sticker-visibility';

test('worker handoff preserves exact transformed hits, support and borrowed render buffers', async () => {
  const geometry = new BoxGeometry(2, 3, 4), transform = new Matrix4().makeRotationY(.36);
  const faces = [{ geometry, transform, source: 'steel', kind: 'surface' as const, adhesiveSupport: true }];
  const original = Array.from(geometry.getAttribute('position').array);
  const expected = createStickerCollision(faces);
  const snapshot = await prepareCollisionInWorker(faces, new AbortController().signal);
  const actual = createStickerCollision([], snapshot);
  for (let x = -2; x <= 2; x += .2) {
    const start = new Vector3(x, .1, 10), end = new Vector3(x, .1, -10);
    expect(actual.castSegment(start, end)).toEqual(expected.castSegment(start, end));
    expect(actual.closestApprovedSupport(start, 20)).toEqual(expected.closestApprovedSupport(start, 20));
  }
  expect(actual.stats).toEqual(expected.stats);
  expect(Array.from(geometry.getAttribute('position').array)).toEqual(original);
  actual.dispose(); expected.dispose(); geometry.dispose();
});

test('worker cancellation rejects without detaching live geometry', async () => {
  const geometry = new BoxGeometry(2, 2, 2, 32, 32, 32), controller = new AbortController();
  const pending = prepareCollisionInWorker([{ geometry, source: 'shell', kind: 'surface' }], controller.signal);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(geometry.getAttribute('position').array.byteLength).toBeGreaterThan(0);
  geometry.dispose();
});

test('async visibility preparation reuses pose, rejects stale assembly and cannot install after disposal', async () => {
  const root = new Group(), geometry = new BoxGeometry(2, 2, 2), material = new MeshBasicMaterial();
  const mesh = new Mesh(geometry, material); root.add(mesh);
  const visibility = createStickerVisibility();
  await visibility.prepare(root); expect(visibility.revision).toBe(1);
  root.rotation.y = .5; await visibility.prepare(root); expect(visibility.revision).toBe(1);
  mesh.position.x = 2;
  const pending = visibility.prepare(root); mesh.position.x = 3;
  await pending; expect(visibility.revision).toBe(1);
  const disposed = visibility.prepare(root); visibility.dispose(); await disposed;
  expect(visibility.revision).toBe(1);
  geometry.dispose(); material.dispose();
});
