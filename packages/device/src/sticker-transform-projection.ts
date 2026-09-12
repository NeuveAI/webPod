import { Matrix4, Vector3, type BufferAttribute, type BufferGeometry, type InterleavedBufferAttribute, type Camera, type Mesh, type Object3D } from 'three';
import { preparedStickerContourWear } from './sticker-contour-preparation-data';
import { DEVICE_LAYOUT } from './layout';
import type { StickerProjectedQuad, StickerTransformPlane } from './sticker-contract';
import type { StickerContourCanvas, StickerContourProjection } from './sticker-contour-query-data';

type CanvasRect = StickerContourCanvas;
const validCanvas = (r: CanvasRect) => [r.left, r.top, r.width, r.height].every(Number.isFinite) && r.width > 0 && r.height > 0;

type SampleAttribute = BufferAttribute | InterleavedBufferAttribute;
const sampleSelections = new WeakMap<SampleAttribute, { readonly dependencies: readonly unknown[]; readonly indices: readonly number[] | null }>();
/** Only validated prepared print ownership admits reuse; public geometry rescans.
 * UV writes follow Three's needsUpdate contract. Positions are read live below,
 * including deformation helpers which mutate before publishing their revision. */
function localSampleIndices(uv: SampleAttribute, reusable: boolean): readonly number[] | null {
  const dependencies = [uv.array, uv.array.buffer, uv.array.byteOffset, uv.array.byteLength, uv.count, uv.itemSize, uv.normalized,
    'data' in uv ? uv.data : null, 'data' in uv ? uv.data.version : uv.version,
    'data' in uv ? uv.data.stride : null, 'offset' in uv ? uv.offset : null, uv.getX, uv.getY];
  const cached = reusable ? sampleSelections.get(uv) : undefined;
  if (cached && dependencies.every((value, i) => Object.is(value, cached.dependencies[i]))) return cached.indices;
  const select = (): readonly number[] | null => {
    let minU = Infinity; let maxU = -Infinity; let minV = Infinity; let maxV = -Infinity;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i); const v = uv.getY(i);
      if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
      minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    }
    if (minU === maxU || minV === maxV) return null;
    const sample = (u: number, v: number): number => {
      let best = Infinity, index = 0;
      for (let i = 0; i < uv.count; i++) {
        const distance = (uv.getX(i) - u) ** 2 + (uv.getY(i) - v) ** 2;
        if (distance < best) { best = distance; index = i; }
      }
      return best > 1e-10 ? -1 : index;
    };
    const midU = (minU + maxU) / 2, midV = (minV + maxV) / 2;
    return [sample(minU, maxV), sample(maxU, maxV), sample(maxU, minV), sample(minU, minV),
      sample(midU, maxV), sample(maxU, midV), sample(midU, minV), sample(minU, midV), sample(midU, midV)];
  };
  const indices = select();
  if (reusable) sampleSelections.set(uv, {dependencies, indices});
  return indices;
}

/** Capture nine exact local samples through the existing UV-index cache. Positions
 * are always read live. Returned private Float64 storage can be transferred by its owner. */
export function captureStickerQuadSamples(geometry: BufferGeometry): Float64Array | null {
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  if (!positions || !uv || positions.count !== uv.count || uv.count === 0) return null;
  const indices = localSampleIndices(uv, preparedStickerContourWear(geometry) !== undefined);
  if (indices === null) return null;
  const samples = new Float64Array(27);
  const point = new Vector3();
  for (let slot = 0; slot < 9; slot++) {
    const index = indices[slot];
    if (index === undefined || index < 0) { samples.fill(NaN, slot * 3, slot * 3 + 3); continue; }
    point.fromBufferAttribute(positions, index).toArray(samples, slot * 3);
  }
  return samples;
}

/** Exact rigid projection of captured local samples; never reuses old screen coordinates. */
export function projectStickerQuadSamples(samples: Float64Array, projection: StickerContourProjection): StickerProjectedQuad | null {
  const { canvas } = projection;
  if (!validCanvas(canvas) || samples.length !== 27) return null;
  const world = new Matrix4().fromArray(projection.world);
  const cameraInverse = new Matrix4().fromArray(projection.cameraInverse);
  const cameraProjection = new Matrix4().fromArray(projection.cameraProjection);
  const sample = (slot: number) => {
    const point = new Vector3().fromArray(samples, slot * 3).applyMatrix4(world).applyMatrix4(cameraInverse);
    if (!Number.isFinite(point.z) || point.z >= 0) return null;
    point.applyMatrix4(cameraProjection);
    if (![point.x, point.y, point.z].every(Number.isFinite) || point.z < -1 || point.z > 1) return null;
    return { x: canvas.left + (point.x + 1) * canvas.width / 2, y: canvas.top + (1 - point.y) * canvas.height / 2 };
  };
  const tl = sample(0); const tr = sample(1); const br = sample(2); const bl = sample(3);
  const top = sample(4); const right = sample(5); const bottom = sample(6); const left = sample(7); const center = sample(8);
  if (!tl || !tr || !br || !bl || !top || !right || !bottom || !left || !center) return null;
  const corners = [tl, tr, br, bl] as const;
  const area = corners.reduce((sum, p, i) => { const q = corners[(i + 1) % 4] ?? tl; return sum + p.x * q.y - q.x * p.y; }, 0);
  if (Math.abs(area) < 1e-4) return null;
  return { corners, edges: [top, right, bottom, left], center };
}

/** Samples the actual visible-art UV boundary, preserving artwork order under model rotation. */
export function stickerProjectedQuad(print: Mesh, camera: Camera, canvas: CanvasRect): StickerProjectedQuad | null {
  if (!validCanvas(canvas)) return null;
  const samples = captureStickerQuadSamples(print.geometry);
  if (samples === null) return null;
  print.updateWorldMatrix(true, false); camera.updateMatrixWorld();
  return projectStickerQuadSamples(samples, { world: print.matrixWorld.toArray(), cameraInverse: camera.matrixWorldInverse.toArray(), cameraProjection: camera.projectionMatrix.toArray(), canvas });
}

/** Capture an unbounded editing plane at the selected center's content-local depth.
 * This is a planar editing coordinate system, not an inverse of the curved shoulder.
 * Preserve the initial pointer offset; cancel on viewport or device-pose changes.
 */
export function captureStickerTransformPlane(content: Object3D, camera: Camera, canvas: CanvasRect, localDepth: number): StickerTransformPlane | null {
  if (!validCanvas(canvas) || !Number.isFinite(localDepth)) return null;
  content.updateWorldMatrix(true, false); camera.updateMatrixWorld();
  if (Math.abs(content.matrixWorld.determinant()) < 1e-12) return null;
  const matrix = new Matrix4().copy(content.matrixWorld).invert().multiply(camera.matrixWorld).multiply(camera.projectionMatrixInverse);
  if (!matrix.elements.every(Number.isFinite)) return null;
  const rect = { left: canvas.left, top: canvas.top, width: canvas.width, height: canvas.height };
  const contentMatrix = content.matrixWorld.clone(), cameraMatrix = camera.matrixWorld.clone(), projectionMatrix = camera.projectionMatrix.clone();
  const same = (a: Matrix4, b: Matrix4) => a.elements.every((value, i) => Math.abs(value - (b.elements[i] ?? Infinity)) < 1e-9);
  return { isValid() {
    content.updateWorldMatrix(true, false); camera.updateMatrixWorld();
    return same(content.matrixWorld, contentMatrix) && same(camera.matrixWorld, cameraMatrix) && same(camera.projectionMatrix, projectionMatrix);
  }, project(clientX, clientY) {
    if (![clientX, clientY].every(Number.isFinite)) return null;
    const x = (clientX - rect.left) / rect.width * 2 - 1; const y = 1 - (clientY - rect.top) / rect.height * 2;
    const near = new Vector3(x, y, -1).applyMatrix4(matrix); const far = new Vector3(x, y, 1).applyMatrix4(matrix);
    const direction = far.sub(near);
    if (Math.abs(direction.z) <= direction.length() * 1e-8) return null;
    const t = (localDepth - near.z) / direction.z;
    if (!Number.isFinite(t) || t < 0) return null;
    near.addScaledVector(direction, t);
    const point = { x: .5 - near.x / DEVICE_LAYOUT.body.width, y: .5 - near.y / DEVICE_LAYOUT.body.height };
    return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null;
  } };
}
