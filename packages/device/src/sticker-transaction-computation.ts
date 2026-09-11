import { prepareStickerContourSteps } from './sticker-contour-computation';
import { createStickerBoundsIndex } from './sticker-bounds-index';
import { BufferAttribute, BufferGeometry, Camera, Matrix4 } from 'three';
import { createStickerSurfaceGeometrySteps } from './sticker-surface';
import { createStickerWrapSurface } from './sticker-wrap';
import { createStickerDamageFieldSteps, createSurfaceStickerDamageSteps } from './sticker-alpha';
import { fitStickerDropSteps } from './sticker-drop-fit';
import { transferShell } from './immutable-shell-transfer';
import type { StickerTransactionRequest, StickerTransactionResult } from './sticker-transaction-data';

/** One exact computation for native worker drain and cooperative failure drain.
 * The temporary geometry has no renderer lifetime; all returned arrays are owned. */
export function* computeStickerTransaction(input: StickerTransactionRequest): Generator<void, StickerTransactionResult, void> {
  if (input.kind === 'surface') {
    const rear = new BufferGeometry();
    const wrap = createStickerWrapSurface(input.form, []);
    let geometry: BufferGeometry | undefined;
    try {
      geometry = yield* createStickerSurfaceGeometrySteps(input.art, input.placement, rear, wrap);
      const bounds = yield* createStickerBoundsIndex(geometry.getAttribute('position').array);
      return { kind: 'surface', geometry: transferShell(geometry), bounds };
    } finally { geometry?.dispose(); rear.dispose(); }
  }
  if (input.kind === 'damage') {
    if (!Number.isInteger(input.mask.width) || !Number.isInteger(input.mask.height) || input.mask.width < 1 || input.mask.height < 1 || input.mask.width * input.mask.height !== input.mask.pixels.length || input.mask.pixels.length > 16 * 1024 * 1024) throw new Error('Invalid sticker alpha dimensions');
    let field = yield* createStickerDamageFieldSteps(input.mask, input.stickerId);
    if (input.surface) {
      const geometry = new BufferGeometry();
      try {
        geometry.setAttribute('normal', new BufferAttribute(input.surface.normals, 3));
        geometry.setAttribute('uv', new BufferAttribute(input.surface.uv, 2));
        field = yield* createSurfaceStickerDamageSteps(field, geometry);
      } finally { geometry.dispose(); }
    }
    const gpu = new Uint8Array(field.onset.length);
    for (let y = 0; y < field.height; y++) { if (y % 32 === 0) yield; gpu.set(field.onset.subarray(y * field.width, (y + 1) * field.width), (field.height - 1 - y) * field.width); }
    return { kind: 'damage', stickerId: input.stickerId, field, gpu };
  }
  if (input.kind === 'contour') return { kind: 'contour', contour: yield* prepareStickerContourSteps(input.field, input.wear, input.positions, input.uv) };
  const camera = new Camera(); camera.matrixAutoUpdate = false;
  camera.matrixWorld.fromArray(input.cameraWorld); camera.matrixWorldInverse.copy(camera.matrixWorld).invert(); camera.projectionMatrix.fromArray(input.cameraProjection); camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  const placement = yield* fitStickerDropSteps(input.art, input.placement, input.grabbedUv, input.screen, input.canvas, new Matrix4().fromArray(input.world), camera, createStickerWrapSurface(input.form, []));
  return { kind: 'fit', placement };
}
