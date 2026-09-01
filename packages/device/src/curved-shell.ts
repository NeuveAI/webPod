import {
  BufferGeometry,
  Float32BufferAttribute,
  Vector3,
  type BufferAttribute,
  type InterleavedBufferAttribute,
} from "three";

/** Four body pixels makes the quadratic's chord error less than 0.001px. */
export const BODY_CROWN_ROW_STEP = 4;

const EPSILON = 1e-6;

type Vertex = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly u: number;
  readonly v: number;
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
};

/**
 * Smooth cylindrical crown shared by renderer tests and calibration evidence.
 *
 * The even sixth-order profile preserves the authored centre and half-height
 * values while meeting the top and bottom bevels with zero first derivative.
 * The previous quadratic reached the edge with a non-zero tangent and then
 * reported a zero normal there, producing a real C1 kink at every corner.
 */
export function verticalCrownOffset(
  y: number,
  halfHeight: number,
  crown: number,
): number {
  const unitY = Math.min(1, Math.max(-1, y / halfHeight));
  if (Math.abs(unitY) === 1) return 0;
  const unitYSquared = unitY * unitY;
  const profile =
    1 -
    (2 / 3) * unitYSquared -
    (5 / 3) * unitYSquared * unitYSquared +
    (4 / 3) * unitYSquared * unitYSquared * unitYSquared;
  return crown * profile;
}

/** Side-to-side counterpart of {@link verticalCrownOffset}. */
export function horizontalCrownOffset(
  x: number,
  halfWidth: number,
  crown: number,
): number {
  return verticalCrownOffset(x, halfWidth, crown);
}

/** Derivative `dz/dy` of {@link verticalCrownOffset}. */
export function verticalCrownSlope(
  y: number,
  halfHeight: number,
  crown: number,
): number {
  if (y <= -halfHeight || y >= halfHeight) return 0;
  const unitY = y / halfHeight;
  const unitYSquared = unitY * unitY;
  const derivative =
    -(4 / 3) * unitY -
    (20 / 3) * unitY * unitYSquared +
    8 * unitY * unitYSquared * unitYSquared;
  return (crown * derivative) / halfHeight;
}

/** Derivative `dz/dx` of {@link horizontalCrownOffset}. */
export function horizontalCrownSlope(
  x: number,
  halfWidth: number,
  crown: number,
): number {
  return verticalCrownSlope(x, halfWidth, crown);
}

export type CrossCrown = {
  readonly halfWidth: number;
  readonly crown: number;
};

export type EdgeCrown = {
  readonly top: number;
  readonly bottom: number;
  readonly extent: number;
};

/**
 * Z-only molded edge lip; applying it to both faces preserves shell thickness.
 * `sin²` is load-bearing: unlike the rejected sine lobe, both ends are zero in
 * value and tangent, so the lip cannot create an inboard band or corner pinch.
 */
export function edgeCrownOffset(y: number, halfHeight: number, edge: EdgeCrown): number {
  if (edge.top === 0 && edge.bottom === 0) return 0;
  if (!(edge.extent > 0) || !Number.isFinite(edge.extent)) {
    throw new Error(`edge crown extent must be finite and positive; got ${edge.extent}`);
  }
  const distance = halfHeight - Math.abs(y);
  if (distance <= 0 || distance >= edge.extent) return 0;
  const lobe = Math.sin((Math.PI * distance) / edge.extent);
  return (y >= 0 ? edge.top : edge.bottom) * lobe * lobe;
}

/** Derivative dz/dy of {@link edgeCrownOffset}. */
export function edgeCrownSlope(y: number, halfHeight: number, edge: EdgeCrown): number {
  if (edge.top === 0 && edge.bottom === 0) return 0;
  if (!(edge.extent > 0) || !Number.isFinite(edge.extent)) {
    throw new Error(`edge crown extent must be finite and positive; got ${edge.extent}`);
  }
  const distance = halfHeight - Math.abs(y);
  if (distance <= 0 || distance >= edge.extent) return 0;
  return (y >= 0 ? edge.top : edge.bottom) * (Math.PI / edge.extent) *
    Math.sin((2 * Math.PI * distance) / edge.extent) * (y >= 0 ? -1 : 1);
}

/**
 * The front extrusion must contain a real core between its two bevels.
 *
 * Three's `ExtrudeGeometry` places the front lid at `depth + bevelThickness`.
 * Clamping a negative `depth` moves that lid past the intended face and makes
 * the probe and mesh disagree. Rejecting the combination keeps thickness and
 * bevel one coherent construction.
 */
export function frontCoreDepth(thickness: number, bevel: number): number {
  const depth = thickness - 2 * bevel;
  if (!Number.isFinite(depth) || depth <= 0) {
    throw new Error(
      `front shell requires thickness > 2 * bevel; got ${thickness} and ${bevel}`,
    );
  }
  return depth;
}

function vertexAt(
  position: BufferAttribute | InterleavedBufferAttribute,
  normal: BufferAttribute | InterleavedBufferAttribute,
  uv: BufferAttribute | InterleavedBufferAttribute | undefined,
  index: number,
): Vertex {
  return {
    x: position.getX(index),
    y: position.getY(index),
    z: position.getZ(index),
    u: uv?.getX(index) ?? 0,
    v: uv?.getY(index) ?? 0,
    nx: normal.getX(index),
    ny: normal.getY(index),
    nz: normal.getZ(index),
  };
}

function mix(a: Vertex, b: Vertex, t: number): Vertex {
  const s = 1 - t;
  return {
    x: a.x * s + b.x * t,
    y: a.y * s + b.y * t,
    z: a.z * s + b.z * t,
    u: a.u * s + b.u * t,
    v: a.v * s + b.v * t,
    nx: a.nx * s + b.nx * t,
    ny: a.ny * s + b.ny * t,
    nz: a.nz * s + b.nz * t,
  };
}

function clipAtY(
  polygon: ReadonlyArray<Vertex>,
  boundary: number,
  keepAbove: boolean,
): Array<Vertex> {
  if (polygon.length === 0) return [];
  const output: Array<Vertex> = [];
  let previous = polygon[polygon.length - 1];
  if (previous === undefined) return output;
  let previousInside = keepAbove
    ? previous.y >= boundary - EPSILON
    : previous.y <= boundary + EPSILON;

  for (const current of polygon) {
    const currentInside = keepAbove
      ? current.y >= boundary - EPSILON
      : current.y <= boundary + EPSILON;
    if (currentInside !== previousInside) {
      const span = current.y - previous.y;
      if (Math.abs(span) > EPSILON) {
        output.push(mix(previous, current, (boundary - previous.y) / span));
      }
    }
    if (currentInside) output.push(current);
    previous = current;
    previousInside = currentInside;
  }
  return output;
}

function clipAtX(
  polygon: ReadonlyArray<Vertex>,
  boundary: number,
  keepRight: boolean,
): Array<Vertex> {
  if (polygon.length === 0) return [];
  const output: Array<Vertex> = [];
  let previous = polygon[polygon.length - 1];
  if (previous === undefined) return output;
  let previousInside = keepRight
    ? previous.x >= boundary - EPSILON
    : previous.x <= boundary + EPSILON;

  for (const current of polygon) {
    const currentInside = keepRight
      ? current.x >= boundary - EPSILON
      : current.x <= boundary + EPSILON;
    if (currentInside !== previousInside) {
      const span = current.x - previous.x;
      if (Math.abs(span) > EPSILON) {
        output.push(mix(previous, current, (boundary - previous.x) / span));
      }
    }
    if (currentInside) output.push(current);
    previous = current;
    previousInside = currentInside;
  }
  return output;
}

function rowCuts(
  minY: number,
  maxY: number,
  halfHeight: number,
  step: number,
) {
  const cuts = [minY];
  const first = Math.floor((minY + halfHeight) / step) + 1;
  for (let index = first; ; index += 1) {
    const y = -halfHeight + index * step;
    if (y >= maxY - EPSILON) break;
    cuts.push(y);
  }
  cuts.push(maxY);
  return cuts;
}

function transformedNormal(
  vertex: Vertex,
  slopeX: number,
  slopeY: number,
  depthScale: number,
  axialScale: number,
  capFacing: -1 | 0 | 1,
): Vector3 {
  if (capFacing !== 0) {
    return new Vector3(
      -slopeX * depthScale * capFacing,
      -slopeY * depthScale * capFacing,
      capFacing,
    ).normalize();
  }
  // Inverse-transpose of
  // F(x,y,z) = (x,y,z + q(z) * (crownX(x) + crownY(y))). Multiplying the
  // result by the positive axial scale avoids a division without changing its
  // direction.
  return new Vector3(
    axialScale * vertex.nx - slopeX * depthScale * vertex.nz,
    axialScale * vertex.ny - slopeY * depthScale * vertex.nz,
    vertex.nz,
  ).normalize();
}

/**
 * Tessellates an extrusion in both axes, then applies smooth X/Y crowns.
 *
 * Three 0.185's `ExtrudeGeometry` is non-indexed. Its own
 * `computeVertexNormals()` therefore assigns one face normal to each Earcut
 * triangle. This function never calls it: every cap vertex receives the
 * analytic normal of the sixth-order deformation, independent of Earcut's hole
 * triangles. The crown is zero at the rear handoff and reaches full depth only
 * at the face. That keeps the material seam planar; applying the full offset
 * to every layer creates an open, visibly undulating gap against the steel.
 * X/Y strip clipping makes the mesh approximate both crowns to a deterministic
 * sub-pixel bound while preserving the original bevel, side walls, holes and
 * UVs.
 */
export function tessellateVerticalCrown(
  source: BufferGeometry,
  halfHeight: number,
  crown: number,
  rowStep = BODY_CROWN_ROW_STEP,
  edge: EdgeCrown = { top: 0, bottom: 0, extent: 1 },
  cross: CrossCrown = { halfWidth: 1, crown: 0 },
): BufferGeometry {
  if (!(rowStep > 0) || !Number.isFinite(rowStep)) {
    throw new Error(
      `crown row step must be finite and positive; got ${rowStep}`,
    );
  }
  if (cross.crown !== 0 && (!(cross.halfWidth > 0) || !Number.isFinite(cross.halfWidth))) {
    throw new Error(`cross crown half-width must be finite and positive; got ${cross.halfWidth}`);
  }
  const position = source.getAttribute("position");
  const normal = source.getAttribute("normal");
  const uv = source.getAttribute("uv");
  if (position === undefined || normal === undefined) {
    throw new Error("crowned shell requires position and normal attributes");
  }
  if (position.count % 3 !== 0) {
    throw new Error("crowned shell requires non-indexed triangles");
  }

  source.computeBoundingBox();
  const box = source.boundingBox;
  if (box === null) throw new Error("crowned shell has no bounds");
  const minZ = box.min.z;
  const maxZ = box.max.z;
  const depthSpan = maxZ - minZ;
  if (!(depthSpan > EPSILON)) {
    throw new Error("crowned shell requires non-zero source depth");
  }
  const positions: Array<number> = [];
  const normals: Array<number> = [];
  const uvs: Array<number> = [];
  const capFaces: Array<number> = [];
  const edgeA = new Vector3();
  const edgeB = new Vector3();

  const emit = (a: Vertex, b: Vertex, c: Vertex, capFacing: -1 | 0 | 1) => {
    const transformed = [a, b, c].map((vertex) => {
      const depthScale = (vertex.z - minZ) / depthSpan;
      const crownOffset =
        verticalCrownOffset(vertex.y, halfHeight, crown) +
        horizontalCrownOffset(vertex.x, cross.halfWidth, cross.crown) +
        edgeCrownOffset(vertex.y, halfHeight, edge);
      return {
        vertex,
        z: vertex.z + depthScale * crownOffset,
        normal: transformedNormal(
          vertex,
          horizontalCrownSlope(vertex.x, cross.halfWidth, cross.crown),
          verticalCrownSlope(vertex.y, halfHeight, crown) +
            edgeCrownSlope(vertex.y, halfHeight, edge),
          depthScale,
          1 + crownOffset / depthSpan,
          capFacing,
        ),
      };
    });
    const first = transformed[0];
    const second = transformed[1];
    const third = transformed[2];
    if (first === undefined || second === undefined || third === undefined)
      return;
    edgeA.set(
      second.vertex.x - first.vertex.x,
      second.vertex.y - first.vertex.y,
      second.z - first.z,
    );
    edgeB.set(
      third.vertex.x - first.vertex.x,
      third.vertex.y - first.vertex.y,
      third.z - first.z,
    );
    if (edgeA.cross(edgeB).lengthSq() <= EPSILON * EPSILON) return;
    for (const item of transformed) {
      positions.push(item.vertex.x, item.vertex.y, item.z);
      normals.push(item.normal.x, item.normal.y, item.normal.z);
      uvs.push(item.vertex.u, item.vertex.v);
      capFaces.push(capFacing);
    }
  };

  const emitPolygon = (
    polygon: ReadonlyArray<Vertex>,
    capFacing: -1 | 0 | 1,
  ) => {
    const anchor = polygon[0];
    if (anchor === undefined) return;
    for (let vertex = 1; vertex < polygon.length - 1; vertex += 1) {
      const b = polygon[vertex];
      const c = polygon[vertex + 1];
      if (b !== undefined && c !== undefined) emit(anchor, b, c, capFacing);
    }
  };

  const emitCrossTessellated = (
    polygon: ReadonlyArray<Vertex>,
    capFacing: -1 | 0 | 1,
  ) => {
    if (cross.crown === 0) {
      emitPolygon(polygon, capFacing);
      return;
    }
    const minX = Math.min(...polygon.map((vertex) => vertex.x));
    const maxX = Math.max(...polygon.map((vertex) => vertex.x));
    const cuts = rowCuts(minX, maxX, cross.halfWidth, rowStep);
    for (let cut = 0; cut < cuts.length - 1; cut += 1) {
      const left = cuts[cut];
      const right = cuts[cut + 1];
      if (left === undefined || right === undefined) continue;
      emitPolygon(
        clipAtX(clipAtX(polygon, left, true), right, false),
        capFacing,
      );
    }
  };

  for (let index = 0; index < position.count; index += 3) {
    const triangle = [
      vertexAt(position, normal, uv, index),
      vertexAt(position, normal, uv, index + 1),
      vertexAt(position, normal, uv, index + 2),
    ];
    const minY = Math.min(...triangle.map((vertex) => vertex.y));
    const maxY = Math.max(...triangle.map((vertex) => vertex.y));
    const allAtMaxZ = triangle.every(
      (vertex) => Math.abs(vertex.z - maxZ) <= EPSILON,
    );
    const allAtMinZ = triangle.every(
      (vertex) => Math.abs(vertex.z - minZ) <= EPSILON,
    );
    const capFacing: -1 | 0 | 1 = allAtMaxZ ? 1 : allAtMinZ ? -1 : 0;

    if (maxY - minY <= EPSILON) {
      emitCrossTessellated(triangle, capFacing);
      continue;
    }

    const cuts = rowCuts(minY, maxY, halfHeight, rowStep);
    for (let cut = 0; cut < cuts.length - 1; cut += 1) {
      const lower = cuts[cut];
      const upper = cuts[cut + 1];
      if (lower === undefined || upper === undefined) continue;
      const polygon = clipAtY(
        clipAtY(triangle, lower, true),
        upper,
        false,
      );
      emitCrossTessellated(polygon, capFacing);
    }
  }

  const geometry = new BufferGeometry();
  geometry.name = "TessellatedCrownedShellGeometry";
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute(
    "crownCap",
    new Float32BufferAttribute(capFaces, 1),
  );
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
