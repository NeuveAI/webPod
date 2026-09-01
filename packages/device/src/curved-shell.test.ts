import { describe, expect, test } from "bun:test";
import {
  Euler,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Shape,
  Vector3,
} from "three";

import {
  BODY_CROWN_ROW_STEP,
  edgeCrownOffset,
  edgeCrownSlope,
  frontCoreDepth,
  horizontalCrownOffset,
  horizontalCrownSlope,
  tessellateVerticalCrown,
  verticalCrownOffset,
  verticalCrownSlope,
} from "./curved-shell";
import { DEVICE_LAYOUT, GLASS_CORNER_R } from "./layout";
import { DEFAULT_DEVICE_FORM } from "./form";
import {
  DEVICE_ORIENTATION_PRESETS,
  deviceOrientationToRotation,
} from "./orientation";
import { circleHole, roundedRectHole, silhouetteShape } from "./shapes";

function rectangle(width: number, height: number) {
  const shape = new Shape();
  shape.moveTo(-width / 2, -height / 2);
  shape.lineTo(width / 2, -height / 2);
  shape.lineTo(width / 2, height / 2);
  shape.lineTo(-width / 2, height / 2);
  shape.closePath();
  return shape;
}

function actualFrontShape() {
  const { body, glass, wheel } = DEVICE_LAYOUT;
  const seam = 2;
  const shape = silhouetteShape(
    body.width - 2 * seam,
    body.height - 2 * seam,
    body.cornerR - seam,
    body.exponent,
  );
  shape.holes.push(
    roundedRectHole(
      glass.centerX,
      glass.centerY,
      glass.width,
      glass.height,
      GLASS_CORNER_R,
    ),
  );
  shape.holes.push(circleHole(wheel.centerX, wheel.centerY, wheel.outerR));
  return shape;
}

function maxNormalSplitOnFront(
  geometry: ExtrudeGeometry | ReturnType<typeof tessellateVerticalCrown>,
  frontBaseZ: number,
  halfHeight: number,
  crown: number,
  edge = { top: 0, bottom: 0, extent: 1 },
  cross = { halfWidth: 1, crown: 0 },
) {
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const capFaces = geometry.getAttribute("crownCap");
  const byPosition = new Map<string, Array<Vector3>>();
  for (let index = 0; index < positions.count; index += 1) {
    const y = positions.getY(index);
    const expectedZ =
      frontBaseZ +
      verticalCrownOffset(y, halfHeight, crown) +
      horizontalCrownOffset(positions.getX(index), cross.halfWidth, cross.crown) +
      edgeCrownOffset(y, halfHeight, edge);
    if (Math.abs(positions.getZ(index) - expectedZ) > 1e-4) continue;
    if (capFaces !== undefined && capFaces.getX(index) !== 1) continue;
    if (normals.getZ(index) < 0.9) continue;
    const key = [positions.getX(index), y, positions.getZ(index)]
      .map((value) => value.toFixed(4))
      .join(":");
    const entries = byPosition.get(key) ?? [];
    entries.push(
      new Vector3(
        normals.getX(index),
        normals.getY(index),
        normals.getZ(index),
      ).normalize(),
    );
    byPosition.set(key, entries);
  }
  let max = 0;
  for (const entries of byPosition.values()) {
    for (let a = 0; a < entries.length; a += 1) {
      for (let b = a + 1; b < entries.length; b += 1) {
        const first = entries[a];
        const second = entries[b];
        if (first === undefined || second === undefined) continue;
        max = Math.max(max, first.angleTo(second));
      }
    }
  }
  return max;
}

function markOriginalFrontCap(geometry: ExtrudeGeometry) {
  geometry.computeBoundingBox();
  const maxZ = geometry.boundingBox?.max.z;
  if (maxZ === undefined) throw new Error("test extrusion has no front bound");
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const flags = new Float32Array(positions.count);
  for (let index = 0; index < positions.count; index += 1) {
    if (
      Math.abs(positions.getZ(index) - maxZ) < 1e-6 &&
      normals.getZ(index) > 0.99
    ) {
      flags[index] = 1;
    }
  }
  geometry.setAttribute("crownCap", new Float32BufferAttribute(flags, 1));
}

describe("tessellated vertical shell crown", () => {
  test("macro and edge profiles meet every shell join with a zero tangent", () => {
    const halfHeight = DEVICE_LAYOUT.body.height / 2 - DEFAULT_DEVICE_FORM.seamWidth;
    const edge = {
      top: DEFAULT_DEVICE_FORM.topEdgeCrown,
      bottom: DEFAULT_DEVICE_FORM.bottomEdgeCrown,
      extent: DEFAULT_DEVICE_FORM.edgeCrownExtent,
    };
    const epsilon = 1e-4;

    for (const side of [-1, 1] as const) {
      const outer = side * halfHeight;
      const inner = side * (halfHeight - edge.extent);
      expect(verticalCrownSlope(outer, halfHeight, DEFAULT_DEVICE_FORM.bodyCrown)).toBe(0);
      expect(edgeCrownOffset(outer, halfHeight, edge)).toBeCloseTo(0, 12);
      expect(edgeCrownSlope(outer, halfHeight, edge)).toBeCloseTo(0, 12);
      expect(edgeCrownOffset(inner, halfHeight, edge)).toBeCloseTo(0, 12);
      expect(edgeCrownSlope(inner, halfHeight, edge)).toBeCloseTo(0, 12);

      const macroApproach =
        (verticalCrownOffset(outer, halfHeight, DEFAULT_DEVICE_FORM.bodyCrown) -
          verticalCrownOffset(outer - side * epsilon, halfHeight, DEFAULT_DEVICE_FORM.bodyCrown)) /
        (side * epsilon);
      const outerEdgeApproach =
        (edgeCrownOffset(outer, halfHeight, edge) -
          edgeCrownOffset(outer - side * epsilon, halfHeight, edge)) /
        (side * epsilon);
      const innerEdgeApproach =
        (edgeCrownOffset(inner + side * epsilon, halfHeight, edge) -
          edgeCrownOffset(inner, halfHeight, edge)) /
        (side * epsilon);
      expect(Math.abs(macroApproach)).toBeLessThan(1e-5);
      expect(Math.abs(outerEdgeApproach)).toBeLessThan(1e-5);
      expect(Math.abs(innerEdgeApproach)).toBeLessThan(1e-5);
    }
  });

  test("all four corner joins remain normal-continuous in every rotated pose", () => {
    const halfHeight = DEVICE_LAYOUT.body.height / 2 - DEFAULT_DEVICE_FORM.seamWidth;
    const edge = {
      top: DEFAULT_DEVICE_FORM.topEdgeCrown,
      bottom: DEFAULT_DEVICE_FORM.bottomEdgeCrown,
      extent: DEFAULT_DEVICE_FORM.edgeCrownExtent,
    };
    const halfWidth = DEVICE_LAYOUT.body.width / 2 - DEFAULT_DEVICE_FORM.seamWidth;
    const epsilon = 1e-4;
    const joinedNormal = (x: number, y: number) =>
      new Vector3(
        -horizontalCrownSlope(x, halfWidth, DEFAULT_DEVICE_FORM.bodyCrossCrown),
        -(verticalCrownSlope(y, halfHeight, DEFAULT_DEVICE_FORM.bodyCrown) +
          edgeCrownSlope(y, halfHeight, edge)),
        1,
      ).normalize();

    for (const sideY of [-1, 1] as const) {
      const joins = [
        sideY * halfHeight,
        sideY * (halfHeight - edge.extent),
      ];
      for (const sideX of [-1, 1] as const) {
        for (const orientation of Object.values(DEVICE_ORIENTATION_PRESETS)) {
          const rotation = new Euler(...deviceOrientationToRotation(orientation), "XYZ");
          for (const join of joins) {
            const towardCenter = join - sideY * epsilon;
            const awayFromCenter = join + sideY * epsilon;
            const cornerX = sideX * halfWidth;
            const before = joinedNormal(cornerX, towardCenter).applyEuler(rotation);
            const after = joinedNormal(cornerX, awayFromCenter).applyEuler(rotation);
            expect(before.angleTo(after)).toBeLessThan(1e-5);

            const xBefore = joinedNormal(
              cornerX - sideX * epsilon,
              towardCenter,
            ).applyEuler(rotation);
            const xAfter = joinedNormal(
              cornerX + sideX * epsilon,
              towardCenter,
            ).applyEuler(rotation);
            expect(xBefore.angleTo(xAfter)).toBeLessThan(1e-5);
          }
        }
      }
    }
  });

  test("the production front cap has no corner triangulation or duplicate-normal split", () => {
    const form = DEFAULT_DEVICE_FORM;
    const halfHeight = DEVICE_LAYOUT.body.height / 2 - form.seamWidth;
    const halfWidth = DEVICE_LAYOUT.body.width / 2 - form.seamWidth;
    const edge = {
      top: form.topEdgeCrown,
      bottom: form.bottomEdgeCrown,
      extent: form.edgeCrownExtent,
    };
    const cross = {
      halfWidth,
      crown: form.bodyCrossCrown,
    };
    const source = new ExtrudeGeometry(actualFrontShape(), {
      depth: frontCoreDepth(form.frontThickness, form.frontBevel),
      bevelEnabled: true,
      bevelThickness: form.frontBevel,
      bevelSize: form.frontBevel,
      bevelSegments: 6,
      curveSegments: 1,
    });
    source.computeBoundingBox();
    const frontBaseZ = source.boundingBox?.max.z;
    if (frontBaseZ === undefined) throw new Error("production front has no bounds");
    const geometry = tessellateVerticalCrown(
      source,
      halfHeight,
      form.bodyCrown,
      BODY_CROWN_ROW_STEP,
      edge,
      cross,
    );
    const positions = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    const caps = geometry.getAttribute("crownCap");
    const cornerGroups = new Map<string, Map<string, Array<Vector3>>>();
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) cornerGroups.set(`${sx}:${sy}`, new Map());
    }

    for (let index = 0; index < positions.count; index += 1) {
      if (caps.getX(index) !== 1) continue;
      const x = positions.getX(index);
      const y = positions.getY(index);
      if (
        Math.abs(x) < halfWidth - DEVICE_LAYOUT.body.cornerR - 1 ||
        Math.abs(y) < halfHeight - DEVICE_LAYOUT.body.cornerR - 1
      ) continue;
      const corner = `${Math.sign(x)}:${Math.sign(y)}`;
      const groups = cornerGroups.get(corner);
      if (groups === undefined) continue;
      const key = [x, y, positions.getZ(index)].map((value) => value.toFixed(4)).join(":");
      const entries = groups.get(key) ?? [];
      entries.push(
        new Vector3(normals.getX(index), normals.getY(index), normals.getZ(index)).normalize(),
      );
      groups.set(key, entries);
    }

    for (const groups of cornerGroups.values()) {
      expect(groups.size).toBeGreaterThan(12);
      let duplicateCount = 0;
      for (const entries of groups.values()) {
        if (entries.length < 2) continue;
        duplicateCount += 1;
        const first = entries[0];
        if (first === undefined) continue;
        for (const normal of entries.slice(1)) {
          expect(first.angleTo(normal)).toBeLessThan(1e-6);
        }
      }
      expect(duplicateCount).toBeGreaterThan(4);
    }
    expect(
      maxNormalSplitOnFront(
        geometry,
        frontBaseZ,
        halfHeight,
        form.bodyCrown,
        edge,
        cross,
      ),
    ).toBeLessThan(1e-6);

    const capNormalNear = (targetX: number): Vector3 => {
      let bestIndex = -1;
      let bestDistance = Infinity;
      for (let index = 0; index < positions.count; index += 1) {
        if (caps.getX(index) !== 1) continue;
        const distance = Math.hypot(
          positions.getX(index) - targetX,
          positions.getY(index),
        );
        if (distance < bestDistance) {
          bestIndex = index;
          bestDistance = distance;
        }
      }
      if (bestIndex < 0) throw new Error("front cap normal sample is absent");
      return new Vector3(
        normals.getX(bestIndex),
        normals.getY(bestIndex),
        normals.getZ(bestIndex),
      ).normalize();
    };
    expect(capNormalNear(-halfWidth / 2).x).toBeLessThan(-0.005);
    expect(capNormalNear(halfWidth / 2).x).toBeGreaterThan(0.005);
    source.dispose();
    geometry.dispose();
  });

  test("zero secondary crown is byte-identical", () => {
    const source = new ExtrudeGeometry(rectangle(40, 80), { depth: 14, bevelEnabled: false });
    const baseline = tessellateVerticalCrown(source, 40, -6, 4);
    const zero = tessellateVerticalCrown(source, 40, -6, 4, { top: 0, bottom: 0, extent: 36 });
    for (const name of ["position", "normal", "uv", "crownCap"]) {
      expect(Array.from(zero.getAttribute(name).array)).toEqual(Array.from(baseline.getAttribute(name).array));
    }
    source.dispose(); baseline.dispose(); zero.dispose();
  });

  test("bounded edge crown is local, manifold, smooth, and thickness-preserving", () => {
    const edge = { top: 3, bottom: -3, extent: 36 };
    expect(edgeCrownOffset(0, 40, edge)).toBe(0);
    expect(edgeCrownSlope(0, 40, edge)).toBe(0);
    const source = new ExtrudeGeometry(rectangle(40, 80), { depth: 14, bevelEnabled: false });
    const geometry = tessellateVerticalCrown(source, 40, -6, 4, edge);
    const positions = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    const spans = new Map<string, { min: number; max: number }>();
    for (let index = 0; index < positions.count; index += 1) {
      const key = `${positions.getX(index).toFixed(4)}:${positions.getY(index).toFixed(4)}`;
      const z = positions.getZ(index);
      const span = spans.get(key) ?? { min: z, max: z };
      span.min = Math.min(span.min, z); span.max = Math.max(span.max, z); spans.set(key, span);
      expect(new Vector3(normals.getX(index), normals.getY(index), normals.getZ(index)).length()).toBeCloseTo(1, 5);
    }
    for (const span of [...spans.values()].filter((value) => value.max - value.min > 13)) {
      expect(span.max - span.min).toBeCloseTo(14, 5);
    }
    for (let index = 0; index < positions.count; index += 3) {
      const a = new Vector3().fromBufferAttribute(positions, index);
      const b = new Vector3().fromBufferAttribute(positions, index + 1);
      const c = new Vector3().fromBufferAttribute(positions, index + 2);
      expect(b.sub(a).cross(c.sub(a)).lengthSq()).toBeGreaterThan(1e-12);
    }
    source.dispose(); geometry.dispose();
  });
  test("is one smooth macro curve with fixed top and bottom joins", () => {
    expect(verticalCrownOffset(-100, 100, 12)).toBe(0);
    expect(verticalCrownOffset(0, 100, 12)).toBe(12);
    expect(verticalCrownOffset(100, 100, 12)).toBe(0);
    expect(verticalCrownOffset(-50, 100, 12)).toBeCloseTo(9, 12);
    expect(verticalCrownOffset(50, 100, 12)).toBeCloseTo(9, 12);
    expect(verticalCrownSlope(-50, 100, 12)).toBeCloseTo(0.15, 12);
    expect(verticalCrownSlope(50, 100, 12)).toBeCloseTo(-0.15, 12);
  });

  test("refuses the old clamped bevel/thickness combination", () => {
    expect(frontCoreDepth(14, 5.875)).toBe(2.25);
    expect(() => frontCoreDepth(7, 5.875)).toThrow(
      "thickness > 2 * bevel",
    );
  });

  test("tessellates every front triangle in the crown direction", () => {
    const halfHeight = DEVICE_LAYOUT.body.height / 2 - 2;
    const crown = -2.125;
    const source = new ExtrudeGeometry(actualFrontShape(), {
      depth: 2.25,
      bevelEnabled: true,
      bevelThickness: 5.875,
      bevelSize: 5.875,
      bevelSegments: 4,
    });
    source.computeBoundingBox();
    const frontBaseZ = source.boundingBox?.max.z;
    expect(frontBaseZ).toBeDefined();
    if (frontBaseZ === undefined) return;
    const sourceCount = source.getAttribute("position").count;
    const geometry = tessellateVerticalCrown(source, halfHeight, crown);
    const positions = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    let frontTriangles = 0;

    expect(positions.count).toBeGreaterThan(sourceCount * 4);
    for (let index = 0; index < positions.count; index += 3) {
      const ys = [
        positions.getY(index),
        positions.getY(index + 1),
        positions.getY(index + 2),
      ];
      const isFront = [0, 1, 2].every((offset) => {
        const y = positions.getY(index + offset);
        const expectedZ = frontBaseZ + verticalCrownOffset(y, halfHeight, crown);
        return (
          Math.abs(positions.getZ(index + offset) - expectedZ) < 1e-4 &&
          normals.getZ(index + offset) > 0.9
        );
      });
      if (!isFront) continue;
      frontTriangles += 1;
      expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(
        BODY_CROWN_ROW_STEP + 1e-5,
      );
      for (const offset of [0, 1, 2]) {
        const y = positions.getY(index + offset);
        const expected = new Vector3(
          0,
          -verticalCrownSlope(y, halfHeight, crown),
          1,
        ).normalize();
        const actual = new Vector3(
          normals.getX(index + offset),
          normals.getY(index + offset),
          normals.getZ(index + offset),
        ).normalize();
        expect(actual.angleTo(expected)).toBeLessThan(1e-6);
      }
    }
    expect(frontTriangles).toBeGreaterThan(100);
    source.dispose();
    geometry.dispose();
  });

  test("removes the non-indexed Earcut normal split the old deformation kept", () => {
    const halfHeight = DEVICE_LAYOUT.body.height / 2 - 2;
    const crown = -2.125;
    const source = new ExtrudeGeometry(actualFrontShape(), {
      depth: 2.25,
      bevelEnabled: true,
      bevelThickness: 5.875,
      bevelSize: 5.875,
      bevelSegments: 4,
    });
    source.computeBoundingBox();
    const frontBaseZ = source.boundingBox?.max.z;
    expect(frontBaseZ).toBeDefined();
    if (frontBaseZ === undefined) return;

    const legacy = source.clone();
    markOriginalFrontCap(legacy);
    const legacyPositions = legacy.getAttribute("position");
    for (let index = 0; index < legacyPositions.count; index += 1) {
      const y = legacyPositions.getY(index);
      legacyPositions.setZ(
        index,
        legacyPositions.getZ(index) +
          verticalCrownOffset(y, halfHeight, crown),
      );
    }
    legacy.computeVertexNormals();

    const geometry = tessellateVerticalCrown(source, halfHeight, crown);
    expect(
      maxNormalSplitOnFront(legacy, frontBaseZ, halfHeight, crown),
    ).toBeGreaterThan((5 * Math.PI) / 180);
    expect(
      maxNormalSplitOnFront(geometry, frontBaseZ, halfHeight, crown),
    ).toBeLessThan(1e-6);
    source.dispose();
    legacy.dispose();
    geometry.dispose();
  });

  test("preserves shell thickness while bending both faces", () => {
    const source = new ExtrudeGeometry(rectangle(40, 80), {
      depth: 14,
      bevelEnabled: false,
    });
    const geometry = tessellateVerticalCrown(source, 40, -6, 4);
    const positions = geometry.getAttribute("position");
    const spans = new Map<string, { min: number; max: number }>();
    for (let index = 0; index < positions.count; index += 1) {
      const key = `${positions.getX(index).toFixed(4)}:${positions.getY(index).toFixed(4)}`;
      const z = positions.getZ(index);
      const span = spans.get(key) ?? { min: z, max: z };
      span.min = Math.min(span.min, z);
      span.max = Math.max(span.max, z);
      spans.set(key, span);
    }
    const fullDepthSpans = [...spans.values()].filter(
      (span) => span.max - span.min > 13,
    );
    expect(fullDepthSpans.length).toBeGreaterThan(20);
    for (const span of fullDepthSpans) {
      expect(span.max - span.min).toBeCloseTo(14, 5);
    }
    source.dispose();
    geometry.dispose();
  });
});
