import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { BufferGeometry, Mesh, PerspectiveCamera, Vector3 } from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import { createStickerSurfaceGeometry } from '../../../../../../packages/device/src/sticker-surface';
import { createStickerWrapSurface } from '../../../../../../packages/device/src/sticker-wrap';
import { DEFAULT_DEVICE_FORM } from '../../../../../../packages/device/src/form';
import { drainSteps, yieldSteps } from '../../../../../../packages/device/src/sticker-computation-steps';
import { createStickerDamageField } from '../../../../../../packages/device/src/sticker-alpha';
import { prepareStickerContourSteps } from '../../../../../../packages/device/src/sticker-contour-computation';
import { setPreparedStickerContour } from '../../../../../../packages/device/src/sticker-contour-preparation-data';
import { projectStickerContourField, stickerAlphaContours } from '../../../../../../packages/device/src/sticker-contour';
const baseline='ebebb32d0b7f0b30b7e41b81778293d6b7d44405', temporary=mkdtempSync(join(tmpdir(),'sticker-contour-'));
execFileSync('tar',['-x','-C',temporary],{input:execFileSync('git',['archive',baseline,'packages/device/src'],{maxBuffer:32*1024*1024})});
symlinkSync(resolve('packages/device/node_modules'),join(temporary,'packages/device/node_modules'));
const previous: typeof import('../../../../../../packages/device/src/sticker-contour')=await import(join(temporary,'packages/device/src/sticker-contour.ts'));
let checked=0;let boundaryPoints=0,visiblePoints=0;
try {
 for(const cropped of [false,true])for(const width of [.2,.65]){
  const rear=new BufferGeometry(),art={id:'contour-proof',url:'proof',width:96,height:128,visibleBounds:(cropped?[4,8,92,120]:[0,0,96,128]) as readonly [number,number,number,number]};
  const geometry=createStickerSurfaceGeometry(art,{stickerId:art.id,surface:'back',x:.65,y:.5,width,rotationDeg:27},rear,createStickerWrapSurface(DEFAULT_DEVICE_FORM,[]));
  const positions=geometry.getAttribute('position').array,uv=geometry.getAttribute('uv').array;
  if(!(positions instanceof Float32Array)||!(uv instanceof Float32Array))throw Error('fixture float arrays');
  const field=createStickerDamageField({width:96,height:128,pixels:Uint8Array.from({length:96*128},(_,i)=>{const x=i%96,y=Math.floor(i/96);return x>4&&x<92&&y>8&&y<120&&!(x>30&&x<65&&y>40&&y<80)?255:0;})},art.id);
  const mesh=new Mesh(geometry),camera=new PerspectiveCamera(30,1,1,4000);camera.position.z=1200;camera.updateMatrixWorld();
  for(const wear of [0,.1,.4,.8,1]){
   assert.deepEqual(stickerAlphaContours(field,wear),previous.stickerAlphaContours(field,wear));
   const value=drainSteps(prepareStickerContourSteps(field,wear,positions,uv));assert.deepEqual(await yieldSteps(prepareStickerContourSteps(field,wear,positions,uv),new AbortController().signal),value);
   setPreparedStickerContour(geometry,field,wear,value);
   boundaryPoints+=value.paths.reduce((sum,path)=>sum+path.points.length/3,0);visiblePoints+=value.paths.reduce((sum,path)=>sum+path.visiblePoints.length/3,0);
   for(let angle=0;angle<360;angle+=17)for(const visible of [undefined,(point:Vector3)=>point.x>5,(point:Vector3)=>Math.abs(point.y)<70]){
    mesh.rotation.set(.2,angle*Math.PI/180,.15);mesh.updateMatrixWorld();const canvas={left:17,top:53,width:440,height:956};
    assert.deepEqual(projectStickerContourField(mesh,camera,canvas,field,wear,visible),previous.projectStickerContourField(mesh,camera,canvas,field,wear,visible),`${cropped}/${width}/${wear}/${angle}`);checked++;
   }
  }
  geometry.dispose();rear.dispose();mesh.material.dispose();
 }
} finally {rmSync(temporary,{recursive:true,force:true});}
const evidence={baseline,checked,exact:true,boundaryPoints,visiblePoints,method:'Pinned exact alpha paths and full projection/anchors/visibility spans, including cutout, cropped UV, wear and wrapped rotation; cooperative same-math parity. No browser/timing claim.'};
await Bun.write(new URL('./contour.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');console.log(evidence);
