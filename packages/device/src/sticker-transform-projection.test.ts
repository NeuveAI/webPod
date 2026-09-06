import { expect, test } from 'bun:test';
import { Group, Mesh, MeshBasicMaterial, OrthographicCamera, PerspectiveCamera, PlaneGeometry, Vector3 } from 'three';
import { captureStickerTransformPlane, stickerProjectedQuad } from './sticker-transform-projection';
import { DEVICE_LAYOUT } from './layout';
function present<T>(value: T | null | undefined): T { if (value == null) throw new Error('Expected valid projection'); return value; }
const canvas = { left: 17, top: 29, width: 900, height: 700 };
function fixture(perspective = true) {
  const content = new Group(); const mesh = new Mesh(new PlaneGeometry(30, 20, 2, 2), new MeshBasicMaterial());
  content.add(mesh);
  const camera = perspective ? new PerspectiveCamera(40, 900 / 700, 1, 1000) : new OrthographicCamera(-100, 100, 80, -80, 1, 1000);
  camera.position.z = 300; camera.updateMatrixWorld();
  return { content, mesh, camera };
}
function screen(point: Vector3, content: Group, camera: PerspectiveCamera | OrthographicCamera) {
  content.updateWorldMatrix(true, true); camera.updateMatrixWorld();
  const p = point.clone().applyMatrix4(content.matrixWorld).project(camera);
  return { x: canvas.left + (p.x + 1) * canvas.width / 2, y: canvas.top + (1 - p.y) * canvas.height / 2 };
}
test('quad follows UV artwork order and real pose, including edge midpoint under perspective', () => {
  const { content, mesh, camera } = fixture();
  const first = present(stickerProjectedQuad(mesh, camera, canvas));
  expect(first.corners[0].x).toBeLessThan(first.corners[1].x);
  expect(first.corners[0].y).toBeLessThan(first.corners[3].y);
  content.rotation.set(.2, .5, .7);
  const quad = present(stickerProjectedQuad(mesh, camera, canvas));
  const expected = [new Vector3(-15, 10, 0), new Vector3(15, 10, 0), new Vector3(15, -10, 0), new Vector3(-15, -10, 0)];
  expected.forEach((p, i) => { const s = screen(p, content, camera); expect(present(quad.corners[i]).x).toBeCloseTo(s.x); expect(present(quad.corners[i]).y).toBeCloseTo(s.y); });
  expect(quad.edges[0].x).toBeCloseTo(screen(new Vector3(0, 10, 0), content, camera).x);
  mesh.geometry.dispose(); mesh.material.dispose();
});
test('frozen plane roundtrips real perspective and orthographic poses, including outboard pointers', () => {
  for (const perspective of [true, false]) {
    const { content, mesh, camera } = fixture(perspective); content.rotation.set(.2, .45, -.6); content.position.set(12, -8, 3);
    const plane = present(captureStickerTransformPlane(content, camera, canvas, -3));
    for (const point of [new Vector3(0, 0, -3), new Vector3(110, -130, -3), new Vector3(-90, 100, -3)]) {
      const s = screen(point, content, camera); const rear = present(plane.project(s.x, s.y));
      expect(rear.x).toBeCloseTo(.5 - point.x / DEVICE_LAYOUT.body.width, 8);
      expect(rear.y).toBeCloseTo(.5 - point.y / DEVICE_LAYOUT.body.height, 8);
    }
    const input = screen(new Vector3(10, 10, -3), content, camera); const before = plane.project(input.x, input.y);
    content.position.x += 100; camera.position.x += 50;
    expect(plane.project(input.x, input.y)).toEqual(before);
    expect(plane.project(NaN, 1)).toBeNull(); mesh.geometry.dispose(); mesh.material.dispose();
  }
});
test('invalid and edge-on geometry or inverse rays fail closed', () => {
  const { content, mesh, camera } = fixture(false);
  expect(stickerProjectedQuad(mesh, camera, { ...canvas, width: 0 })).toBeNull();
  content.position.z = 400; expect(stickerProjectedQuad(mesh, camera, canvas)).toBeNull(); content.position.z = 0;
  content.rotation.y = Math.PI / 2;
  expect(stickerProjectedQuad(mesh, camera, canvas)).toBeNull();
  expect(captureStickerTransformPlane(content, camera, canvas, 0)?.project(467, 379)).toBeNull();
  expect(captureStickerTransformPlane(content, camera, { ...canvas, left: Infinity }, 0)).toBeNull();
  content.scale.x = 0; expect(captureStickerTransformPlane(content, camera, canvas, 0)).toBeNull();
  mesh.geometry.dispose(); mesh.material.dispose();
});

test('actual rear geometry preserves artwork corners and clockwise physical angle across the branch cut', async () => {
  const { createStickerSurfaceGeometry } = await import('./sticker-surface');
  const { BufferGeometry } = await import('three');
  const rear = new BufferGeometry();
  const geometry = createStickerSurfaceGeometry({ id: 'test', url: '', width: 100, height: 100, visibleBounds: [0, 0, 100, 100] }, { stickerId: 'test', surface: 'back', x: .5, y: .5, width: .15, rotationDeg: 0 }, rear);
  const mesh = new Mesh(geometry, new MeshBasicMaterial()); const content = new Group(); content.add(mesh);
  const camera = new PerspectiveCamera(40, 900 / 700, 1, 1000); camera.position.z = -300; camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const quad = present(stickerProjectedQuad(mesh, camera, canvas));
  expect(quad.corners[0].x).toBeLessThan(quad.corners[1].x);
  expect(quad.corners[0].y).toBeLessThan(quad.corners[3].y);
  content.rotation.set(.1, .35, .4);
  const depth = geometry.getAttribute('position').getZ(Math.floor(geometry.getAttribute('position').count / 2));
  const plane = present(captureStickerTransformPlane(content, camera, canvas, depth));
  const angles = [179, -179].map(degrees => {
    const angle = degrees * Math.PI / 180;
    const s = screen(new Vector3(-20 * Math.cos(angle), -20 * Math.sin(angle), depth), content, camera);
    const p = present(plane.project(s.x, s.y));
    return Math.atan2((p.y - .5) * DEVICE_LAYOUT.body.height, (p.x - .5) * DEVICE_LAYOUT.body.width);
  });
  const delta = Math.atan2(Math.sin(present(angles[1]) - present(angles[0])), Math.cos(present(angles[1]) - present(angles[0])));
  expect(delta * 180 / Math.PI).toBeCloseTo(2, 8);
  geometry.dispose(); rear.dispose(); mesh.material.dispose();
});

test('captures DOMRect prototype getters explicitly and keeps their values frozen', () => {
  class BrowserRect {
    offset = 0;
    get left() { return canvas.left + this.offset; }
    get top() { return canvas.top; }
    get width() { return canvas.width; }
    get height() { return canvas.height; }
  }
  const rect = new BrowserRect();
  const { content, mesh, camera } = fixture();
  const plane = present(captureStickerTransformPlane(content, camera, rect, 0));
  const point = new Vector3(12, -17, 0); const input = screen(point, content, camera);
  const projected = present(plane.project(input.x, input.y));
  expect(projected.x).toBeCloseTo(.5 - point.x / DEVICE_LAYOUT.body.width, 8);
  expect(projected.y).toBeCloseTo(.5 - point.y / DEVICE_LAYOUT.body.height, 8);
  rect.offset = 100;
  expect(plane.project(input.x, input.y)).toEqual(projected);
  rect.offset = Infinity;
  expect(captureStickerTransformPlane(content, camera, rect, 0)).toBeNull();
  expect(stickerProjectedQuad(mesh, camera, rect)).toBeNull();
  mesh.geometry.dispose(); mesh.material.dispose();
});
