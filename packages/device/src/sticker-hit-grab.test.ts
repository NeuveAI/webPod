import { expect, test } from 'bun:test';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshPhysicalMaterial, PerspectiveCamera, Raycaster, Texture, Vector2, Vector3 } from 'three';
import { intersectStickerPrint } from './sticker-hit';
import { captureStickerSurfaceGrab } from './sticker-surface-grab';

test('painted probe hit retains the rendered transformed triangle through affine capture', () => {
  class SourceImage { complete = true; naturalWidth = 1; naturalHeight = 1; }
  const imageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'HTMLImageElement'), documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'HTMLImageElement', { configurable: true, value: SourceImage });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray([255, 255, 255, 255]) }) }) }) } });
  const texture = new Texture(new SourceImage() as unknown as HTMLImageElement), geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([-20, -20, -28, 20, -20, -28, -20, 20, -28], 3));
  geometry.setAttribute('uv', new Float32BufferAttribute([1, 0, 0, 0, 1, 1], 2));
  const material = new MeshPhysicalMaterial({ map: texture, side: DoubleSide }), print = new Mesh(geometry, material), content = new Group();
  content.add(print); content.rotation.set(.2, .7, -.3); content.position.set(23, -19, 11); print.position.set(3, 5, 2); content.updateMatrixWorld(true);
  print.raycast = () => {}; // Real StickerPrint bypasses R3F; production hit borrows a probe.
  const camera = new PerspectiveCamera(40, 1, 1, 3000); camera.position.set(0, 0, -1000); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const point = new Vector3(-7, -7, -28).applyMatrix4(print.matrixWorld), ndc = point.clone().project(camera), rect = { left: 11, top: 17, width: 600, height: 600 };
  const pointer = { x: rect.left + (ndc.x + 1) * rect.width / 2, y: rect.top + (1 - ndc.y) * rect.height / 2 };
  const ray = new Raycaster(); ray.setFromCamera(new Vector2(ndc.x, ndc.y), camera);
  const placement = { stickerId: 'test', surface: 'back' as const, x: .5, y: .5, width: .2, rotationDeg: 0 }, art = { id: 'test', url: '', width: 1, height: 1, visibleBounds: [0, 0, 1, 1] as const };
  try {
    const hit = intersectStickerPrint(ray, print, placement); expect(hit).not.toBeNull(); if (!hit) throw new Error('Missing painted hit');
    const before = print.matrixWorld.clone();
    const expected = captureStickerSurfaceGrab(placement, art, { object: print, point: hit.point, face: hit.face }, pointer, content, camera, { getBoundingClientRect: () => rect }, () => true);
    const actual = captureStickerSurfaceGrab(placement, art, hit, pointer, content, camera, { getBoundingClientRect: () => rect }, () => true);
    for (const [dx, dy] of [[0, 0], [12, 8], [-20, 15], [8, -30]]) {
      expect(actual?.projectCenter(pointer.x + (dx ?? 0), pointer.y + (dy ?? 0))).toEqual(expected?.projectCenter(pointer.x + (dx ?? 0), pointer.y + (dy ?? 0)));
    }
    expect(hit.object).toBe(print); expect(print.matrixWorld.equals(before)).toBe(true);
  } finally {
    if (imageDescriptor) Object.defineProperty(globalThis, 'HTMLImageElement', imageDescriptor); else Reflect.deleteProperty(globalThis, 'HTMLImageElement');
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor); else Reflect.deleteProperty(globalThis, 'document');
    geometry.dispose(); material.dispose(); texture.dispose();
  }
});
