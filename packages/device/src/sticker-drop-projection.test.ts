import { expect, test } from 'bun:test';
import { Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three';
import { createRearShellGeometry, productShellDepths } from './product-shell';
import { DEFAULT_DEVICE_FORM } from './form';
import { DEVICE_LAYOUT } from './layout';
import { projectStickerDrop } from './sticker-drop-projection';
import { isStickerRearCenter } from '@webpod/stickers';

test('rear, oblique, side and off-device drops resolve onto the actual allowed shell', () => {
  const geometry = createRearShellGeometry({ ...DEVICE_LAYOUT.body, frontThickness: DEFAULT_DEVICE_FORM.frontThickness, rearCrownInset: DEFAULT_DEVICE_FORM.rearCrownInset });
  const material = new MeshBasicMaterial(), mesh = new Mesh(geometry, material);
  const { seamZ } = productShellDepths(DEVICE_LAYOUT.body.depth, DEFAULT_DEVICE_FORM.frontThickness);
  const camera = new PerspectiveCamera(40, 1, 1, 3000);
  for (const position of [[0, 0, -900], [800, 0, -200], [900, 0, 0], [800, 200, 150]]) {
    camera.position.fromArray(position); camera.lookAt(new Vector3()); camera.updateMatrixWorld(true);
    for (const [x, y] of [[450, 450], [10, 450], [890, 50], [-100, -100], [1100, 1100]]) {
      if (x === undefined || y === undefined) throw new Error('Missing pointer');
      const point = projectStickerDrop(mesh, camera, { left: 0, top: 0, width: 900, height: 900 }, x, y, seamZ);
      expect(point).not.toBeNull();
      expect(isStickerRearCenter(point?.x ?? NaN, point?.y ?? NaN)).toBe(true);
    }
  }
  geometry.dispose(); material.dispose();
});
