import { expect, test } from 'bun:test';
import { Vector3 } from 'three';
import { stickerSheetTriangleMetric } from './sticker-sheet-metric';

test('material metric measures both halves independently of rigid pose and triangle ordering', () => {
  const rest = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 7 }] as const;
  const points = rest.map(p => new Vector3(p.x * .7, p.y * 1.3, 0).applyAxisAngle(new Vector3(1, 2, 3).normalize(), 1.7).add(new Vector3(50, -20, 30)));
  const a = points[0], b = points[1], c = points[2]; if (!a || !b || !c) throw new Error('Missing fixture');
  for (const metric of [stickerSheetTriangleMetric(rest, [a, b, c]), stickerSheetTriangleMetric([rest[2], rest[1], rest[0]], [c, b, a])]) {
    expect(metric?.minimumStretch).toBeCloseTo(.7, 10);
    expect(metric?.maximumStretch).toBeCloseTo(1.3, 10);
    expect(metric?.areaRatio).toBeCloseTo(.91, 10);
  }
});

test('analytic cylinder separates known chord contraction from material path and converges with refinement', () => {
  const radius = 26, span = 100, height = 80;
  let previousError = Infinity, previousPenetration = Infinity;
  for (const segments of [16, 32, 64]) {
    const step = span / segments;
    const expected = Math.sin(step / (2 * radius)) / (step / (2 * radius));
    const point = (x: number, y: number) => new Vector3(radius * Math.sin(x / radius), y, radius * Math.cos(x / radius));
    let worstError = 0;
    for (let col = 0; col < segments; col++) {
      const x = -span / 2 + col * step;
      const a = { x, y: 0 }, b = { x: x + step, y: 0 }, c = { x, y: height / segments }, d = { x: x + step, y: height / segments };
      for (const rest of [[a, b, c], [d, c, b]] as const) {
        const metric = stickerSheetTriangleMetric(rest, [point(rest[0].x, rest[0].y), point(rest[1].x, rest[1].y), point(rest[2].x, rest[2].y)]);
        expect(metric).not.toBeNull();
        expect(metric?.minimumStretch).toBeCloseTo(expected, 10);
        expect(metric?.maximumStretch).toBeCloseTo(1, 10);
        worstError = Math.max(worstError, 1 - (metric?.minimumStretch ?? 0));
      }
    }
    const midpoint = point(-step / 2, 0).add(point(step / 2, 0)).multiplyScalar(.5);
    const penetration = radius - Math.hypot(midpoint.x, midpoint.z);
    expect(penetration).toBeCloseTo(radius * (1 - Math.cos(step / (2 * radius))), 10);
    expect(worstError).toBeLessThan(previousError);
    expect(penetration).toBeLessThan(previousPenetration);
    previousError = worstError; previousPenetration = penetration;
  }
  expect(previousError).toBeLessThan(.00016);
  expect(previousPenetration).toBeLessThan(.012);
  // Endpoint contact alone is explicitly NOT triangle-interior clearance.
  expect(previousPenetration).toBeGreaterThan(0);
});

test('degenerate and nonfinite material or rendered triangles are rejected', () => {
  const rest = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] as const;
  expect(stickerSheetTriangleMetric(rest, [new Vector3(), new Vector3(1, 0, 0), new Vector3(2, 0, 0)])).toBeNull();
  expect(stickerSheetTriangleMetric(rest, [new Vector3(), new Vector3(NaN, 0, 0), new Vector3(0, 1, 0)])).toBeNull();
  expect(stickerSheetTriangleMetric([rest[0], rest[0], rest[2]], [new Vector3(), new Vector3(1, 0, 0), new Vector3(0, 1, 0)])).toBeNull();
});
