import { expect, test } from 'bun:test';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, OrthographicCamera, PerspectiveCamera, PlaneGeometry, Raycaster, Vector2, Vector3 } from 'three';
import { captureStickerSurfaceGrab } from './sticker-surface-grab';

const art = { id: 'test', url: '/test.png', width: 100, height: 100, visibleBounds: [0, 0, 100, 100] as const };
const placement = { stickerId: 'test', surface: 'back' as const, x: .5, y: .5, width: .2, rotationDeg: 0 };
function fixture(angle = 0) {
  const content = new Group(), camera = new OrthographicCamera(-200, 200, 300, -300, 1, 2000);
  camera.position.z = -1000; camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([-10, -10, -28, 10, -10, -28, -10, 10, -28], 3));
  geometry.setAttribute('uv', new Float32BufferAttribute([.5 + 10 / 66, .5 - 10 / 66, .5 - 10 / 66, .5 - 10 / 66, .5 + 10 / 66, .5 + 10 / 66], 2));
  const mesh = new Mesh(geometry, new MeshBasicMaterial()); mesh.rotation.y = angle; mesh.updateMatrixWorld();
  const point = new Vector3(-3, -3, -28).applyMatrix4(mesh.matrixWorld);
  const rect = { left: 11, top: 17, width: 400, height: 600 };
  const screen = (point: Vector3) => { const p = point.clone().project(camera); return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 }; };
  return { content, camera, mesh, point, rect, screen, dispose() { geometry.dispose(); mesh.material.dispose(); } };
}
test('frozen actual triangle material basis retains pickup offset and known rear delta', () => {
  const f = fixture(), pointer = f.screen(f.point); let current = true;
  const grab = captureStickerSurfaceGrab(placement, art, { object: f.mesh, point: f.point, face: { a: 0, b: 1, c: 2 } }, pointer, f.content, f.camera, { getBoundingClientRect: () => f.rect }, () => current);
  expect(grab).not.toBeNull(); expect(grab?.projectCenter(pointer.x, pointer.y)).toEqual({ x: .5, y: .5 });
  const moved = f.screen(f.point.clone().add(new Vector3(12, 8, 0))), center = grab?.projectCenter(moved.x, moved.y);
  expect(center?.x).toBeCloseTo(.5 - 12 / 330, 6); expect(center?.y).toBeCloseTo(.5 - 8 / 552, 6);
  expect(grab?.projectCenter(-10000, -10000)).toBeNull();
  expect(grab?.projectCenter(moved.x, moved.y)).toEqual(center); // No failed-query state or alternate branch.
  current = false; expect(grab?.isValid()).toBe(false); expect(grab?.projectCenter(moved.x, moved.y)).toBeNull(); f.dispose();
});
test('viewport, camera and content changes invalidate; numerical grazing cannot amplify drag', () => {
  const f = fixture(), pointer = f.screen(f.point);
  const grab = captureStickerSurfaceGrab(placement, art, { object: f.mesh, point: f.point, face: { a: 0, b: 1, c: 2 } }, pointer, f.content, f.camera, { getBoundingClientRect: () => f.rect }, () => true);
  expect(grab?.isValid()).toBe(true); f.rect.width = 375; expect(grab?.isValid()).toBe(false);
  f.rect.width = 400; f.camera.position.x = 1; expect(grab?.isValid()).toBe(false);
  f.camera.position.x = 0; f.content.rotation.y = .01; expect(grab?.isValid()).toBe(false); f.dispose();
  const grazing = fixture(Math.PI / 2 - .001);
  const start = grazing.screen(grazing.point);
  const bounded = captureStickerSurfaceGrab(placement, art, { object: grazing.mesh, point: grazing.point, face: { a: 0, b: 1, c: 2 } }, start, grazing.content, grazing.camera, { getBoundingClientRect: () => grazing.rect }, () => true);
  expect(bounded).not.toBeNull();
  const moved = bounded?.projectCenter(start.x + 1, start.y);
  expect(moved).not.toBeNull();
  expect(Math.abs((moved?.x ?? Infinity) - placement.x)).toBeLessThanOrEqual(20 / 330 + 1e-6);
  grazing.dispose();
});
test('four captured side/front camera views use a fixed affine frame from shown triangle UVs', async () => {
  const { createStickerWrapSurface } = await import('./sticker-wrap');
  const { createStickerSurfaceGeometry, sampleStickerSurfaceGrid, stickerVisibleAspect } = await import('./sticker-surface');
  const { DEFAULT_DEVICE_FORM } = await import('./form');
  const { getSticker } = await import('@webpod/stickers');
  const { default: cameras } = await import('./__fixtures__/sticker-grab-cameras.json');
  const front = new PlaneGeometry(330, 552); front.translate(0, 0, 28.033981);
  const wrap = createStickerWrapSurface(DEFAULT_DEVICE_FORM, [{ geometry: front }]), rear = new BufferGeometry();
  const art = getSticker('PW-C03'); if (art === undefined) throw new Error('Missing catalogue artwork');
  const source = { stickerId: art.id, surface: 'back' as const, x: .027, y: .017, width: .35, rotationDeg: 0, wear: 1 };
  const geometry = createStickerSurfaceGeometry(art, source, rear, wrap), mesh = new Mesh(geometry, new MeshBasicMaterial());
  for (const f of cameras) {
    const content = new Group(); content.matrixAutoUpdate = false; content.matrix.fromArray(f.matrices.contentWorld); content.add(mesh); content.updateMatrixWorld(true);
    const camera = new PerspectiveCamera(); camera.matrixAutoUpdate = false; camera.matrix.fromArray(f.matrices.cameraWorld); camera.updateMatrixWorld(true);
    camera.projectionMatrix.fromArray(f.matrices.cameraProjection); camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    const [left, top, right, bottom] = art.visibleBounds, width = 115.5, height = width * stickerVisibleAspect(art);
    const cage = wrap.cornerCage((.5 - source.x) * 330, (.5 - source.y) * 552, { width, height, angle: 0 });
    const [u, v] = f.uv;
    if (u === undefined || v === undefined) throw new Error('Missing captured UV');
    const local = sampleStickerSurfaceGrid(cage.point, width, height, 0, (u * art.width - left) / (right - left), ((1 - v) * art.height - top) / (bottom - top));
    const ndc = local.applyMatrix4(content.matrixWorld).project(camera), rect = f.rect;
    const pointer = { x: rect.left + (ndc.x + 1) * rect.width / 2, y: rect.top + (1 - ndc.y) * rect.height / 2 };
    const ray = new Raycaster(); ray.setFromCamera(new Vector2(ndc.x, ndc.y), camera);
    const hit = ray.intersectObject(mesh, false)[0]; if (hit === undefined) throw new Error('Expected visible painted triangle');
    const grab = captureStickerSurfaceGrab(source, art, hit, pointer, content, camera, { getBoundingClientRect: () => rect }, () => true);
    expect(grab).not.toBeNull(); expect(grab?.projectCenter(pointer.x, pointer.y)).toEqual({ x: source.x, y: source.y });
    // Evaluate either direction to keep this local sample inside the full rear domain.
    const sign = grab?.projectCenter(pointer.x + 2, pointer.y + 2) === null ? -1 : 1;
    const a = grab?.projectCenter(pointer.x + sign, pointer.y + sign), b = grab?.projectCenter(pointer.x + 2 * sign, pointer.y + 2 * sign);
    expect(a).not.toBeNull(); expect(b).not.toBeNull();
    expect((b?.x ?? Infinity) - source.x).toBeCloseTo(2 * ((a?.x ?? Infinity) - source.x), 10);
    expect((b?.y ?? Infinity) - source.y).toBeCloseTo(2 * ((a?.y ?? Infinity) - source.y), 10);
    expect(grab?.projectCenter(-10000, -10000)).toBeNull(); expect(grab?.projectCenter(pointer.x, pointer.y)).toEqual({ x: source.x, y: source.y });
    content.remove(mesh);
  }
  mesh.material.dispose(); geometry.dispose(); front.dispose(); rear.dispose();
});

test('translated rotated print maps its UV-oriented material delta back to rear coordinates', () => {
  const f = fixture(), angle = 37 * Math.PI / 180;
  f.mesh.rotation.z = angle; f.mesh.position.set(23, -11, 7); f.mesh.updateMatrixWorld();
  f.point.set(-3, -3, -28).applyMatrix4(f.mesh.matrixWorld);
  const start = f.screen(f.point), source = { ...placement, rotationDeg: 37 };
  const grab = captureStickerSurfaceGrab(source, art, { object: f.mesh, point: f.point, face: { a: 0, b: 1, c: 2 } }, start, f.content, f.camera, { getBoundingClientRect: () => f.rect }, () => true);
  const delta = new Vector3(12 * Math.cos(angle) - 8 * Math.sin(angle), 12 * Math.sin(angle) + 8 * Math.cos(angle), 0);
  const moved = f.screen(f.point.clone().add(delta)), center = grab?.projectCenter(moved.x, moved.y);
  expect(center?.x).toBeCloseTo(source.x - delta.x / 330, 6);
  expect(center?.y).toBeCloseTo(source.y - delta.y / 552, 6);
  f.dispose();
});
