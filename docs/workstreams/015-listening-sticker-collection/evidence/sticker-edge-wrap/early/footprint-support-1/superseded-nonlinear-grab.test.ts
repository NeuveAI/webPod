import { expect, test } from 'bun:test';
import { Group, OrthographicCamera, Vector2, Vector3 } from 'three';
import { captureStickerSurfaceGrab } from './sticker-surface-grab';

const art = { id: 'test', url: '/test.png', width: 100, height: 100, visibleBounds: [0, 0, 100, 100] as const };
const placement = { stickerId: 'test', surface: 'back' as const, x: .5, y: .5, width: .2, rotationDeg: 0 };
test('actual UV offset survives first threshold and the projected center inverse', () => {
  const content = new Group(), camera = new OrthographicCamera(-200, 200, 300, -300, 1, 2000);
  camera.position.z = -1000; camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const rect = { left: 11, top: 17, width: 400, height: 600 }, canvas = { getBoundingClientRect: () => rect };
  const wrap = { cornerCage(x: number, y: number) { return { point(dx: number, dy: number) { return new Vector3(x + dx, y + dy, -28); } }; } };
  const uv = new Vector2(.8, .3), material = new Vector3(-19.8, -13.2, -28.18);
  const screen = (point: Vector3) => { const p = point.clone().project(camera); return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 }; };
  const pointer = screen(material); let current = true;
  const grab = captureStickerSurfaceGrab(placement, art, uv, pointer, content, camera, canvas, wrap, () => current);
  expect(grab).not.toBeNull(); expect(grab?.projectCenter(pointer.x, pointer.y)).toEqual({ x: .5, y: .5 });
  const moved = screen(material.clone().add(new Vector3(12, 8, 0)));
  const center = grab?.projectCenter(moved.x, moved.y);
  expect(center?.x).toBeCloseTo(.5 - 12 / 330, 6); expect(center?.y).toBeCloseTo(.5 - 8 / 552, 6);
  expect(grab?.isValid()).toBe(true); current = false; expect(grab?.isValid()).toBe(false);
  expect(grab?.projectCenter(moved.x, moved.y)).toBeNull();
});
test('viewport and content pose changes cancel a captured mapping', () => {
  const content = new Group(), camera = new OrthographicCamera(-200, 200, 300, -300, 1, 2000);
  camera.position.z = -1000; camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const rect = { left: 0, top: 0, width: 400, height: 600 }, canvas = { getBoundingClientRect: () => rect };
  const wrap = { cornerCage(x: number, y: number) { return { point(dx: number, dy: number) { return new Vector3(x + dx, y + dy, -28); } }; } };
  const grab = captureStickerSurfaceGrab(placement, art, new Vector2(.5, .5), { x: 200, y: 300 }, content, camera, canvas, wrap, () => true);
  expect(grab?.isValid()).toBe(true); rect.width = 375; expect(grab?.isValid()).toBe(false);
  rect.width = 400; content.rotation.y = .01; expect(grab?.isValid()).toBe(false);
});

test('cold off-rear admission converges after 64px without warming the inverse during peel', async () => {
  const { Matrix4, PerspectiveCamera, PlaneGeometry } = await import('three');
  const { createStickerWrapSurface } = await import('./sticker-wrap');
  const { sampleStickerSurfaceGrid, stickerVisibleAspect } = await import('./sticker-surface');
  const { DEFAULT_DEVICE_FORM } = await import('./form');
  const { getSticker } = await import('@webpod/stickers');
  const { default: cameras } = await import('./__fixtures__/sticker-grab-cameras.json');
  // Actual native camera/body matrices and painted UVs. A complete planar
  // front support isolates inverse admission from assembly tessellation.
  const front = new PlaneGeometry(330, 552); front.translate(0, 0, 28.033981);
  const wrap = createStickerWrapSurface(DEFAULT_DEVICE_FORM, [{ geometry: front }]);
  const art = getSticker('PW-C03'); if (art === undefined) throw new Error('Missing C03 fixture');
  const placement = { stickerId: art.id, surface: 'back' as const, x: .027, y: .017, width: .35, rotationDeg: 0, wear: 1 };
  const width = 115.5, height = width * stickerVisibleAspect(art);
  for (const fixture of cameras) {
    const content = new Group(); content.matrixAutoUpdate = false;
    content.matrix.fromArray(fixture.matrices.contentWorld); content.updateMatrixWorld(true);
    const camera = new PerspectiveCamera(); camera.matrixAutoUpdate = false;
    camera.matrix.fromArray(fixture.matrices.cameraWorld); camera.updateMatrixWorld(true);
    camera.projectionMatrix.fromArray(fixture.matrices.cameraProjection); camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    const matrix = new Matrix4().copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse).multiply(content.matrixWorld);
    const rect = fixture.rect, uv = new Vector2(fixture.uv[0], fixture.uv[1]);
    const [left, top, right, bottom] = art.visibleBounds;
    const u = (uv.x * art.width - left) / (right - left), v = ((1 - uv.y) * art.height - top) / (bottom - top);
    const screen = (x: number, y: number) => {
      const cage = wrap.cornerCage((.5 - x) * 330, (.5 - y) * 552, { width, height, angle: 0 });
      const p = sampleStickerSurfaceGrid(cage.point, width, height, 0, u, v).applyMatrix4(matrix);
      return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
    };
    // This synthetic-front inverse regression uses a legal target far enough
    // from pickup to enter the cold (>64px) phase under the current mapper.
    // Immutable native gesture coordinates remain in the evidence fixtures.
    const target = fixture.name.endsWith('front') ? { x: .7, y: .005 } : fixture.target;
    const pickup = screen(placement.x, placement.y), release = screen(target.x, target.y);
    const grab = captureStickerSurfaceGrab(placement, art, uv, pickup, content, camera, { getBoundingClientRect: () => rect }, wrap, () => true);
    expect(grab).not.toBeNull();
    const dx = release.x - pickup.x, dy = release.y - pickup.y, distance = Math.hypot(dx, dy);
    expect(distance).toBeGreaterThan(64);
    // No projectCenter call while the original sheet remains attached.
    let last: { x: number; y: number } | null = null;
    for (let step = 1; step <= 24; step++) {
      const travel = 12 + (distance - 12) * step / 24;
      if (travel <= 64) continue;
      const point = { x: pickup.x + dx / distance * travel, y: pickup.y + dy / distance * travel };
      last = grab?.projectCenter(point.x, point.y) ?? null;
      expect(last).not.toBeNull();
      if (last !== null) { const shown = screen(last.x, last.y); expect(Math.hypot(shown.x - point.x, shown.y - point.y)).toBeLessThan(.5); }
    }
    expect(Math.abs((last?.x ?? Infinity) - target.x)).toBeLessThan(.02);
    expect(Math.abs((last?.y ?? Infinity) - target.y)).toBeLessThan(.02);
    expect(grab?.projectCenter(-10000, -10000)).toBeNull();
    // A rejected target must not publish an invalid warm start.
    expect(grab?.projectCenter(release.x, release.y)).not.toBeNull();
    content.rotation.y = .01; content.matrixAutoUpdate = true; content.updateMatrixWorld(true);
    expect(grab?.isValid()).toBe(false);
  }
  front.dispose();
});
