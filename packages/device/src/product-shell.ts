import { BufferGeometry, Float32BufferAttribute, type Vector2 } from "three";

import { silhouetteShape } from "./shapes";

export type RearShellParams = {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly cornerR: number;
  readonly exponent: number;
  /** Aluminum depth measured from the front face to the material seam. */
  readonly frontThickness: number;
  /** Maximum plan inset of the crowned rear face relative to the seam. */
  readonly rearCrownInset: number;
  /** Flat return lip under the aluminum rear bevel, closing the open tray rim. */
  readonly frontRimInset?: number;
  readonly cornerSegments?: number;
};

export type RearShellSection = {
  readonly z: number;
  readonly inset: number;
};

export type FrontShellPlan = {
  /** Shape submitted to Three before its outward bevel expansion. */
  readonly faceWidth: number;
  readonly faceHeight: number;
  readonly faceCornerR: number;
  /** Greatest projected aluminum outline after the bevel is applied. */
  readonly projectedWidth: number;
  readonly projectedHeight: number;
  readonly projectedCornerR: number;
};

export type ProductShellDepths = {
  readonly rearFaceZ: number;
  readonly seamZ: number;
  readonly frontFaceZ: number;
};

const EPSILON = 1e-6;
export const REAR_ROLL_SEGMENTS = 48;

/** One axial contract shared by the steel rear and aluminum front. */
export function productShellDepths(
  depth: number,
  frontThickness: number,
): ProductShellDepths {
  if (!(depth > 0) || !Number.isFinite(depth)) {
    throw new Error(`product depth must be finite and positive; got ${depth}`);
  }
  if (
    !(frontThickness > 0) ||
    !Number.isFinite(frontThickness) ||
    !(frontThickness < depth)
  ) {
    throw new Error(
      `front thickness must be finite, positive and below product depth; got ${frontThickness}`,
    );
  }
  const frontFaceZ = depth / 2;
  return Object.freeze({
    rearFaceZ: -frontFaceZ,
    seamZ: frontFaceZ - frontThickness,
    frontFaceZ,
  });
}

/**
 * Resolve the aluminum front's pre-bevel and projected plans.
 *
 * Three's `ExtrudeGeometry` expands an outline by `bevelSize`; feeding it the
 * already-final enclosure plan therefore makes the rolled face wider than the
 * steel chassis. The old production mesh reached 334.6 units across a 330-unit
 * product, which is the lower-corner/edge kink visible in the owner's capture.
 * Pre-insetting by both the intentional steel seam and the face roll makes the
 * largest aluminum section exactly `width - 2 * seamWidth` instead.
 */
export function frontShellPlan(
  width: number,
  height: number,
  cornerR: number,
  seamWidth: number,
  faceBevel: number,
): FrontShellPlan {
  if (!(width > 0) || !(height > 0) || !(cornerR > 0)) {
    throw new Error("front shell plan requires positive enclosure dimensions");
  }
  if (!(seamWidth > 0) || !(faceBevel > 0)) {
    throw new Error("front shell seam and face bevel must be positive");
  }
  const inset = seamWidth + faceBevel;
  const faceWidth = width - 2 * inset;
  const faceHeight = height - 2 * inset;
  const faceCornerR = cornerR - inset;
  if (!(faceWidth > 0) || !(faceHeight > 0) || !(faceCornerR > 0)) {
    throw new Error(
      "front shell seam and face bevel must fit the enclosure plan",
    );
  }
  return Object.freeze({
    faceWidth,
    faceHeight,
    faceCornerR,
    projectedWidth: faceWidth + 2 * faceBevel,
    projectedHeight: faceHeight + 2 * faceBevel,
    projectedCornerR: faceCornerR + faceBevel,
  });
}

/**
 * Cross-sections for the thin Classic stainless rear tray.
 *
 * The rear face is inset and the formed steel expands continuously across its
 * full depth to the front-shell seam. There is no constant-width rear slab,
 * second front-facing cap, or overlap beyond `seamZ`.
 */
export function rearShellSections(
  depth: number,
  seamZ: number,
  rearCrownInset: number,
  segments = REAR_ROLL_SEGMENTS,
): readonly RearShellSection[] {
  if (!(depth > 0) || !Number.isFinite(depth)) {
    throw new Error(
      `rear shell depth must be finite and positive; got ${depth}`,
    );
  }
  if (!(rearCrownInset > 0) || !Number.isFinite(rearCrownInset)) {
    throw new Error(
      `rear crown inset must be finite and positive; got ${rearCrownInset}`,
    );
  }
  if (!Number.isInteger(segments) || segments < 4) {
    throw new Error(
      `rear shell requires at least four crown segments; got ${segments}`,
    );
  }
  const rearZ = -depth / 2;
  if (!(seamZ > rearZ) || seamZ > depth / 2 + EPSILON) {
    throw new Error(`rear shell seam must stay inside the body; got ${seamZ}`);
  }
  const span = seamZ - rearZ;
  return Object.freeze(
    Array.from({ length: segments + 1 }, (_, index) => {
      // Sample the quarter ellipse uniformly by angle, not axial Z. This keeps
      // tessellation dense where the stamped back turns out of its rear face
      // and prevents the first face from becoming a long triangular chamfer.
      const angle = ((index / segments) * Math.PI) / 2;
      const normalizedDepth = 1 - Math.cos(angle);
      return Object.freeze({
        z: index === segments ? seamZ : rearZ + span * normalizedDepth,
        inset: index === segments ? 0 : rearCrownInset * (1 - Math.sin(angle)),
      });
    }),
  );
}

/**
 * Quarter-ellipse roll used by the stamped-steel rear perimeter.
 *
 * At the rear face its axial tangent is zero, so the roll leaves the plate in
 * the plate's own plane. At the seam its plan-inset tangent is zero, so it
 * arrives parallel to the side wall. The rejected smootherstep did the exact
 * opposite at the rear: it left the plate axially and formed a 90° terminal
 * chamfer even though its scalar slope looked numerically smooth.
 */
export function rearRollInsetAt(
  normalizedDepth: number,
  rearCrownInset: number,
): number {
  if (!(normalizedDepth >= 0 && normalizedDepth <= 1)) {
    throw new Error(
      `rear roll depth must be normalized to 0..1; got ${normalizedDepth}`,
    );
  }
  if (!(rearCrownInset > 0) || !Number.isFinite(rearCrownInset)) {
    throw new Error(
      `rear crown inset must be finite and positive; got ${rearCrownInset}`,
    );
  }
  const rearAxis = 1 - normalizedDepth;
  return rearCrownInset * (1 - Math.sqrt(Math.max(0, 1 - rearAxis * rearAxis)));
}

/** Change in plan inset per unit of axial Z at one point on the rear roll. */
export function rearRollInsetSlopeAt(
  normalizedDepth: number,
  rearCrownInset: number,
  axialSpan: number,
): number {
  if (!(axialSpan > 0) || !Number.isFinite(axialSpan)) {
    throw new Error(
      `rear roll span must be finite and positive; got ${axialSpan}`,
    );
  }
  // Call through the value function so both normalized-depth and inset
  // validation remain one contract.
  rearRollInsetAt(normalizedDepth, rearCrownInset);
  if (normalizedDepth === 0) return Number.NEGATIVE_INFINITY;
  const rearAxis = 1 - normalizedDepth;
  const radialAxis = Math.sqrt(Math.max(0, 1 - rearAxis * rearAxis));
  return (-rearCrownInset * rearAxis) / (axialSpan * radialAxis);
}

/**
 * One indexed, normal-smoothed rear tray, open only at the intentional seam.
 *
 * Shared vertices keep the surface watertight. Analytic sweep normals keep
 * highlights continuous independently of triangle area and cap triangulation.
 */
export function createRearShellGeometry({
  width,
  height,
  depth,
  cornerR,
  exponent,
  frontThickness,
  rearCrownInset,
  cornerSegments = 48,
  frontRimInset = 0,
}: RearShellParams): BufferGeometry {
  if (!(width > 2 * rearCrownInset) || !(height > 2 * rearCrownInset)) {
    throw new Error("rear crown inset must fit inside the enclosure plan");
  }
  if (!(cornerR > rearCrownInset)) {
    throw new Error(
      "rear crown inset must stay below the enclosure corner radius",
    );
  }

  if (!Number.isFinite(frontRimInset) || frontRimInset < 0 || frontRimInset >= cornerR) {
    throw new Error("front rim inset must fit the shell corner");
  }
  const { seamZ } = productShellDepths(depth, frontThickness);
  const sections = rearShellSections(depth, seamZ, rearCrownInset);
  const rings = sections.map((section) =>
    sampleSilhouette(
      width - 2 * section.inset,
      height - 2 * section.inset,
      cornerR - section.inset,
      exponent,
      cornerSegments,
    ),
  );
  const ringSize = rings[0]?.length ?? 0;
  if (ringSize < 8 || rings.some((ring) => ring.length !== ringSize)) {
    throw new Error("rear shell sections must have matching perimeter samples");
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const normals: number[] = [];
  for (
    let sectionIndex = 0;
    sectionIndex < sections.length;
    sectionIndex += 1
  ) {
    const section = sections[sectionIndex];
    const ring = rings[sectionIndex];
    if (section === undefined || ring === undefined) continue;
    for (const point of ring) {
      positions.push(point.x, point.y, section.z);
      uvs.push(point.x / width + 0.5, point.y / height + 0.5);
      // Analytic normal of the swept superellipse. Area-weighted triangle
      // normals bias the corner endpoints toward the long straight sides and
      // rear-cap fan, producing pinched chrome highlights at each junction.
      const radius = cornerR - section.inset;
      const radialX = Math.max(0, Math.abs(point.x) - (width / 2 - cornerR)) / radius;
      const radialY = Math.max(0, Math.abs(point.y) - (height / 2 - cornerR)) / radius;
      const gradientX = Math.pow(radialX, exponent - 1);
      const gradientY = Math.pow(radialY, exponent - 1);
      const gradientLength = Math.hypot(gradientX, gradientY);
      const planX = gradientX / gradientLength;
      const planY = gradientY / gradientLength;
      const angle = (sectionIndex / (sections.length - 1)) * Math.PI / 2;
      const tangentZ = (seamZ + depth / 2) * Math.sin(angle);
      const axialNormal = -rearCrownInset * Math.cos(angle) *
        (planX * radialX + planY * radialY);
      const length = Math.hypot(tangentZ, axialNormal);
      normals.push(
        Math.sign(point.x) * planX * tangentZ / length,
        Math.sign(point.y) * planY * tangentZ / length,
        axialNormal / length,
      );
    }
  }

  // The rear cap shares its perimeter with section zero so its normal blends
  // into the formed-steel roll. Its centre is a single additional vertex.
  const rearCenterIndex = positions.length / 3;
  positions.push(0, 0, -depth / 2);
  uvs.push(0.5, 0.5);
  normals.push(0, 0, -1);

  const indices: number[] = [];
  for (
    let sectionIndex = 0;
    sectionIndex < sections.length - 1;
    sectionIndex += 1
  ) {
    const lower = sectionIndex * ringSize;
    const upper = (sectionIndex + 1) * ringSize;
    for (let index = 0; index < ringSize; index += 1) {
      const next = (index + 1) % ringSize;
      const a = lower + index;
      const b = lower + next;
      const c = upper + index;
      const d = upper + next;
      indices.push(a, b, c, b, d, c);
    }
  }
  // Perimeters wind CCW from the front; reversing each rear-cap triangle makes
  // its outward normal point toward -Z.
  for (let index = 0; index < ringSize; index += 1) {
    const next = (index + 1) % ringSize;
    indices.push(rearCenterIndex, next, index);
  }

  if (frontRimInset > 0) {
    const outer = rings.at(-1);
    if (outer === undefined) throw new Error("rear shell rim missing");
    const inner = sampleSilhouette(width - 2 * frontRimInset, height - 2 * frontRimInset,
      cornerR - frontRimInset, exponent, cornerSegments);
    const start = positions.length / 3;
    // Duplicate the edge normals: the formed side turns into a flat return.
    for (const ring of [outer, inner]) for (const point of ring) {
      positions.push(point.x, point.y, seamZ);
      normals.push(0, 0, 1);
      uvs.push(point.x / width + 0.5, point.y / height + 0.5);
    }
    for (let i = 0; i < ringSize; i++) {
      const next = (i + 1) % ringSize;
      indices.push(start + i, start + next, start + ringSize + i,
        start + next, start + ringSize + next, start + ringSize + i);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function sampleSilhouette(
  width: number,
  height: number,
  cornerR: number,
  exponent: number,
  cornerSegments: number,
): readonly Vector2[] {
  const points = silhouetteShape(
    width,
    height,
    cornerR,
    exponent,
    cornerSegments,
  ).getPoints();
  const first = points[0];
  const last = points.at(-1);
  if (
    first !== undefined &&
    last !== undefined &&
    first.distanceTo(last) < EPSILON
  ) {
    points.pop();
  }
  return points;
}
