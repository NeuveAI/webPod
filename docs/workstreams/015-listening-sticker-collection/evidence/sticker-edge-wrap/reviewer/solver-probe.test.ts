import { expect, test } from 'bun:test';
import { ExtrudeGeometry, Vector3 } from '/Users/vinicius/code/webPod/packages/device/src/../node_modules/three/build/three.module.js';
import { createStickerWrapSurface } from '/Users/vinicius/code/webPod/docs/workstreams/015-listening-sticker-collection/evidence/sticker-edge-wrap/reviewer/solver-probe';
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
  const anchor=wrap.anchor(165,0);const width=115.5,height=width*1.9768211920529801;for(const [col,row] of [[1,0],[2,0],[1,1]]){const u=(col/32-.5)*width,v=(row/32-.5)*height;console.log(wrap.sample(anchor.x-v,anchor.y+u,0,anchor));}face.dispose();});