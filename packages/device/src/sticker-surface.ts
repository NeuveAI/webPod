import { drainSteps } from './sticker-computation-steps';
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { DEVICE_LAYOUT } from './layout';
import { stickerWrapSurface, type StickerWrapSurface } from './sticker-wrap';
import type { DeviceStickerPlacement, StickerArtwork } from './sticker-contract';

export const STICKER_SURFACE = Object.freeze({ segments: 96, lift: 0.18, alphaThreshold: 16 / 255 });

/** Attached rows remain fixed; the app's separate transport phase releases the
 * final boundary continuously instead of switching every row at curl=1. */
export function stickerRearTransportWeight(row: number, frontier: number, transport: number): number {
  const partial = Math.max(0, Math.min(1, (frontier - row) * 8));
  return partial + (1 - partial) * Math.max(0, Math.min(1, transport));
}

/** Exact same indexed grid, base-position quantization and adjacency film lift as
 * the rendered surface, sampled at a captured material UV without rebuilding it. */
export function sampleStickerSurfaceGrid(pointAt: (dx: number, dy: number) => Vector3, width: number, height: number, rotation: number, u: number, v: number): Vector3 {
  const n = STICKER_SURFACE.segments, stride = n + 1, cosine = Math.cos(rotation), sine = Math.sin(rotation);
  const bases = new Map<number, Vector3>();
  const base = (index: number) => {
    let point = bases.get(index); if (point) return point;
    const px = (index % stride / n - .5) * width, py = (Math.floor(index / stride) / n - .5) * height;
    point = pointAt(-(px * cosine - py * sine), -(px * sine + py * cosine));
    point.set(Math.fround(point.x), Math.fround(point.y), Math.fround(point.z)); bases.set(index, point); return point;
  };
  const lifted = (index: number) => {
    const row = Math.floor(index / stride), col = index % stride, normal = new Vector3();
    for (let y = Math.max(0, row - 1); y <= Math.min(n - 1, row); y++) for (let x = Math.max(0, col - 1); x <= Math.min(n - 1, col); x++) {
      const a = y * stride + x, b = a + 1, c = a + stride;
      for (const ids of [[a, c, b], [b, c, c + 1]]) {
        if (!ids.includes(index)) continue;
        const aa = ids[0], bb = ids[1], cc = ids[2]; if (aa === undefined || bb === undefined || cc === undefined) continue;
        const cross = base(bb).clone().sub(base(aa)).cross(base(cc).clone().sub(base(aa)));
        normal.set(Math.fround(normal.x + cross.x), Math.fround(normal.y + cross.y), Math.fround(normal.z + cross.z));
      }
    }
    // Chords spanning the shoulder can cut through steel even when their
    // vertices sit on it. Compensate using the exact material-chart midpoint.
    let bendClearance = 0;
    for (let y = Math.max(0, row - 1); y <= Math.min(n - 1, row); y++) for (let x = Math.max(0, col - 1); x <= Math.min(n - 1, col); x++) {
      const a = y * stride + x, b = a + 1, c = a + stride;
      for (const ids of [[a, c, b], [b, c, c + 1]]) {
        if (!ids.includes(index)) continue;
        let u = 0, v = 0; const midpoint = new Vector3();
        for (const id of ids) { u += id % stride / n; v += Math.floor(id / stride) / n; midpoint.add(base(id)); }
        const px = (u / 3 - .5) * width, py = (v / 3 - .5) * height;
        const exact = pointAt(-(px * cosine - py * sine), -(px * sine + py * cosine));
        bendClearance = Math.max(bendClearance, exact.distanceTo(midpoint.divideScalar(3)));
      }
    }
    normal.normalize(); normal.set(Math.fround(normal.x), Math.fround(normal.y), Math.fround(normal.z));
    const point = base(index).clone().addScaledVector(normal, STICKER_SURFACE.lift + bendClearance);
    return point.set(Math.fround(point.x), Math.fround(point.y), Math.fround(point.z));
  };
  const gx = Math.max(0, Math.min(n, u * n)), gy = Math.max(0, Math.min(n, v * n));
  const col = Math.min(n - 1, Math.floor(gx)), row = Math.min(n - 1, Math.floor(gy)), x = gx - col, y = gy - row;
  const a = row * stride + col, b = a + 1, c = a + stride;
  return x + y <= 1 ? lifted(a).multiplyScalar(1 - x - y).addScaledVector(lifted(b), x).addScaledVector(lifted(c), y)
    : lifted(b).multiplyScalar(1 - y).addScaledVector(lifted(c), 1 - x).addScaledVector(lifted(c + 1), x + y - 1);
}

/** Visible print dimensions; alpha padding never shrinks a catalogue design. */
export function stickerVisibleAspect(art: StickerArtwork): number {
  const [left, top, right, bottom] = art.visibleBounds;
  if (!(art.width > 0 && art.height > 0 && left >= 0 && top >= 0 && right <= art.width && bottom <= art.height && right > left && bottom > top)) {
    throw new Error('Invalid sticker artwork bounds');
  }
  return (bottom - top) / (right - left);
}

/** Projects onto the exact rear mesh, including its rolled shoulder and normals. */
export function createStickerSurfaceGeometry(art: StickerArtwork, placement: DeviceStickerPlacement, rear: BufferGeometry, preparedWrap?: StickerWrapSurface): BufferGeometry { return drainSteps(createStickerSurfaceGeometrySteps(art, placement, rear, preparedWrap)); }
export function* createStickerSurfaceGeometrySteps(art: StickerArtwork, placement: DeviceStickerPlacement, rear: BufferGeometry, preparedWrap?: StickerWrapSurface) {
  let stepCount = 0;
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
  const wrap = preparedWrap ?? stickerWrapSurface(rear);
  const centerX = (.5 - placement.x) * bodyWidth, centerY = (.5 - placement.y) * bodyHeight;
  const corner = wrap?.cornerCage(centerX, centerY, { width, height, angle });
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
    if (++stepCount % 128 === 0) yield;
      const u = col / segments;
      const v = row / segments;
      const px = (u - .5) * width;
      const py = (v - .5) * height;
      // Rear view's right points along model -X; its down points along -Y.
      const x = (.5 - placement.x) * bodyWidth - (px * cosine - py * sine);
      const y = (.5 - placement.y) * bodyHeight - (px * sine + py * cosine);
      if (corner) {
        const point = corner.point(-(px * cosine - py * sine), -(px * sine + py * cosine));
        positions.push(point.x, point.y, point.z);
        normals.push(0, 0, 0);
        uvs.push((left + u * (right - left)) / art.width, 1 - (top + v * (bottom - top)) / art.height);
        continue;
      }
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
    if (++stepCount % 128 === 0) yield;
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
    if (corner) {
      // Adjacency normals use the exact shown mesh. Avoid four extra chart
      // inversions and transient vectors for every vertex on each pointer pose.
      geometry.computeVertexNormals();
      const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
      const clearance = new Float32Array(p.count);
      const midpoint = new Vector3();
      for (let i = 0; i < indices.length; i += 3) {
    if (++stepCount % 128 === 0) yield;
        const triangle = indices.slice(i, i + 3); let u = 0, v = 0; midpoint.set(0, 0, 0);
        for (const id of triangle) {
    if (++stepCount % 128 === 0) yield; u += id % (segments + 1) / segments; v += Math.floor(id / (segments + 1)) / segments; midpoint.add(new Vector3().fromBufferAttribute(p, id)); }
        const px = (u / 3 - .5) * width, py = (v / 3 - .5) * height;
        const exact = corner.point(-(px * cosine - py * sine), -(px * sine + py * cosine));
        const sag = exact.distanceTo(midpoint.divideScalar(3));
        for (const id of triangle) clearance[id] = Math.max(clearance[id] ?? 0, sag);
      }
      for (let i = 0; i < p.count; i++) {
    if (++stepCount % 128 === 0) yield;
        const lift = STICKER_SURFACE.lift + (clearance[i] ?? 0);
        p.setXYZ(i, p.getX(i) + n.getX(i) * lift, p.getY(i) + n.getY(i) * lift, p.getZ(i) + n.getZ(i) * lift);
      }
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  } finally { material.dispose(); }
}

/** Inextensible cylindrical peel: arc length follows the backing's original Y. */
export function createStickerPeelGeometry(art: StickerArtwork, width: number, progress: number, segments = 24): BufferGeometry { return drainSteps(createStickerPeelGeometrySteps(art, width, progress, segments)); }
export function* createStickerPeelGeometrySteps(art: StickerArtwork, width: number, progress: number, segments = 24) {
  let stepCount = 0;
  const height = width * stickerVisibleAspect(art);
  const amount = Math.max(0, Math.min(1, progress));
  if (!Number.isInteger(segments) || segments < 1) throw new Error('Invalid peel topology');
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const [left, top, right, bottom] = art.visibleBounds;
  const curlLength = height * amount;
  const radius = height / Math.PI;
  for (let row = 0; row <= segments; row++) for (let col = 0; col <= segments; col++) {
    if (++stepCount % 128 === 0) yield;
    const u = col / segments;
    const v = row / segments;
    const distance = v * height;
    const peeledDistance = Math.max(0, curlLength - distance);
    const bend = peeledDistance / radius;
    positions.push((u - .5) * width, height / 2 - curlLength + (peeledDistance > 0 ? radius * Math.sin(bend) : curlLength - distance), radius * (1 - Math.cos(bend)));
    uvs.push((left + u * (right - left)) / art.width, 1 - (top + v * (bottom - top)) / art.height);
  }
  for (let row = 0; row < segments; row++) for (let col = 0; col < segments; col++) {
    if (++stepCount % 128 === 0) yield;
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
export function createRearStickerPeelGeometry(art: StickerArtwork, placement: DeviceStickerPlacement, rear: BufferGeometry, progress: number, prepared?: BufferGeometry, frontier = progress): BufferGeometry { return drainSteps(createRearStickerPeelGeometrySteps(art, placement, rear, progress, prepared, frontier)); }
export function* createRearStickerPeelGeometrySteps(art: StickerArtwork, placement: DeviceStickerPlacement, rear: BufferGeometry, progress: number, prepared?: BufferGeometry, frontier = progress) {
  let stepCount = 0;
  const surface = prepared?.clone() ?? (yield* createStickerSurfaceGeometrySteps(art, placement, rear));
  const amount = Math.max(0, Math.min(1, frontier));
  if (amount === 0) return surface;
  const output = surface.getAttribute('position'), normals = surface.getAttribute('normal');
  const source = new Float32Array(output.array);
  const segments = Math.sqrt(output.count) - 1;
  if (!Number.isInteger(segments)) { surface.dispose(); throw new Error('Invalid rear peel topology'); }
  const height = placement.width * DEVICE_LAYOUT.body.width * stickerVisibleAspect(art);
  const radius = height * amount / (Math.PI * Math.max(.001, Math.min(1, progress)));
  const front = amount * segments, rowA = Math.min(segments - 1, Math.floor(front)), mix = front - rowA;
  const a = new Vector3(), b = new Vector3(), origin = new Vector3(), tangent = new Vector3(), normal = new Vector3(), normalB = new Vector3();
  for (let col = 0; col <= segments; col++) {
    if (++stepCount % 128 === 0) yield;
    const ia = rowA * (segments + 1) + col, ib = ia + segments + 1;
    a.fromArray(source, ia * 3); b.fromArray(source, ib * 3); origin.copy(a).lerp(b, mix);
    tangent.copy(b).sub(a).normalize();
    normal.fromBufferAttribute(normals, ia); normalB.fromBufferAttribute(normals, ib); normal.lerp(normalB, mix);
    normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
    for (let row = 0; row <= segments; row++) {
    if (++stepCount % 128 === 0) yield;
      if (row >= front) continue; // Exact immutable adhesive contact, including wrapped side/front.
      const distance = (front - row) / segments * height, bend = distance / radius;
      a.copy(origin).addScaledVector(tangent, -radius * Math.sin(bend)).addScaledVector(normal, radius * (1 - Math.cos(bend)));
      output.setXYZ(row * (segments + 1) + col, a.x, a.y, a.z);
    }
  }
  output.needsUpdate = true; surface.computeVertexNormals(); surface.computeBoundingSphere();
  return surface;
}
