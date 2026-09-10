import { BufferAttribute, BufferGeometry, Sphere, Vector3 } from 'three';

/** Only owned worker buffers cross this boundary; render geometry is never detached. */
export interface PaperGeometryTransfer {
  readonly position: Float32Array;
  readonly normal: Float32Array;
  readonly uv: Float32Array | null;
  readonly index: Uint32Array | null;
  readonly sphere: { readonly x: number; readonly y: number; readonly z: number; readonly radius: number };
}
export interface PaperPreparationInput {
  readonly epoch?: number;
  readonly width: number; readonly height: number; readonly pixel: number;
  readonly liner: boolean; readonly curl: number;
}
export interface PaperPreparationResult {
  readonly front: PaperGeometryTransfer; readonly back: PaperGeometryTransfer; readonly edge: PaperGeometryTransfer;
}
export interface PaperWorkerResponse { readonly id: number; readonly stock?: PaperPreparationResult; readonly error?: string }

/** Serialize computed attributes and bounds, avoiding any main-thread normal/bounds pass. */
export function transferPaperGeometry(geometry: BufferGeometry): PaperGeometryTransfer {
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv');
  const sphere = geometry.boundingSphere;
  if (!sphere) throw new Error('Paper geometry has no computed bounds');
  return { position: Float32Array.from(position.array), normal: Float32Array.from(normal.array), uv: uv ? Float32Array.from(uv.array) : null,
    index: geometry.index ? Uint32Array.from(geometry.index.array) : null,
    sphere: { x: sphere.center.x, y: sphere.center.y, z: sphere.center.z, radius: sphere.radius } };
}
/** Adopt transferred buffers; caller owns disposal after the mounted meshes release them. */
export function restorePaperGeometry(value: PaperGeometryTransfer): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(value.position, 3));
  geometry.setAttribute('normal', new BufferAttribute(value.normal, 3));
  if (value.uv) geometry.setAttribute('uv', new BufferAttribute(value.uv, 2));
  if (value.index) geometry.setIndex(new BufferAttribute(value.index, 1));
  geometry.boundingSphere = new Sphere(new Vector3(value.sphere.x, value.sphere.y, value.sphere.z), value.sphere.radius);
  return geometry;
}
