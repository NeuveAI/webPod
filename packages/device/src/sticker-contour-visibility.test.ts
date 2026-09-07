import { expect, test } from 'bun:test';
import { BufferGeometry, Mesh, MeshPhysicalMaterial, OrthographicCamera, Matrix4, Group } from 'three';
import { createStickerDamageField } from './sticker-alpha';
import { createStickerSurfaceGeometry } from './sticker-surface';
import { projectStickerContourField, stickerAlphaContours } from './sticker-contour';

test('visible endpoints with a hidden middle become open shell-clipped spans', () => {
  const width = 16, pixels = new Uint8Array(width * width).fill(255);
  const field = createStickerDamageField({ width, height: width, pixels }, 'rectangle');
  expect(stickerAlphaContours(field, 0)[0]).toHaveLength(4);
  const rear = new BufferGeometry(), geometry = createStickerSurfaceGeometry({ id: 'rectangle', url: '', width, height: width, visibleBounds: [0, 0, width, width] }, { stickerId: 'rectangle', surface: 'back', x: .5, y: .5, width: .2, rotationDeg: 0 }, rear);
  const material = new MeshPhysicalMaterial(), print = new Mesh(geometry, material), camera = new OrthographicCamera(-100, 100, 100, -100, 1, 1000);
  camera.position.z = -300; camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const canvas = { left: 0, top: 0, width: 400, height: 400 };
  const result = projectStickerContourField(print, camera, canvas, field, 0, point => Math.abs(point.x) > 6);
  expect(result).not.toBeNull(); expect(result?.paths.length).toBeGreaterThan(1);
  expect(result?.closed?.every(value => !value)).toBe(true);
  // All four alpha corners remain visible, so endpoint-only clipping would fail.
  expect(result?.anchorVisible).toEqual([true, true, true, true]);
  for (const path of result?.paths ?? []) for (let i = 1; i < path.length; i++) expect(Math.abs((path[i]?.x ?? 0) - (path[i - 1]?.x ?? 0))).toBeLessThan(4);
  geometry.dispose(); material.dispose(); rear.dispose();
});

test('one-result contour cache skips identical rays and invalidates source, pose, wear and occlusion changes', () => {
  const pixels = new Uint8Array(16 * 16).fill(255), field = createStickerDamageField({ width: 16, height: 16, pixels }, 'cache');
  const rear = new BufferGeometry(), geometry = createStickerSurfaceGeometry({ id: 'cache', url: '', width: 16, height: 16, visibleBounds: [0, 0, 16, 16] }, { stickerId: 'cache', surface: 'back', x: .5, y: .5, width: .2, rotationDeg: 0 }, rear);
  const material = new MeshPhysicalMaterial(), print = new Mesh(geometry, material), camera = new OrthographicCamera(-100, 100, 100, -100, 1, 1000);
  camera.position.z = -300; camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const canvas = { left: 0, top: 0, width: 400, height: 400 }, occlusion = { identity: {}, revision: 1, contentMatrix: new Matrix4().elements };
  const content = new Group(); content.add(print);
  let rays = 0, hidden = false, wear = 0;
  const visible = () => { rays++; return !hidden; };
  const query = () => projectStickerContourField(print, camera, canvas, field, wear, visible, occlusion);
  const first = query(); expect(first).not.toBeNull();
  let before = rays; expect(query()).toBe(first); expect(rays).toBe(before);
  for (const mutate of [
    () => { geometry.getAttribute('position').needsUpdate = true; },
    () => { geometry.setAttribute('position', geometry.getAttribute('position').clone()); },
    () => { const index = geometry.index; if (index) geometry.setIndex(index.clone()); },
    () => { print.position.x += 2; },
    () => { camera.position.x += 2; },
    () => { camera.zoom = 1.1; camera.updateProjectionMatrix(); },
    () => { canvas.left += 3; },
    () => { wear = .2; },
    () => { occlusion.revision++; },
    () => { occlusion.identity = {}; },
    () => { content.position.x += 10; print.position.x -= 10; content.updateWorldMatrix(true, true); occlusion.contentMatrix = content.matrixWorld.elements; hidden = true; },
  ]) {
    mutate(); before = rays; const result = query(); expect(rays).toBeGreaterThan(before);
    before = rays; expect(query()).toBe(result); expect(rays).toBe(before);
  }
  hidden = true; occlusion.revision++; expect(query()).toBeNull(); before = rays; expect(query()).toBeNull(); expect(rays).toBe(before);
  geometry.dispose(); material.dispose(); rear.dispose();
});
