import { expect, test } from 'bun:test';
import { ExtrudeGeometry, Vector3 } from '/Users/vinicius/code/webPod/packages/device/node_modules/three/build/three.module.js';
import { createStickerWrapSurface } from '/Users/vinicius/code/webPod/packages/device/src/sticker-wrap';
import { DEFAULT_DEVICE_FORM } from '/Users/vinicius/code/webPod/packages/device/src/form';
import { DEVICE_LAYOUT } from '/Users/vinicius/code/webPod/packages/device/src/layout';
import { silhouetteShape } from '/Users/vinicius/code/webPod/packages/device/src/shapes';
import { frontShellPlan, productShellDepths } from '/Users/vinicius/code/webPod/packages/device/src/product-shell';

test('candidate arc atlas preserves rear center and reaches front with finite outward local frames', () => {
  const body = DEVICE_LAYOUT.body; const form = DEFAULT_DEVICE_FORM;
  const plan = frontShellPlan(body.width, body.height, body.cornerR, form.seamWidth, form.frontBevel);
  const face = new ExtrudeGeometry(silhouetteShape(plan.faceWidth, plan.faceHeight, plan.faceCornerR, 2, 48), { depth: form.frontThickness - 2 * form.frontBevel, bevelEnabled: true, bevelThickness: form.frontBevel, bevelSize: form.frontBevel, bevelSegments: 16, steps: 1 });
  face.translate(0, 0, productShellDepths(body.depth, form.frontThickness).seamZ + form.frontBevel);
  const wrap = createStickerWrapSurface(form, [{ geometry: face }]);
  const center = wrap.anchor(0, 0); expect(center).toEqual({ x: 0, y: 0 });
  expect(wrap.sample(0, 0, 0).point.z).toBeCloseTo(-body.depth / 2);
  let front = false;
  for (const [x, y] of [[165, 0], [-165, 0], [0, 276], [0, -276], [157, 268]]) {
    if (x === undefined || y === undefined) throw new Error('Missing center');
    const anchor = wrap.anchor(x, y); const restored = wrap.sample(anchor.x, anchor.y, 0).point;
    expect(restored.x).toBeCloseTo(x, 1); expect(restored.y).toBeCloseTo(y, 1);
    for (let dx = -110; dx <= 110; dx += 10) for (let dy = -110; dy <= 110; dy += 10) {
      const p = wrap.sample(anchor.x + dx, anchor.y + dy, 0);
      expect([p.point.x, p.point.y, p.point.z, p.normal.x, p.normal.y, p.normal.z].every(Number.isFinite)).toBe(true);
      expect(p.normal.length()).toBeCloseTo(1);
      expect(p.point.dot(p.normal)).toBeGreaterThan(0);
      if (p.point.z > 25) front = true;
    }
  }
  expect(front).toBe(true);
  const width = 115.5, height = width * 1.9768211920529801;
  const samples: {area:number; center:number[]; angle:number; uv:number[]; at:number[]}[]=[];let minArea = Infinity, maxArea = 0;
  for (const [x, y] of [[165, 0], [0, 276], [157, 268]]) for (const angle of [0, Math.PI / 4, Math.PI / 2]) {
    if (x === undefined || y === undefined) throw new Error('Missing center');
    const anchor = wrap.anchor(x, y); const n = 32;
    const point = (col: number, row: number) => { const u = (col / n - .5) * width, v = (row / n - .5) * height; return wrap.sample(anchor.x + u * Math.cos(angle) - v * Math.sin(angle), anchor.y + u * Math.sin(angle) + v * Math.cos(angle), 0); };
    for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
      const a = point(col, row), b = point(col + 1, row), c = point(col, row + 1);
      const crossed = new Vector3().subVectors(c.point, a.point).cross(new Vector3().subVectors(b.point, a.point));
      expect(crossed.dot(a.normal.clone().add(b.normal).add(c.normal))).toBeGreaterThan(0);
      const area = crossed.length() / (width * height / n ** 2); samples.push({area,center:[x,y],angle,uv:[col/n,row/n],at:a.point.toArray()});minArea = Math.min(minArea, area); maxArea = Math.max(maxArea, area);
    }
  }
  samples.sort((a,b)=>a.area-b.area); console.log(JSON.stringify({minimum:samples.slice(0,5),maximum:samples.slice(-3),quantiles:[0,.01,.05,.1,.5,.9,.99,1].map(q=>[q,samples[Math.min(samples.length-1,Math.floor(q*samples.length))]?.area]),belowHalf:samples.filter(s=>s.area<.5).length,total:samples.length}));
  face.dispose();
});
