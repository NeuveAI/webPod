import { expect, test } from 'bun:test';
import { Euler, Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { fitStickerDrop, stickerDropHardwareClear } from './sticker-drop-fit';
import { createStickerRearChart } from './sticker-rear-chart';
import { DEFAULT_DEVICE_FORM } from './form';
import { DEVICE_LAYOUT } from './layout';
import { sampleStickerSurfaceGrid } from './sticker-surface';
import { DEVICE_TOP_CONTROLS, DEVICE_DOCK_CONNECTOR } from './top-controls';

test('release fit follows the grabbed UV through pitch, yaw and roll, including legal edge seats', () => {
  const wrap = createStickerRearChart(DEFAULT_DEVICE_FORM), canvas = { left: 14, top: 20, width: 900, height: 800 };
  const art = { id: 'test', url: '', width: 100, height: 100, visibleBounds: [0, 0, 100, 100] as const };
  const camera = new PerspectiveCamera(40, 900 / 800, 1, 3000); camera.position.set(0, 0, 1000); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  for (const yaw of [2.5, Math.PI, 3.6]) for (const edge of [.16, .84]) {
    const world = new Matrix4().makeRotationFromEuler(new Euler(.2, yaw, .3));
    const desired = { stickerId: art.id, surface: 'back' as const, x: edge, y: .35, width: .28, rotationDeg: 23 };
    const uv = [.24, .71] as const, size = desired.width * DEVICE_LAYOUT.body.width, angle = desired.rotationDeg * Math.PI / 180;
    const screenPoint = (placement: typeof desired) => {
      const cage = wrap.cornerCage((.5 - placement.x) * DEVICE_LAYOUT.body.width, (.5 - placement.y) * DEVICE_LAYOUT.body.height, { width: size, height: size, angle });
      const point = sampleStickerSurfaceGrid(cage.point, size, size, angle, uv[0], 1 - uv[1]).applyMatrix4(world).project(camera);
      return { x: canvas.left + (point.x + 1) * canvas.width / 2, y: canvas.top + (1 - point.y) * canvas.height / 2 };
    };
    const target = screenPoint(desired), initial = { ...desired, x: .5, y: .5 };
    const fitted = fitStickerDrop(art, initial, uv, target, canvas, world, camera, wrap), actual = screenPoint(fitted);
    expect(Math.hypot(actual.x - target.x, actual.y - target.y)).toBeLessThan(.1);
    expect(fitted.width).toBe(desired.width); expect(fitted.rotationDeg).toBe(23);
  }
});

test('all three hardware areas exclude print while the intervening steel remains usable', () => {
  const wrap = createStickerRearChart(DEFAULT_DEVICE_FORM);
  for (const [x, z, side] of [[DEVICE_TOP_CONTROLS.hold.x, 0, 1], [DEVICE_TOP_CONTROLS.jack.x, 0, 1], [DEVICE_DOCK_CONNECTOR.x, 2, -1]]) {
    if (x === undefined || z === undefined || side === undefined) throw new Error('Missing hardware');
    const center = wrap.materialAt(x, side * DEVICE_LAYOUT.body.height / 2, z);
    expect(stickerDropHardwareClear(wrap, center, 10, 10, .3)).toBe(false);
  }
  expect(stickerDropHardwareClear(wrap, { x: 0, y: 0 }, 100, 100, 0)).toBe(true);
  const between = wrap.materialAt(25, DEVICE_LAYOUT.body.height / 2, 0);
  expect(stickerDropHardwareClear(wrap, between, 10, 10, 0)).toBe(true);
});

test('a release over the hold switch resolves to legal steel without changing size', () => {
  const wrap = createStickerRearChart(DEFAULT_DEVICE_FORM), canvas = { left: 0, top: 0, width: 900, height: 800 };
  const art = { id: 'test', url: '', width: 100, height: 100, visibleBounds: [0, 0, 100, 100] as const };
  const camera = new PerspectiveCamera(40, 900 / 800, 1, 3000); camera.position.set(0, 900, -500); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const initial = { stickerId: art.id, surface: 'back' as const, x: .8, y: .02, width: .12, rotationDeg: 0 };
  const hardware = new Vector3(DEVICE_TOP_CONTROLS.hold.x, DEVICE_LAYOUT.body.height / 2, DEVICE_TOP_CONTROLS.hold.z).project(camera);
  const fitted = fitStickerDrop(art, initial, [.5, .5], { x: (hardware.x + 1) * canvas.width / 2, y: (1 - hardware.y) * canvas.height / 2 }, canvas, new Matrix4(), camera, wrap);
  const size = fitted.width * DEVICE_LAYOUT.body.width, seat = wrap.fit((.5 - fitted.x) * DEVICE_LAYOUT.body.width, (.5 - fitted.y) * DEVICE_LAYOUT.body.height, { width: size, height: size, angle: 0 });
  expect(stickerDropHardwareClear(wrap, seat.center, size, size, 0)).toBe(true);
  expect(fitted.width).toBe(initial.width);
  expect(Math.abs(seat.x - (.5 - fitted.x) * DEVICE_LAYOUT.body.width)).toBeLessThan(.0001);
  expect(Math.abs(seat.y - (.5 - fitted.y) * DEVICE_LAYOUT.body.height)).toBeLessThan(.0001);
});
