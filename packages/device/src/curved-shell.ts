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

/** Smooth cylindrical crown shared by renderer tests and calibration evidence. */
export function verticalCrownOffset(
  y: number,
  halfHeight: number,
  crown: number,
): number {
  const unitY = Math.min(1, Math.max(-1, y / halfHeight));
  return crown * (1 - unitY * unitY);
}

/** Derivative `dz/dy` of {@link verticalCrownOffset}. */
export function verticalCrownSlope(
  y: number,
  halfHeight: number,
  crown: number,
): number {
  if (y <= -halfHeight || y >= halfHeight) return 0;
  return (-2 * crown * y) / (halfHeight * halfHeight);
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
  slope: number,
  capFacing: -1 | 0 | 1,
): Vector3 {
  if (capFacing !== 0) {
    return new Vector3(0, -slope * capFacing, capFacing).normalize();
  }
  // Inverse-transpose of F(x,y,z) = (x,y,z + crown(y)).
  return new Vector3(
    vertex.nx,
    vertex.ny - slope * vertex.nz,
    vertex.nz,
  ).normalize();
}

/**
 * Tessellates an extrusion in horizontal strips, then applies one smooth crown.
 *
 * Three 0.185's `ExtrudeGeometry` is non-indexed. Its own
 * `computeVertexNormals()` therefore assigns one face normal to each Earcut
 * triangle. This function never calls it: every cap vertex receives the
 * analytic normal of the quadratic, independent of Earcut's hole triangles.
 * Horizontal strip clipping makes the actual mesh approximate that quadratic
 * to a deterministic sub-pixel bound while preserving the original bevel,
 * side walls, holes, UVs, and shell thickness.
 */
export function tessellateVerticalCrown(
  source: BufferGeometry,
  halfHeight: number,
  crown: number,
  rowStep = BODY_CROWN_ROW_STEP,
): BufferGeometry {
  if (!(rowStep > 0) || !Number.isFinite(rowStep)) {
    throw new Error(
      `crown row step must be finite and positive; got ${rowStep}`,
    );
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
  const positions: Array<number> = [];
  const normals: Array<number> = [];
  const uvs: Array<number> = [];
  const capFaces: Array<number> = [];
  const edgeA = new Vector3();
  const edgeB = new Vector3();

  const emit = (a: Vertex, b: Vertex, c: Vertex, capFacing: -1 | 0 | 1) => {
    const transformed = [a, b, c].map((vertex) => ({
      vertex,
      z: vertex.z + verticalCrownOffset(vertex.y, halfHeight, crown),
      normal: transformedNormal(
        vertex,
        verticalCrownSlope(vertex.y, halfHeight, crown),
        capFacing,
      ),
    }));
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
      const [a, b, c] = triangle;
      if (a !== undefined && b !== undefined && c !== undefined) {
        emit(a, b, c, capFacing);
      }
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
      const anchor = polygon[0];
      if (anchor === undefined) continue;
      for (let vertex = 1; vertex < polygon.length - 1; vertex += 1) {
        const b = polygon[vertex];
        const c = polygon[vertex + 1];
        if (b !== undefined && c !== undefined) emit(anchor, b, c, capFacing);
      }
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
