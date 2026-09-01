/**
 * The silhouette, and the two openings cut out of it.
 *
 * D-067 makes the saved Pencil component VWaJS authoritative for the visible
 * enclosure: 330 × 552, radius 26, circular exponent n = 2. This helper keeps
 * the exponent explicit so the renderer and probe consume the same typed
 * geometry instead of maintaining parallel corner implementations.
 */
import { Path, Shape } from "three";

/**
 * One superellipse corner, from the point where the straight edge ends to the
 * point where the next one begins.
 *
 * Solves `|u/r|^n + |v/r|^n = 1` in the parametrisation
 * `u = r·cos(t)^(2/n)`, `v = r·sin(t)^(2/n)`, `t ∈ [0, π/2]`, which sweeps the
 * quadrant exactly once and — unlike sampling `v = r(1 − (u/r)^n)^(1/n)` in
 * equal `u` steps — puts points where the curvature is, so a 12-segment corner
 * is already visually continuous. The parametrisation also remains valid for
 * D-067's circular n = 2 case.
 */
function superellipseCorner(
  cx: number,
  cy: number,
  signX: number,
  signY: number,
  r: number,
  n: number,
  segments: number,
): Array<[number, number]> {
  const exp = 2 / n;
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * (Math.PI / 2);
    const u = r * Math.cos(t) ** exp;
    const v = r * Math.sin(t) ** exp;
    points.push([cx + signX * u, cy + signY * v]);
  }
  return points;
}

/**
 * The device silhouette: a `w × h` rectangle whose corners are superellipse
 * arcs of radius `r` and exponent `n`.
 *
 * Centred on the origin, +y up — the frame `layout.ts` establishes.
 */
export function silhouetteShape(
  w: number,
  h: number,
  r: number,
  n: number,
  cornerSegments = 16,
): Shape {
  const hw = w / 2;
  const hh = h / 2;
  const x = hw - r;
  const y = hh - r;

  // Quadrants in CCW order so the outline winds positively; the corner helper
  // sweeps from the +u axis to the +v axis, so each quadrant's list is
  // reversed where the sweep would otherwise run backwards along the outline.
  const topRight = superellipseCorner(x, y, +1, +1, r, n, cornerSegments);
  const topLeft = superellipseCorner(-x, y, -1, +1, r, n, cornerSegments);
  const bottomLeft = superellipseCorner(-x, -y, -1, -1, r, n, cornerSegments);
  const bottomRight = superellipseCorner(x, -y, +1, -1, r, n, cornerSegments);

  // ⚑ Order matters and is easy to get wrong: each quadrant's own sweep runs
  // from its horizontal tangent point to its vertical one, so half of them
  // have to be reversed *and* the four have to be visited in the order the
  // outline walks, not corner by corner. Getting the second part wrong yields
  // a self-intersecting bowtie that earcut triangulates into four detached
  // corner brackets — a failure that looks like a material bug, not a winding
  // one, because what you see is whatever was behind the face.
  //
  //   bottomRight⁻¹ : (x, −hh) → (hw, −y)   then straight up the right edge
  //   topRight      : (hw,  y) → (x,   hh)  then straight across the top
  //   topLeft⁻¹     : (−x, hh) → (−hw,  y)  then straight down the left edge
  //   bottomLeft    : (−hw, −y) → (−x, −hh) then straight back to the start
  const outline: Array<[number, number]> = [
    ...bottomRight.slice().reverse(),
    ...topRight,
    ...topLeft.slice().reverse(),
    ...bottomLeft,
  ];

  const shape = new Shape();
  const first = outline[0];
  if (first === undefined) throw new Error("silhouetteShape: empty outline");
  shape.moveTo(first[0], first[1]);
  for (let i = 1; i < outline.length; i++) {
    const p = outline[i];
    if (p === undefined) continue;
    shape.lineTo(p[0], p[1]);
  }
  shape.closePath();
  return shape;
}

/**
 * A perimeter frame with the same analytic silhouette on both edges.
 *
 * This is the physical steel seam around the polycarbonate face. Keeping the
 * inner outline as a real hole is important: an overlapping steel cap would
 * win the depth/raycast test while the renderer happened to show the
 * coplanar body, letting calibration approve a hidden material.
 */
export function silhouetteFrameShape(
  w: number,
  h: number,
  r: number,
  inset: number,
  n: number,
  cornerSegments = 16,
): Shape {
  const shape = silhouetteShape(w, h, r, n, cornerSegments);
  const inner = silhouetteShape(
    w - 2 * inset,
    h - 2 * inset,
    r - inset,
    n,
    cornerSegments,
  );
  const points = inner.getPoints();
  const hole = new Path();
  const first = points.at(-1);
  if (first === undefined) {
    throw new Error("silhouetteFrameShape: empty inner outline");
  }
  hole.moveTo(first.x, first.y);
  for (let i = points.length - 2; i >= 0; i--) {
    const point = points[i];
    if (point === undefined) continue;
    hole.lineTo(point.x, point.y);
  }
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

/** An ordinary circular-cornered rectangle, centred on the origin. */
function roundedRectPoints(
  w: number,
  h: number,
  r: number,
  arcSegments: number,
) {
  const hw = w / 2;
  const hh = h / 2;
  const x = hw - r;
  const y = hh - r;
  const points: Array<[number, number]> = [];
  const corners: Array<[number, number, number]> = [
    [x, -y, -Math.PI / 2],
    [x, y, 0],
    [-x, y, Math.PI / 2],
    [-x, -y, Math.PI],
  ];
  for (const corner of corners) {
    const [cx, cy, start] = corner;
    for (let i = 0; i <= arcSegments; i++) {
      const a = start + (i / arcSegments) * (Math.PI / 2);
      points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return points;
}

/** The glass window and screen active area outlines (§7.1: circular, not squircle). */
export function roundedRectShape(
  w: number,
  h: number,
  r: number,
  arcSegments = 8,
): Shape {
  const points = roundedRectPoints(w, h, r, arcSegments);
  const shape = new Shape();
  const first = points[0];
  if (first === undefined) throw new Error("roundedRectShape: empty outline");
  shape.moveTo(first[0], first[1]);
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p === undefined) continue;
    shape.lineTo(p[0], p[1]);
  }
  shape.closePath();
  return shape;
}

/**
 * A rounded-rectangle frame with an inner rounded-rectangle hole.
 *
 * Used for recess lips like the LCD well, where the center must remain open
 * for the screen mesh rather than being covered by a filled slab.
 */
export function roundedRectFrameShape(
  outer: { width: number; height: number; radius: number },
  inner: { width: number; height: number; radius: number },
  arcSegments = 8,
): Shape {
  const shape = roundedRectShape(
    outer.width,
    outer.height,
    outer.radius,
    arcSegments,
  );
  shape.holes.push(
    roundedRectHole(
      0,
      0,
      inner.width,
      inner.height,
      inner.radius,
      arcSegments,
    ),
  );
  return shape;
}

/** A rounded-rect hole, offset to `(cx, cy)`, for `Shape.holes`. */
export function roundedRectHole(
  cx: number,
  cy: number,
  w: number,
  h: number,
  r: number,
  arcSegments = 8,
): Path {
  const points = roundedRectPoints(w, h, r, arcSegments);
  const path = new Path();
  // Holes wind opposite to the outline; the outline above is CCW, so reverse.
  const ordered = points.slice().reverse();
  const first = ordered[0];
  if (first === undefined) throw new Error("roundedRectHole: empty outline");
  path.moveTo(cx + first[0], cy + first[1]);
  for (let i = 1; i < ordered.length; i++) {
    const p = ordered[i];
    if (p === undefined) continue;
    path.lineTo(cx + p[0], cy + p[1]);
  }
  path.closePath();
  return path;
}

/** A circular hole for the separate click-wheel assembly. */
export function circleHole(
  cx: number,
  cy: number,
  r: number,
  segments = 128,
): Path {
  const path = new Path();
  // Clockwise, opposite to the CCW outline.
  path.moveTo(cx + r, cy);
  for (let i = 1; i <= segments; i++) {
    const a = (-i / segments) * Math.PI * 2;
    path.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  path.closePath();
  return path;
}
