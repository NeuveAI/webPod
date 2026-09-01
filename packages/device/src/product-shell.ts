import {
  BufferGeometry,
  Float32BufferAttribute,
  type Vector2,
} from "three";

import { silhouetteShape } from "./shapes";

export type RearShellParams = {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly cornerR: number;
  readonly exponent: number;
  /** Polycarbonate depth measured from the front face to the material seam. */
  readonly frontThickness: number;
  /** Maximum plan inset of the crowned rear face relative to the seam. */
  readonly rearCrownInset: number;
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
  /** Greatest projected plastic outline after the bevel is applied. */
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

/** One axial contract shared by the steel rear and polycarbonate front. */
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
 * Resolve the plastic front's pre-bevel and projected plans.
 *
 * Three's `ExtrudeGeometry` expands an outline by `bevelSize`; feeding it the
 * already-final enclosure plan therefore makes the rolled face wider than the
 * steel chassis. The old production mesh reached 334.6 units across a 330-unit
 * product, which is the lower-corner/edge kink visible in the owner's capture.
 * Pre-insetting by both the intentional steel seam and the face roll makes the
 * largest plastic section exactly `width - 2 * seamWidth` instead.
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
    throw new Error("front shell seam and face bevel must fit the enclosure plan");
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
 * Cross-sections for the thin 30GB stainless rear tray.
 *
 * The rear face is inset and the formed steel expands continuously across its
 * full depth to the front-shell seam. There is no constant-width rear slab,
 * second front-facing cap, or overlap beyond `seamZ`.
 */
export function rearShellSections(
  depth: number,
  seamZ: number,
  rearCrownInset: number,
  segments = 10,
): readonly RearShellSection[] {
  if (!(depth > 0) || !Number.isFinite(depth)) {
    throw new Error(`rear shell depth must be finite and positive; got ${depth}`);
  }
  if (!(rearCrownInset > 0) || !Number.isFinite(rearCrownInset)) {
    throw new Error(
      `rear crown inset must be finite and positive; got ${rearCrownInset}`,
    );
  }
  if (!Number.isInteger(segments) || segments < 4) {
    throw new Error(`rear shell requires at least four crown segments; got ${segments}`);
  }
  const rearZ = -depth / 2;
  if (!(seamZ > rearZ) || seamZ > depth / 2 + EPSILON) {
    throw new Error(
      `rear shell seam must stay inside the body; got ${seamZ}`,
    );
  }
  const span = seamZ - rearZ;
  return Object.freeze(
    Array.from({ length: segments + 1 }, (_, index) => {
      const t = index / segments;
      // Smootherstep has zero first and second derivatives at both ends. The
      // steel therefore reaches both rear face and front seam without a kink.
      const smooth = t * t * t * (t * (t * 6 - 15) + 10);
      return Object.freeze({
        z: rearZ + span * t,
        inset: rearCrownInset * (1 - smooth),
      });
    }),
  );
}

/**
 * One indexed, normal-smoothed rear tray, open only at the intentional seam.
 *
 * Shared indexed vertices are load-bearing: Three's `computeVertexNormals()`
 * averages the rear crown across section joins. Separate extrusions would keep
 * coincident vertices with unrelated normals and recreate the visible kink the
 * owner reported.
 */
export function createRearShellGeometry({
  width,
  height,
  depth,
  cornerR,
  exponent,
  frontThickness,
  rearCrownInset,
  cornerSegments = 24,
}: RearShellParams): BufferGeometry {
  if (!(width > 2 * rearCrownInset) || !(height > 2 * rearCrownInset)) {
    throw new Error("rear crown inset must fit inside the enclosure plan");
  }
  if (!(cornerR > rearCrownInset)) {
    throw new Error("rear crown inset must stay below the enclosure corner radius");
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
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const section = sections[sectionIndex];
    const ring = rings[sectionIndex];
    if (section === undefined || ring === undefined) continue;
    for (const point of ring) {
      positions.push(point.x, point.y, section.z);
      uvs.push(point.x / width + 0.5, point.y / height + 0.5);
    }
  }

  // The rear cap shares its perimeter with section zero so its normal blends
  // into the formed-steel roll. Its centre is a single additional vertex.
  const rearCenterIndex = positions.length / 3;
  positions.push(0, 0, -depth / 2);
  uvs.push(0.5, 0.5);

  const indices: number[] = [];
  for (let sectionIndex = 0; sectionIndex < sections.length - 1; sectionIndex += 1) {
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

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
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
  if (first !== undefined && last !== undefined && first.distanceTo(last) < EPSILON) {
    points.pop();
  }
  return points;
}
