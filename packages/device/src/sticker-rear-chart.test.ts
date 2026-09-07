import { expect, test } from 'bun:test';
import { BufferGeometry, Vector3 } from 'three';
import { getSticker } from '@webpod/stickers';
import { createStickerRearChart } from './sticker-rear-chart';
import { createStickerSurfaceGeometry, stickerVisibleAspect } from './sticker-surface';
import { DEFAULT_DEVICE_FORM } from './form';
import { DEVICE_LAYOUT } from './layout';

test('large rotated prints fit the steel, span two edges and never enter the faceplate', () => {
  const chart = createStickerRearChart(DEFAULT_DEVICE_FORM), rear = new BufferGeometry();
  const art = getSticker('PW-C01');
  if (!art) throw new Error('Missing fixture');
  let twoEdges = false;
  for (const width of [.35, .8, 1.2]) for (const angle of [0, 37, 90, 173]) for (const [x, y] of [[.5, .5], [.02, .02], [.98, .5], [.5, .98]]) {
    if (x === undefined || y === undefined) throw new Error('Missing center');
    const placement = { stickerId: art.id, surface: 'back' as const, x, y, width, rotationDeg: angle };
    const geometry = createStickerSurfaceGeometry(art, placement, rear, chart);
    const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
    let left = false, right = false, top = false;
    for (let i = 0; i < positions.count; i++) {
      const point = new Vector3().fromBufferAttribute(positions, i);
      expect([point.x, point.y, point.z].every(Number.isFinite)).toBe(true);
      expect(point.z).toBeLessThan(chart.seamZ);
      expect(new Vector3().fromBufferAttribute(normals, i).length()).toBeGreaterThan(.9);
      if (point.z > -DEVICE_LAYOUT.body.depth / 2 + 1) {
        left ||= point.x < -145; right ||= point.x > 145; top ||= point.y > 255;
      }
    }
    twoEdges ||= left && right || left && top || right && top;
    const fitted = chart.fit((.5 - x) * 330, (.5 - y) * 552, { width: width * 330, height: width * 330 * stickerVisibleAspect(art), angle: angle * Math.PI / 180 });
    const again = chart.fit(fitted.x, fitted.y, { width: width * fitted.scale * 330, height: width * fitted.scale * 330 * stickerVisibleAspect(art), angle: angle * Math.PI / 180 });
    expect(again.scale).toBeCloseTo(1, 6);
    expect(again.x).toBeCloseTo(fitted.x, 5);
    expect(again.y).toBeCloseTo(fitted.y, 5);
    geometry.dispose();
  }
  expect(twoEdges).toBe(true);
  rear.dispose();
});

test('large film triangle interiors clear the continuous steel shoulder', () => {
const art = getSticker('PW-B01'); if (!art) throw new Error('Missing artwork');
const chart = createStickerRearChart(DEFAULT_DEVICE_FORM);
for(const width of [.35,1,1.2]) {
 const placement={stickerId:art.id,surface:'back' as const,x:.8,y:.3,width,rotationDeg:13};
 const geometry=createStickerSurfaceGeometry(art,placement,new BufferGeometry(),chart);
 const cage=chart.cornerCage((.5-placement.x)*330,(.5-placement.y)*552,{width:width*330,height:width*330*stickerVisibleAspect(art),angle:13*Math.PI/180});
 const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),ids=geometry.index;
 if (!ids) throw new Error('Missing triangle indices');
 let min=Infinity, under=0;
 for(let i=0;i<ids.count;i+=3){
  const pos=new Vector3(), normal=new Vector3();let u=0,v=0;
  for(let k=0;k<3;k++){const j=ids.getX(i+k);pos.add(new Vector3().fromBufferAttribute(p,j));normal.add(new Vector3().fromBufferAttribute(n,j));u+=j%97/96;v+=Math.floor(j/97)/96;}
  pos.divideScalar(3);normal.normalize();u=u/3-.5;v=v/3-.5;
  const x=u*width*330,y=v*width*330*stickerVisibleAspect(art),a=13*Math.PI/180;
  const exact=cage.point(-(x*Math.cos(a)-y*Math.sin(a)),-(x*Math.sin(a)+y*Math.cos(a)));
  const clearance=pos.sub(exact).dot(normal);min=Math.min(min,clearance);if(clearance<0)under++;
 }
 expect(under).toBe(0); expect(min).toBeGreaterThan(.1); geometry.dispose();
}

});
