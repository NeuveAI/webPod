import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {inflateSync} from 'node:zlib';
import {BufferGeometry,Mesh,PerspectiveCamera,Vector3} from '../../../../../../../packages/device/node_modules/three/build/three.module.js';
import {STICKER_CATALOGUE} from '../../../../../../../packages/stickers/src/catalogue';
import {createStickerSurfaceGeometry} from '../../../../../../../packages/device/src/sticker-surface';
import {createStickerWrapSurface} from '../../../../../../../packages/device/src/sticker-wrap';
import {DEFAULT_DEVICE_FORM} from '../../../../../../../packages/device/src/form';
import {createStickerDamageField} from '../../../../../../../packages/device/src/sticker-alpha';
import {prepareStickerContourSteps} from '../../../../../../../packages/device/src/sticker-contour-computation';
import {drainSteps} from '../../../../../../../packages/device/src/sticker-computation-steps';
import {setPreparedStickerContour} from '../../../../../../../packages/device/src/sticker-contour-preparation-data';
import {projectPreparedStickerContour,projectStickerContourField} from '../../../../../../../packages/device/src/sticker-contour';
import {captureStickerQuadSamples,projectStickerQuadSamples,stickerProjectedQuad} from '../../../../../../../packages/device/src/sticker-transform-projection';
import type {StickerContourProjection} from '../../../../../../../packages/device/src/sticker-contour-query-data';
async function rgba(path: string) {
 const source = Buffer.from(await Bun.file(path).arrayBuffer()); assert.equal(source.readUInt32BE(0), 0x89504e47);
 const width = source.readUInt32BE(16), height = source.readUInt32BE(20); assert.deepEqual([...source.subarray(24,29)], [8,6,0,0,0]);
 const chunks: Buffer[] = []; for (let offset = 8; offset < source.length;) {const length = source.readUInt32BE(offset); if (source.toString('ascii', offset+4, offset+8) === 'IDAT') chunks.push(source.subarray(offset+8, offset+8+length)); offset += length+12;}
 const encoded = inflateSync(Buffer.concat(chunks)), output = new Uint8ClampedArray(width*height*4), stride = width*4;
 for (let y=0;y<height;y++) {const filter=encoded[y*(stride+1)]; assert(filter!==undefined&&filter<=4); for(let x=0;x<stride;x++) {
  const raw=encoded[y*(stride+1)+x+1], left=x>=4?output[y*stride+x-4]??0:0, up=y?output[(y-1)*stride+x]??0:0, diagonal=y&&x>=4?output[(y-1)*stride+x-4]??0:0; assert(raw!==undefined);
  const p=left+up-diagonal, a=Math.abs(p-left), b=Math.abs(p-up), c=Math.abs(p-diagonal), paeth=a<=b&&a<=c?left:b<=c?up:diagonal;
  output[y*stride+x]=(raw+(filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):filter===4?paeth:0))&255;
 }}
 return {width,height,output};
}

const temporary=mkdtempSync(join(tmpdir(),'contour-kernel-'));
const root=resolve('packages/device/src');
for(const [name,file]of [['sticker-contour','baseline-contour.txt'],['sticker-transform-projection','baseline-transform.txt']]){
 const source=await Bun.file(join(import.meta.dir,file)).text();
 const linked=source.replace(/from '(\.\/[^']+)'/g,(_all,value:string)=>`from '${value==='./sticker-transform-projection'?join(temporary,'sticker-transform-projection.ts'):join(root,value)+'.ts'}'`);
 writeFileSync(join(temporary,`${name}.ts`),linked);
}
const previous:typeof import('../../../../../../../packages/device/src/sticker-contour')=await import(join(temporary,'sticker-contour.ts'));
const previousQuad:typeof import('../../../../../../../packages/device/src/sticker-transform-projection')=await import(join(temporary,'sticker-transform-projection.ts'));
let cases=0,nonnull=0,nulls=0,sampleComparisons=0,visibilityPoints=0;
const artworks:string[]=[];
try{
 for(const art of STICKER_CATALOGUE.slice(0,2)){
  artworks.push(art.id);const decoded=await rgba(`assets${art.url}`);
  const alpha=Uint8Array.from({length:decoded.width*decoded.height},(_,i)=>decoded.output[i*4+3]??0);
  const field=createStickerDamageField({width:decoded.width,height:decoded.height,pixels:alpha},art.id);
  for(const width of [.2,.65]){
   const rear=new BufferGeometry();
   const geometry=createStickerSurfaceGeometry(art,{stickerId:art.id,surface:'back',x:.65,y:.5,width,rotationDeg:27},rear,createStickerWrapSurface(DEFAULT_DEVICE_FORM,[]));
   const position=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
   assert.ok(position.array instanceof Float32Array&&uv.array instanceof Float32Array);
   const mesh=new Mesh(geometry),camera=new PerspectiveCamera(30,440/956,1,4000);
   for(const wear of [0,.4]){
    const contour=drainSteps(prepareStickerContourSteps(field,wear,position.array,uv.array));
    setPreparedStickerContour(geometry,field,wear,contour);
    for(const angle of [0,35,89,90,135,180,271])for(const mode of ['all','half','split','hidden']){
     camera.position.set(0,0,1200);camera.lookAt(0,0,0);camera.updateMatrixWorld();
     mesh.rotation.set(.2,angle*Math.PI/180,.15);mesh.updateMatrixWorld();
     const canvas={left:17,top:53,width:440,height:956};
     const expectedCalls:number[][]=[],actualCalls:number[][]=[];
     const visible=(log:number[][])=>(point:Vector3)=>{log.push(point.toArray());return mode==='all'||(mode==='half'?point.x>5:mode==='split'?Math.abs(point.y)<70:false);};
     const expected=previous.projectStickerContourField(mesh,camera,canvas,field,wear,visible(expectedCalls));
     const actual=projectStickerContourField(mesh,camera,canvas,field,wear,visible(actualCalls));
     assert.deepEqual(actual,expected,`${art.id}/${width}/${wear}/${angle}/${mode}`);assert.deepEqual(actualCalls,expectedCalls);visibilityPoints+=actualCalls.length;
     const samples=captureStickerQuadSamples(geometry);assert(samples);
     const projection:StickerContourProjection={world:mesh.matrixWorld.toArray(),cameraInverse:camera.matrixWorldInverse.toArray(),cameraProjection:camera.projectionMatrix.toArray(),canvas};
     const quad=projectStickerQuadSamples(samples,projection);assert.deepEqual(quad,previousQuad.stickerProjectedQuad(mesh,camera,canvas));sampleComparisons++;
     const copied=structuredClone({contour,samples,projection});
     const copiedQuad=projectStickerQuadSamples(copied.samples,copied.projection);
     const replay=copiedQuad?projectPreparedStickerContour(copied.contour,copied.projection,copiedQuad.center,visible([])):null;
     assert.deepEqual(replay,expected);cases++;if(expected)nonnull++;else nulls++;
    }
    // Actual malformed/clip boundaries must retain null admission, not invent a hull.
    for(const rect of [{left:0,top:0,width:0,height:900},{left:0,top:0,width:NaN,height:900}])assert.deepEqual(stickerProjectedQuad(mesh,camera,rect),previousQuad.stickerProjectedQuad(mesh,camera,rect));
    for(const z of [0,.5,5000]){camera.position.set(0,0,z);camera.updateMatrixWorld();assert.deepEqual(stickerProjectedQuad(mesh,camera,{left:0,top:0,width:440,height:956}),previousQuad.stickerProjectedQuad(mesh,camera,{left:0,top:0,width:440,height:956}));sampleComparisons++;}
   }
   // Position reads remain live, including unversioned deformation used by production.
   const before=captureStickerQuadSamples(geometry);assert(before);position.setZ(0,position.getZ(0)+2);
   const after=captureStickerQuadSamples(geometry);assert(after);assert.notDeepEqual(after,before);
   assert.deepEqual(stickerProjectedQuad(mesh,camera,{left:0,top:0,width:440,height:956}),previousQuad.stickerProjectedQuad(mesh,camera,{left:0,top:0,width:440,height:956}));
   geometry.dispose();rear.dispose();mesh.material.dispose();
  }
 }
 assert.ok(nonnull>0&&nulls>0&&visibilityPoints>0);
 const result={artworks,provenance:'Exact pinned catalogue PNG alpha decoded losslessly; production wrap/contour preparation, source-built geometry. Not a captured live device.',cases,nonnull,nulls,sampleComparisons,visibilityPoints,exactVisibilityCallOrder:true,structuredCloneReplay:true,livePositionReads:true,baseline:'Archived pre-PhaseA source with e940 UV cache; imports share current canonical preparation metadata.'};
 await Bun.write(join(import.meta.dir,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(result);
}finally{rmSync(temporary,{recursive:true,force:true});}
