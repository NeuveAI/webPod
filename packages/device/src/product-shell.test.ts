import { describe, expect, test } from "bun:test";
import {
  ExtrudeGeometry,
  type BufferAttribute,
  type InterleavedBufferAttribute,
} from "three";

import { frontCoreDepth } from "./curved-shell";
import { DEFAULT_DEVICE_FORM } from "./form";
import { DEVICE_LAYOUT } from "./layout";
import {
  createRearShellGeometry,
  frontShellPlan,
  productShellDepths,
  rearShellSections,
} from "./product-shell";
import { silhouetteShape } from "./shapes";

function productionRearShell() {
  const { body } = DEVICE_LAYOUT;
  const { seamZ } = productShellDepths(
    body.depth,
    DEFAULT_DEVICE_FORM.frontThickness,
  );
  return {
    seamZ,
    geometry: createRearShellGeometry({
      width: body.width,
      height: body.height,
      depth: body.depth,
      cornerR: body.cornerR,
      exponent: body.exponent,
      frontThickness: DEFAULT_DEVICE_FORM.frontThickness,
      rearCrownInset: DEFAULT_DEVICE_FORM.rearCrownInset,
    }),
  };
}

describe("shared shell depth contract", () => {
  test("gives both materials one seam instead of two independently placed slabs", () => {
    const { body } = DEVICE_LAYOUT;
    const depths = productShellDepths(
      body.depth,
      DEFAULT_DEVICE_FORM.frontThickness,
    );
    expect(depths.rearFaceZ).toBeCloseTo(-body.depth / 2, 10);
    expect(depths.frontFaceZ).toBeCloseTo(body.depth / 2, 10);
    expect(depths.seamZ).toBeCloseTo(
      body.depth / 2 - DEFAULT_DEVICE_FORM.frontThickness,
      10,
    );
    expect(depths.seamZ - depths.rearFaceZ).toBeCloseTo(
      body.depth - DEFAULT_DEVICE_FORM.frontThickness,
      10,
    );
    expect(depths.frontFaceZ - depths.seamZ).toBeCloseTo(14, 10);
  });

  test("rejects a front that consumes or escapes the physical depth", () => {
    const { depth } = DEVICE_LAYOUT.body;
    expect(() => productShellDepths(depth, 0)).toThrow();
    expect(() => productShellDepths(depth, depth)).toThrow();
    expect(() => productShellDepths(depth, depth + 2)).toThrow();
  });
});

describe("formed-steel rear shell", () => {
  test("hands off to the front at one exact seam plane without overlap", () => {
    const { body } = DEVICE_LAYOUT;
    const { geometry, seamZ } = productionRearShell();
    geometry.computeBoundingBox();
    expect(geometry.boundingBox?.min.z).toBeCloseTo(-body.depth / 2, 5);
    expect(geometry.boundingBox?.max.z).toBeCloseTo(seamZ, 5);
    expect(seamZ).toBeCloseTo(body.depth / 2 - 14, 10);
    expect(seamZ).not.toBe(0);
    geometry.dispose();
  });

  test("is one rolled tray rather than two equal-depth slabs", () => {
    const { body } = DEVICE_LAYOUT;
    const { seamZ } = productShellDepths(
      body.depth,
      DEFAULT_DEVICE_FORM.frontThickness,
    );
    const rearDepth = seamZ + body.depth / 2;
    const sections = rearShellSections(
      body.depth,
      seamZ,
      DEFAULT_DEVICE_FORM.rearCrownInset,
    );
    expect(rearDepth).toBeCloseTo(body.depth - 14, 10);
    expect(rearDepth / body.depth).toBeGreaterThan(0.7);
    expect(DEFAULT_DEVICE_FORM.frontThickness / body.depth).toBeLessThan(0.3);
    expect(sections).toHaveLength(11);
    expect(sections[0]).toEqual({ z: -body.depth / 2, inset: 8.5 });
    expect(sections.at(-1)).toEqual({ z: seamZ, inset: 0 });
    for (let index = 1; index < sections.length; index += 1) {
      const previous = sections[index - 1];
      const current = sections[index];
      if (previous === undefined || current === undefined) continue;
      expect(current.z).toBeGreaterThan(previous.z);
      expect(current.inset).toBeLessThan(previous.inset);
    }
    expect(sections[5]?.inset).toBeCloseTo(4.25, 10);
  });

  test("keeps every open boundary edge on the intentional front seam", () => {
    const { geometry, seamZ } = productionRearShell();
    const position = geometry.getAttribute("position");
    const index = geometry.getIndex();
    if (index === null) throw new Error("production rear shell must be indexed");
    const edges = new Map<string, { count: number; a: number; b: number }>();
    for (let cursor = 0; cursor < index.count; cursor += 3) {
      const triangle = [index.getX(cursor), index.getX(cursor + 1), index.getX(cursor + 2)];
      for (let edge = 0; edge < 3; edge += 1) {
        const a = triangle[edge];
        const b = triangle[(edge + 1) % 3];
        if (a === undefined || b === undefined) continue;
        const low = Math.min(a, b);
        const high = Math.max(a, b);
        const key = `${low}:${high}`;
        const previous = edges.get(key);
        edges.set(key, {
          count: (previous?.count ?? 0) + 1,
          a: low,
          b: high,
        });
      }
    }
    const boundary = [...edges.values()].filter((edge) => edge.count === 1);
    expect(boundary.length).toBeGreaterThan(32);
    for (const edge of boundary) {
      expect(position.getZ(edge.a)).toBeCloseTo(seamZ, 5);
      expect(position.getZ(edge.b)).toBeCloseTo(seamZ, 5);
    }
    expect([...edges.values()].every((edge) => edge.count <= 2)).toBe(true);
    geometry.dispose();
  });

  test("shares finite unit normals across the rear roll", () => {
    const { geometry } = productionRearShell();
    const normal = geometry.getAttribute("normal") as
      | BufferAttribute
      | InterleavedBufferAttribute;
    for (let index = 0; index < normal.count; index += 1) {
      const length = Math.hypot(
        normal.getX(index),
        normal.getY(index),
        normal.getZ(index),
      );
      expect(Number.isFinite(length)).toBe(true);
      expect(length).toBeCloseTo(1, 5);
    }
    geometry.dispose();
  });

  test("tapers from an inset rear face to the full seam silhouette", () => {
    const { body } = DEVICE_LAYOUT;
    const { geometry, seamZ } = productionRearShell();
    const position = geometry.getAttribute("position");
    let seamMaxX = Number.NEGATIVE_INFINITY;
    let rearMaxX = Number.NEGATIVE_INFINITY;
    const rearZ = -body.depth / 2;
    for (let index = 0; index < position.count; index += 1) {
      if (Math.abs(position.getZ(index) - seamZ) < 1e-5) {
        seamMaxX = Math.max(seamMaxX, position.getX(index));
      }
      if (Math.abs(position.getZ(index) - rearZ) < 1e-5) {
        rearMaxX = Math.max(rearMaxX, position.getX(index));
      }
    }
    expect(seamMaxX).toBeCloseTo(body.width / 2, 5);
    expect(rearMaxX).toBeCloseTo(
      body.width / 2 - DEFAULT_DEVICE_FORM.rearCrownInset,
      5,
    );
    geometry.dispose();
  });
});

describe("polycarbonate front roll", () => {
  test("never grows beyond the declared steel silhouette", () => {
    const { body } = DEVICE_LAYOUT;
    const form = DEFAULT_DEVICE_FORM;
    const plan = frontShellPlan(
      body.width,
      body.height,
      body.cornerR,
      form.seamWidth,
      form.frontBevel,
    );
    expect(plan).toEqual({
      faceWidth: 320.6,
      faceHeight: 542.6,
      faceCornerR: 21.3,
      projectedWidth: 327.6,
      projectedHeight: 549.6,
      projectedCornerR: 24.8,
    });
    expect(plan.projectedWidth).toBe(body.width - 2 * form.seamWidth);
    expect(plan.projectedHeight).toBe(body.height - 2 * form.seamWidth);

    const source = new ExtrudeGeometry(
      silhouetteShape(
        plan.faceWidth,
        plan.faceHeight,
        plan.faceCornerR,
        body.exponent,
      ),
      {
        depth: frontCoreDepth(form.frontThickness, form.frontBevel),
        bevelEnabled: true,
        bevelThickness: form.frontBevel,
        bevelSize: form.frontBevel,
        bevelSegments: 8,
        curveSegments: 1,
      },
    );
    source.computeBoundingBox();
    expect(source.boundingBox?.max.x).toBeCloseTo(plan.projectedWidth / 2, 4);
    expect(source.boundingBox?.min.x).toBeCloseTo(-plan.projectedWidth / 2, 4);
    expect(source.boundingBox?.max.y).toBeCloseTo(plan.projectedHeight / 2, 4);
    expect(source.boundingBox?.min.y).toBeCloseTo(-plan.projectedHeight / 2, 4);
    expect(plan.projectedWidth).toBeLessThan(body.width);

    // The rejected construction fed Three the already-final inset plan, then
    // let its bevel expand it a second time: 334.6 > 330.
    const rejectedWidth =
      body.width - 2 * form.seamWidth + 2 * form.frontBevel;
    expect(rejectedWidth).toBeCloseTo(334.6, 10);
    expect(rejectedWidth).toBeGreaterThan(body.width);
    source.dispose();
  });
});
