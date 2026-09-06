import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { DEVICE_LAYOUT } from './layout';
import type { DeviceStickerPlacement, StickerArtwork } from './sticker-contract';

export const STICKER_SURFACE = Object.freeze({ segments: 24, lift: 0.18, alphaThreshold: 16 / 255 });

/** Visible print dimensions; alpha padding never shrinks a catalogue design. */
export function stickerVisibleAspect(art: StickerArtwork): number {
  const [left, top, right, bottom] = art.visibleBounds;
  if (!(art.width > 0 && art.height > 0 && left >= 0 && top >= 0 && right <= art.width && bottom <= art.height && right > left && bottom > top)) {
    throw new Error('Invalid sticker artwork bounds');
  }
  return (bottom - top) / (right - left);
}

/** Projects onto the exact rear mesh, including its rolled shoulder and normals. */
export function createStickerSurfaceGeometry(art: StickerArtwork, placement: DeviceStickerPlacement, rear: BufferGeometry): BufferGeometry {
  const aspect = stickerVisibleAspect(art);
  if (![placement.x, placement.y, placement.width, placement.rotationDeg].every(Number.isFinite) || placement.width <= 0 || placement.surface !== 'back') {
    throw new Error('Invalid sticker placement');
  }
  const { width: bodyWidth, height: bodyHeight, depth } = DEVICE_LAYOUT.body;
  const width = placement.width * bodyWidth;
  const height = width * aspect;
  const angle = placement.rotationDeg * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const ray = new Raycaster();
  const material = new MeshBasicMaterial();
  const mesh = new Mesh(rear, material);
  mesh.updateMatrixWorld();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const [left, top, right, bottom] = art.visibleBounds;
  const segments = STICKER_SURFACE.segments;
  try {
    for (let row = 0; row <= segments; row++) for (let col = 0; col <= segments; col++) {
      const u = col / segments;
      const v = row / segments;
      const px = (u - .5) * width;
      const py = (v - .5) * height;
      // Rear view's right points along model -X; its down points along -Y.
      const x = (.5 - placement.x) * bodyWidth - (px * cosine - py * sine);
      const y = (.5 - placement.y) * bodyHeight - (px * sine + py * cosine);
      // The actual rear mesh has a flat central cap. Keep the safe interior fast;
      // shoulder vertices use the source mesh instead of a guessed crown formula.
      const onCap = Math.abs(x) < bodyWidth / 2 - DEVICE_LAYOUT.body.cornerR && Math.abs(y) < bodyHeight / 2 - DEVICE_LAYOUT.body.cornerR;
      ray.set(new Vector3(x, y, -depth * 2), new Vector3(0, 0, 1));
      const hit = onCap ? null : ray.intersectObject(mesh, false)[0];
      let normal = new Vector3(0, 0, -1);
      let point = new Vector3(x, y, -depth / 2);
      if (!onCap) {
        if (hit === null || hit === undefined || hit.normal === undefined || hit.normal.z >= 0) throw new Error('Sticker exceeds rear surface');
        normal = hit.normal.clone().normalize(); point = hit.point.clone();
      }
      point.addScaledVector(normal, STICKER_SURFACE.lift);
      positions.push(point.x, point.y, point.z);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push((left + u * (right - left)) / art.width, 1 - (top + v * (bottom - top)) / art.height);
    }
    for (let row = 0; row < segments; row++) for (let col = 0; col < segments; col++) {
      const a = row * (segments + 1) + col;
      const b = a + 1;
      const c = a + segments + 1;
      // Both local axes reverse, so reverse the usual +Z winding.
      indices.push(a, c, b, b, c, c + 1);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  } finally { material.dispose(); }
}

/** Inextensible cylindrical peel: arc length follows the backing's original Y. */
export function createStickerPeelGeometry(art: StickerArtwork, width: number, progress: number): BufferGeometry {
  const height = width * stickerVisibleAspect(art);
  const amount = Math.max(0, Math.min(1, progress));
  const segments = 24;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const [left, top, right, bottom] = art.visibleBounds;
  const curlLength = height * amount;
  const radius = height / Math.PI;
  for (let row = 0; row <= segments; row++) for (let col = 0; col <= segments; col++) {
    const u = col / segments;
    const v = row / segments;
    const distance = v * height;
    const peeledDistance = Math.max(0, curlLength - distance);
    const bend = peeledDistance / radius;
    positions.push((u - .5) * width, height / 2 - curlLength + (peeledDistance > 0 ? radius * Math.sin(bend) : curlLength - distance), radius * (1 - Math.cos(bend)));
    uvs.push((left + u * (right - left)) / art.width, 1 - (top + v * (bottom - top)) / art.height);
  }
  for (let row = 0; row < segments; row++) for (let col = 0; col < segments; col++) {
    const a = row * (segments + 1) + col;
    const b = a + 1;
    const c = a + segments + 1;
    indices.push(a, c, b, b, c, c + 1);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Lift from the saved rear pose: unpeeled vertices stay exactly on the original adhesive contact. */
export function createRearStickerPeelGeometry(art: StickerArtwork, placement: DeviceStickerPlacement, rear: BufferGeometry, progress: number): BufferGeometry {
  const surface = createStickerSurfaceGeometry(art, placement, rear);
  const width = placement.width * DEVICE_LAYOUT.body.width;
  const flat = createStickerPeelGeometry(art, width, 0);
  const lifted = createStickerPeelGeometry(art, width, progress);
  const a = flat.getAttribute('position'), b = lifted.getAttribute('position'), output = surface.getAttribute('position');
  const angle = placement.rotationDeg * Math.PI / 180, cosine = Math.cos(angle), sine = Math.sin(angle);
  for (let index = 0; index < output.count; index++) {
    const dx = b.getX(index) - a.getX(index), dy = b.getY(index) - a.getY(index), dz = b.getZ(index) - a.getZ(index);
    output.setXYZ(index, output.getX(index) - dx * cosine - dy * sine, output.getY(index) - dx * sine + dy * cosine, output.getZ(index) - dz);
  }
  output.needsUpdate = true; surface.computeVertexNormals(); surface.computeBoundingSphere();
  flat.dispose(); lifted.dispose();
  return surface;
}
