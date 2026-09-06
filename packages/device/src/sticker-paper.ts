import { BufferGeometry, Float32BufferAttribute, PlaneGeometry, Vector3 } from 'three';

/** Pixel-calibrated stock construction; visual analogues, not manufacturing measurements. */
export const STICKER_PAPER = Object.freeze({ segments: 96, linerBowPx: 5, sleeveBowPx: 2.5, curlReachPx: 42, curlAngle: 2, linerThicknessPx: .3, sleeveThicknessPx: .7 });

/** The bowed contact surface is shared with the five printed sticker seats. */
export function stickerPaperBow(localX: number, width: number, pixel: number, liner = true): number {
  return pixel * (liner ? STICKER_PAPER.linerBowPx : STICKER_PAPER.sleeveBowPx) * (1 - (2 * localX / width) ** 2);
}

/**
 * A thin sheet with a cylindrical top-right curl and unchanged print UVs.
 * Back vertices follow front normals, rather than shifted duplicate sheets that
 * intersect a steep curl. The closed perimeter exposes a genuine paper edge.
 */
export function createStickerPaperGeometry(width: number, height: number, pixel: number, liner: boolean, curlProgress = 1) {
  if (![width, height, pixel].every(value => Number.isFinite(value) && value > 0)) throw new RangeError('paper dimensions must be positive and finite');
  const segments = STICKER_PAPER.segments;
  const front = new PlaneGeometry(width, height, segments, segments);
  const positions = front.getAttribute('position');
  const reach = Math.min(STICKER_PAPER.curlReachPx * pixel, width * .16, height * .16);
  const curl = Math.max(0, Math.min(1, curlProgress));
  const radius = reach / (STICKER_PAPER.curlAngle * (curl || 1));
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index), y = positions.getY(index);
    const distance = liner && curl > 0 ? Math.max(0, reach - ((width / 2 - x) + (height / 2 - y)) / Math.SQRT2) : 0;
    const angle = distance / radius;
    const contraction = (distance - radius * Math.sin(angle)) / Math.SQRT2;
    positions.setXYZ(index, x - contraction, y - contraction, stickerPaperBow(x, width, pixel, liner) + radius * (1 - Math.cos(angle)));
  }
  front.computeVertexNormals(); front.computeBoundingSphere();
  const back = front.clone();
  const rearPositions = back.getAttribute('position');
  const normals = front.getAttribute('normal');
  const thickness = pixel * (liner ? STICKER_PAPER.linerThicknessPx : STICKER_PAPER.sleeveThicknessPx);
  for (let index = 0; index < positions.count; index++) {
    rearPositions.setXYZ(index, positions.getX(index) - normals.getX(index) * thickness, positions.getY(index) - normals.getY(index) * thickness, positions.getZ(index) - normals.getZ(index) * thickness);
  }
  back.computeBoundingSphere();
  // Clockwise boundary in the plane's row-major vertex order.
  const stride = segments + 1;
  const boundary: number[] = [];
  for (let x = 0; x < segments; x++) boundary.push(x);
  for (let y = 0; y < segments; y++) boundary.push(y * stride + segments);
  for (let x = segments; x > 0; x--) boundary.push(segments * stride + x);
  for (let y = segments; y > 0; y--) boundary.push(y * stride);
  const edgeVertices: number[] = [];
  const point = new Vector3();
  for (let index = 0; index < boundary.length; index++) {
    const a = boundary[index], b = boundary[(index + 1) % boundary.length];
    if (a === undefined || b === undefined) continue;
    for (const [attribute, vertex] of [[positions, a], [rearPositions, a], [positions, b], [positions, b], [rearPositions, a], [rearPositions, b]] as const) {
      point.fromBufferAttribute(attribute, vertex); edgeVertices.push(point.x, point.y, point.z);
    }
  }
  const edge = new BufferGeometry();
  edge.setAttribute('position', new Float32BufferAttribute(edgeVertices, 3));
  edge.computeVertexNormals(); edge.computeBoundingSphere();
  return { front, back, edge };
}

/** Adds the liner's crosswise bow to print/peel vertices without moving their contact seat or UVs. */
export function conformStickerToPaper(geometry: BufferGeometry, paperWidth: number, pixel: number, seatX: number): BufferGeometry {
  const positions = geometry.getAttribute('position');
  const centerX = (seatX - .5) * paperWidth;
  const centerBow = stickerPaperBow(centerX, paperWidth, pixel);
  for (let index = 0; index < positions.count; index++) {
    positions.setZ(index, positions.getZ(index) + stickerPaperBow(centerX + positions.getX(index), paperWidth, pixel) - centerBow);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

/** The sleeve holds the curl flat until its diagonal corner has clearance above the lip. */
export function stickerPaperCurlProgress(width: number, height: number, pixel: number, clearance: number): number {
  const reach = Math.min(STICKER_PAPER.curlReachPx * pixel, width * .16, height * .16);
  const clearedCorner = reach * Math.SQRT2;
  const amount = Math.max(0, Math.min(1, (clearance - clearedCorner) / (reach * .75)));
  return amount * amount * (3 - 2 * amount);
}
