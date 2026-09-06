import { expect, test } from 'bun:test';
import { Mesh, MeshBasicMaterial, OrthographicCamera, PlaneGeometry } from 'three';
import { stickerProjectedBounds } from './sticker-projected-bounds';
test('projected bounds follow actual transformed geometry and canvas coordinates', () => {
  const geometry = new PlaneGeometry(2, 1); const material = new MeshBasicMaterial(); const mesh = new Mesh(geometry, material);
  const camera = new OrthographicCamera(-2, 2, 2, -2, .1, 10); camera.position.z = 5;
  const canvas = { left: 10, top: 20, width: 400, height: 400 };
  expect(stickerProjectedBounds(mesh, camera, canvas)).toEqual({ left: 110, right: 310, top: 170, bottom: 270 });
  mesh.rotation.z = Math.PI / 2;
  const rotated = stickerProjectedBounds(mesh, camera, canvas);
  if (rotated === null) throw new Error('Expected visible geometry');
  expect(rotated.right - rotated.left).toBeCloseTo(100); expect(rotated.bottom - rotated.top).toBeCloseTo(200);
  mesh.position.x = 1;
  expect(stickerProjectedBounds(mesh, camera, canvas)?.left).toBeCloseTo(260);
  expect(stickerProjectedBounds(mesh, camera, { ...canvas, width: 0 })).toBeNull();
  geometry.dispose(); material.dispose();
});
