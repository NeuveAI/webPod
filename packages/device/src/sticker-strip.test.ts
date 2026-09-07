import { expect, test } from 'bun:test';
import { createStickerStripProfile } from './sticker-strip';
import { rearShellSections, productShellDepths } from './product-shell';
import { DEVICE_LAYOUT } from './layout';
import { DEFAULT_DEVICE_FORM } from './form';

test('actual straight rear section preserves center coordinates and material arclength', () => {
  const { width, depth } = DEVICE_LAYOUT.body;
  const { seamZ } = productShellDepths(depth, DEFAULT_DEVICE_FORM.frontThickness);
  const rear = rearShellSections(depth, seamZ, DEFAULT_DEVICE_FORM.rearCrownInset);
  const points = rear.map(s => ({ x: width / 2 - s.inset, z: s.z }));
  const profile = createStickerStripProfile(points, points.length);
  expect(profile.sample(-10)).toEqual({ x: (points[0]?.x ?? NaN) - 10, z: -depth / 2 });
  for (const p of points) expect(profile.sample(profile.rearDistance(p.x)).x).toBeCloseTo(p.x, 8);
  let distance = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]; if (!a || !b) throw new Error("Missing fixture section");
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const p = profile.sample(distance + length * .25), q = profile.sample(distance + length * .75);
    expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeCloseTo(length * .5, 9);
    distance += length;
  }
  expect(() => profile.sample(profile.length + .1)).toThrow();
  expect(() => profile.rearDistance(166)).toThrow();
});
