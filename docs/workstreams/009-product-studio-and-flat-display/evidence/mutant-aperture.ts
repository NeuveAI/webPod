import type { BufferAttribute, BufferGeometry } from "three";

export type RoundedRectAperture = {
  readonly centerX: number;
  readonly centerY: number;
  readonly width: number;
  readonly height: number;
  readonly cornerR: number;
};

type Point = { readonly x: number; readonly y: number };

function squaredDistance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

const APERTURE_CORNER_SEGMENTS = 8;

function validateAperture(aperture: RoundedRectAperture): void {
  if (
    !(aperture.width > 0) ||
    !(aperture.height > 0) ||
    !(aperture.cornerR > 0) ||
    aperture.cornerR * 2 > Math.min(aperture.width, aperture.height) ||
    !Object.values(aperture).every(Number.isFinite)
  ) {
    throw new Error("screen aperture requires finite rounded-rectangle dimensions");
  }
}

/** Nearest point on a segment of the exact tessellated aperture outline. */
export function projectToRoundedRectBoundary(point: Point, aperture: RoundedRectAperture): Point {
  return projectBoundary(point, aperture, false);
}

function projectBoundary(point: Point, aperture: RoundedRectAperture, verticesOnly: boolean): Point {
  validateAperture(aperture);
  const localX = point.x - aperture.centerX;
  const localY = point.y - aperture.centerY;
  const halfWidth = aperture.width / 2;
  const halfHeight = aperture.height / 2;
  const cornerX = halfWidth - aperture.cornerR;
  const cornerY = halfHeight - aperture.cornerR;
  const corners: ReadonlyArray<readonly [number, number, number]> = [
    [cornerX, -cornerY, -Math.PI / 2],
    [cornerX, cornerY, 0],
    [-cornerX, cornerY, Math.PI / 2],
    [-cornerX, -cornerY, Math.PI],
  ];
  const outline: Point[] = [];
  for (const [centerX, centerY, start] of corners) {
    for (let segment = 0; segment <= APERTURE_CORNER_SEGMENTS; segment += 1) {
      const angle = start + (segment / APERTURE_CORNER_SEGMENTS) * (Math.PI / 2);
      outline.push({
        x: centerX + aperture.cornerR * Math.cos(angle),
        y: centerY + aperture.cornerR * Math.sin(angle),
      });
    }
  }
  const source = { x: localX, y: localY };
  let nearest: Point | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < outline.length; index++) {
    const a = outline[index];
    const b = outline[(index + 1) % outline.length];
    if (a === undefined || b === undefined) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) continue;
    const t = Math.max(0, Math.min(1, ((source.x - a.x) * dx + (source.y - a.y) * dy) / lengthSquared));
    const candidate = verticesOnly ? a : { x: a.x + t * dx, y: a.y + t * dy };
    const distance = squaredDistance(source, candidate);
    if (distance >= nearestDistance) continue;
    nearest = candidate;
    nearestDistance = distance;
  }
  if (nearest === null) throw new Error("screen aperture has no boundary");
  return {
    x: nearest.x + aperture.centerX,
    y: nearest.y + aperture.centerY,
  };
}

/** Distance to the exact aperture outline, independent of extrusion depth. */
export function roundedRectBoundaryDistance(
  point: Point,
  aperture: RoundedRectAperture,
): number {
  return Math.sqrt(squaredDistance(point, projectToRoundedRectBoundary(point, aperture)));
}

/**
 * Removes Three's automatic bevel from one hole while retaining it on the
 * device silhouette.
 *
 * `ExtrudeGeometry` applies one bevel policy to the outer contour and every
 * hole. The 5G face needs the opposite combination: a rolled outer shell and
 * a square LCD opening. Snapping only vertices within the known bevel band to
 * the exact rounded-rectangle boundary collapses that inner slope into a flat
 * wall. Recomputed normals then belong to the wall rather than to a reflective
 * chamfer; the outer shell and click-wheel hole remain untouched.
 */
export function squareRoundedRectApertureWalls(
  geometry: BufferGeometry,
  aperture: RoundedRectAperture,
  bevelBand: number,
): void {
  validateAperture(aperture);
  if (!(bevelBand > 0) || !Number.isFinite(bevelBand)) {
    throw new Error("screen aperture bevel band must be finite and positive");
  }
  const position = geometry.getAttribute("position") as BufferAttribute | undefined;
  if (position === undefined || position.itemSize !== 3) {
    throw new Error("screen aperture requires a three-component position attribute");
  }

  let changed = 0;
  const tolerance = 1e-5;
  // Three expands each tessellated corner along a miter, whose length exceeds
  // bevelSize by sec(half the turn angle). Nearest-vertex distance excluded
  // these endpoints and left an inward bevel crossing the top LCD pixels.
  const miterBand = bevelBand / Math.cos(Math.PI / (4 * APERTURE_CORNER_SEGMENTS));
  for (let index = 0; index < position.count; index += 1) {
    const point = { x: position.getX(index), y: position.getY(index) };
    const boundary = projectBoundary(point, aperture, true);
    if (squaredDistance(point, boundary) > (bevelBand + tolerance) ** 2) continue;
    // Selection uses the segment distance, but each generated extrusion
    // vertex must return to its authored contour vertex at every Z layer.
    // Sliding independently along segments would twist the curved corner wall.
    const contourVertex = projectBoundary(point, aperture, true);
    position.setXY(index, contourVertex.x, contourVertex.y);
    changed += 1;
  }
  if (changed === 0) {
    throw new Error("screen aperture did not intersect the extrusion bevel band");
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}
