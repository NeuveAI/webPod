import { BufferAttribute, BufferGeometry, Vector3 } from "three";

import {
  frontShellNormalAt,
  frontShellOffsetAt,
  type FrontSurfaceForm,
} from "./front-surface";

export type FrontControlPatch = {
  readonly centerX: number;
  readonly centerY: number;
  readonly innerRadius: number;
  readonly outerRadius: number;
  /** UVs remain registered to the complete OEM wheel diameter. */
  readonly uvRadius: number;
  readonly surfaceOffset?: number;
};

const DEFAULT_RADIAL_SEGMENTS = 128;
const DEFAULT_RING_SEGMENTS = 24;

type Attributes = {
  readonly positions: Array<number>;
  readonly normals: Array<number>;
  readonly uvs: Array<number>;
};

function pushVertex(
  attributes: Attributes,
  patch: FrontControlPatch,
  form: FrontSurfaceForm,
  x: number,
  y: number,
): void {
  const globalX = patch.centerX + x;
  const globalY = patch.centerY + y;
  const normal = frontShellNormalAt(globalX, globalY, form);
  attributes.positions.push(
    x,
    y,
    frontShellOffsetAt(globalX, globalY, form) +
      (patch.surfaceOffset ?? 0),
  );
  attributes.normals.push(normal.x, normal.y, normal.z);
  attributes.uvs.push(
    x / (2 * patch.uvRadius) + 0.5,
    y / (2 * patch.uvRadius) + 0.5,
  );
}

function finishGeometry(
  attributes: Attributes,
  indices: Array<number>,
): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(attributes.positions), 3),
  );
  geometry.setAttribute(
    "normal",
    new BufferAttribute(new Float32Array(attributes.normals), 3),
  );
  geometry.setAttribute(
    "uv",
    new BufferAttribute(new Float32Array(attributes.uvs), 2),
  );
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function validatePatch(patch: FrontControlPatch): void {
  if (
    !Number.isFinite(patch.innerRadius) ||
    !Number.isFinite(patch.outerRadius) ||
    patch.innerRadius < 0 ||
    !(patch.outerRadius > patch.innerRadius) ||
    !(patch.uvRadius >= patch.outerRadius)
  ) {
    throw new Error("front control patch requires ordered finite radii");
  }
}

/**
 * A zero-wall circular surface patch registered to the front shell crown.
 *
 * The faceplate, wheel, Select and hairline floor all sample the same position
 * and analytic normal functions. Their boundaries therefore meet in C1 at the
 * same physical surface instead of being stacked cylinders. The only depth in
 * the assembly is the explicit sub-hairline floor offset passed by its caller.
 */
export function createFrontControlPatchGeometry(
  patch: FrontControlPatch,
  form: FrontSurfaceForm,
  radialSegments = DEFAULT_RADIAL_SEGMENTS,
  ringSegments = DEFAULT_RING_SEGMENTS,
): BufferGeometry {
  validatePatch(patch);
  if (radialSegments < 3 || ringSegments < 1) {
    throw new Error("front control patch requires tessellated circular rings");
  }

  const attributes: Attributes = { positions: [], normals: [], uvs: [] };
  const indices: Array<number> = [];

  if (patch.innerRadius === 0) {
    pushVertex(attributes, patch, form, 0, 0);
    for (let ring = 1; ring <= ringSegments; ring += 1) {
      const radius = (patch.outerRadius * ring) / ringSegments;
      for (let segment = 0; segment <= radialSegments; segment += 1) {
        const angle = (segment / radialSegments) * Math.PI * 2;
        pushVertex(
          attributes,
          patch,
          form,
          radius * Math.cos(angle),
          radius * Math.sin(angle),
        );
      }
    }

    const firstRing = 1;
    for (let segment = 0; segment < radialSegments; segment += 1) {
      indices.push(0, firstRing + segment, firstRing + segment + 1);
    }
    const stride = radialSegments + 1;
    for (let ring = 1; ring < ringSegments; ring += 1) {
      const innerStart = 1 + (ring - 1) * stride;
      const outerStart = innerStart + stride;
      for (let segment = 0; segment < radialSegments; segment += 1) {
        const a = innerStart + segment;
        const b = a + 1;
        const c = outerStart + segment;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    return finishGeometry(attributes, indices);
  }

  for (let ring = 0; ring <= ringSegments; ring += 1) {
    const radius =
      patch.innerRadius +
      ((patch.outerRadius - patch.innerRadius) * ring) / ringSegments;
    for (let segment = 0; segment <= radialSegments; segment += 1) {
      const angle = (segment / radialSegments) * Math.PI * 2;
      pushVertex(
        attributes,
        patch,
        form,
        radius * Math.cos(angle),
        radius * Math.sin(angle),
      );
    }
  }

  const stride = radialSegments + 1;
  for (let ring = 0; ring < ringSegments; ring += 1) {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const a = ring * stride + segment;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  return finishGeometry(attributes, indices);
}

/** Maximum axial duplication at one XY boundary; non-zero means a sidewall. */
export function maximumCoincidentWallHeight(
  geometry: BufferGeometry,
  precision = 1e-5,
): number {
  const position = geometry.getAttribute("position");
  const heights = new Map<string, { minimum: number; maximum: number }>();
  for (let index = 0; index < position.count; index += 1) {
    const x = Math.round(position.getX(index) / precision);
    const y = Math.round(position.getY(index) / precision);
    const z = position.getZ(index);
    const key = `${x}:${y}`;
    const previous = heights.get(key);
    heights.set(
      key,
      previous === undefined
        ? { minimum: z, maximum: z }
        : {
            minimum: Math.min(previous.minimum, z),
            maximum: Math.max(previous.maximum, z),
          },
    );
  }
  let maximum = 0;
  for (const height of heights.values()) {
    maximum = Math.max(maximum, height.maximum - height.minimum);
  }
  return maximum;
}

/** Normal sampled from a generated patch, useful for C1 boundary gates. */
export function patchNormalAt(
  geometry: BufferGeometry,
  index: number,
): Vector3 {
  const normal = geometry.getAttribute("normal");
  return new Vector3(
    normal.getX(index),
    normal.getY(index),
    normal.getZ(index),
  );
}
