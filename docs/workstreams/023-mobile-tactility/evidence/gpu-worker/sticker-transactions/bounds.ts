import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { BufferGeometry, Mesh, PerspectiveCamera, OrthographicCamera, Vector3 } from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import { createStickerSurfaceGeometry } from '../../../../../../packages/device/src/sticker-surface';
import { createStickerWrapSurface } from '../../../../../../packages/device/src/sticker-wrap';
import { DEFAULT_DEVICE_FORM } from '../../../../../../packages/device/src/form';
import { drainSteps } from '../../../../../../packages/device/src/sticker-computation-steps';
import { createStickerBoundsIndex, setStickerBoundsIndex } from '../../../../../../packages/device/src/sticker-bounds-index';
import { stickerProjectedBounds } from '../../../../../../packages/device/src/sticker-projected-bounds';
const baseline='ebebb32d0b7f0b30b7e41b81778293d6b7d44405', temporary=mkdtempSync(join(tmpdir(),'sticker-bounds-'));
execFileSync('tar',['-x','-C',temporary],{input:execFileSync('git',['archive',baseline,'packages/device/src'],{maxBuffer:32*1024*1024})});
symlinkSync(resolve('packages/device/node_modules'),join(temporary,'packages/device/node_modules'));
const previous: typeof import('../../../../../../packages/device/src/sticker-projected-bounds')=await import(join(temporary,'packages/device/src/sticker-projected-bounds.ts'));
let checked=0, authoredVertices=0, indexedVertices=0;
const original=Vector3.prototype.fromBufferAttribute;let visits=0;
Vector3.prototype.fromBufferAttribute=function(attribute,index){visits++;return original.call(this,attribute,index);};
try {
 for(const [x,width,rotationDeg] of [[.5,.2,0],[.95,.4,30],[.1,.5,-75]] as const){
  const rear=new BufferGeometry(),art={id:'bounds-proof',url:'proof',width:96,height:128,visibleBounds:[0,0,96,128] as const};
  const geometry=createStickerSurfaceGeometry(art,{stickerId:art.id,surface:'back',x,y:.5,width,rotationDeg},rear,createStickerWrapSurface(DEFAULT_DEVICE_FORM,[]));
  const attribute=geometry.getAttribute('position');setStickerBoundsIndex(geometry,drainSteps(createStickerBoundsIndex(attribute.array)));
  const mesh=new Mesh(geometry);
  for(const camera of [new PerspectiveCamera(30,1,1,4000),new OrthographicCamera(-300,300,350,-350,1,4000)])for(const distance of [1200,20,-1200])for(let angle=0;angle<360;angle+=7){
   camera.position.set(0,0,distance);camera.updateMatrixWorld();mesh.rotation.set(.23,angle*Math.PI/180,.11);mesh.updateMatrixWorld();
   const canvas={left:17,top:53,width:440,height:956};
   visits=0;const expected=previous.stickerProjectedBounds(mesh,camera,canvas);authoredVertices+=visits;
   visits=0;const actual=stickerProjectedBounds(mesh,camera,canvas);indexedVertices+=visits;
   assert.deepEqual(actual,expected,`${x}/${width}/${distance}/${angle}/${camera.type}`);checked++;
  }
  geometry.dispose();rear.dispose();mesh.material.dispose();
 }
} finally { Vector3.prototype.fromBufferAttribute=original;rmSync(temporary,{recursive:true,force:true}); }
const evidence={baseline,checked,exact:true,authoredVertices,indexedVertices,method:'Exact original-vertex extrema versus pinned former full scan; perspective/orthographic, wrap/rotation and clipped/behind views. Counts exclude box projections and are not a mobile timing claim.'};
await Bun.write(new URL('./bounds.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');console.log(evidence);
