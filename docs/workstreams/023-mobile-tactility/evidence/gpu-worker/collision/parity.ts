import {mkdtempSync,symlinkSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {Vector3,Mesh,MeshBasicMaterial,Raycaster,Euler,FrontSide,BackSide,DoubleSide,type Intersection} from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import {createImmutableShells} from '../../../../../../packages/device/src/immutable-shells';
import {createHardwareGeometry} from '../../../../../../packages/device/src/hardware-geometry';
import {DEFAULT_DEVICE_FORM} from '../../../../../../packages/device/src/form';
import {DEVICE_LAYOUT} from '../../../../../../packages/device/src/layout';
import {DEVICE_SURFACE_LAYOUT} from '../../../../../../packages/device/src/surface-layout';
import {createStickerCollision,type StickerCollisionFace} from '../../../../../../packages/device/src/sticker-collision';
import {collisionWorkerFaces,prepareCollisionInWorker} from '../../../../../../packages/device/src/sticker-collision-preparation';
import {prepareCollisionCooperatively} from '../../../../../../packages/device/src/sticker-collision-cooperative';
import {buildShellPickingIndex} from '../../../../../../packages/device/src/shell-picking-index';
import {createIndexedShellRaycast} from '../../../../../../packages/device/src/shell-picking';
const baseline='d252c4425e18fff1424f26aff9e3dcb6e28e46f8';
const temporary=mkdtempSync(join(tmpdir(),'webpod-collision-baseline-'));
execFileSync('tar',['-x','-C',temporary],{input:execFileSync('git',['archive',baseline,'packages/device/src'],{maxBuffer:32*1024*1024})});
symlinkSync(resolve('packages/device/node_modules'),join(temporary,'packages/device/node_modules'));
const old=await import(join(temporary,'packages/device/src/sticker-collision.ts'));
const same=(label:string,a:unknown,b:unknown)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw Error(`Mismatch ${label}`);};
const hash=(data:ArrayBufferView)=>createHash('sha256').update(new Uint8Array(data.buffer,data.byteOffset,data.byteLength)).digest('hex');
const shells=createImmutableShells(DEFAULT_DEVICE_FORM),hardware=createHardwareGeometry(DEFAULT_DEVICE_FORM);
const faces:StickerCollisionFace[]=[{geometry:shells.front,source:'front',kind:'surface',adhesiveSupport:true},{geometry:shells.back,source:'rear',kind:'surface',adhesiveSupport:true},...hardware.map(part=>({geometry:part.geometry,source:part.name,kind:'surface' as const}))];
const expected:ReturnType<typeof createStickerCollision>=old.createStickerCollision(faces);
const actual=createStickerCollision(faces),snapshot=actual.snapshot(),borrowed=createStickerCollision([],snapshot);
if(borrowed.snapshot()!==snapshot)throw Error('Packed adoption must retain snapshot identity');
let segments=0,support=0,triangles=0;
for(let x=-165;x<=165;x+=15)for(let y=-275;y<=275;y+=25){
 const start=new Vector3(x,y,1200),end=new Vector3(x,y,-1200);
 same('segment',actual.castSegment(start,end),expected.castSegment(start,end));segments++;
 const point=new Vector3(x,y,-12);same('support',actual.closestApprovedSupport(point,40),expected.closestApprovedSupport(point,40));support++;
 same('triangle',actual.intersectsTriangle(point,new Vector3(x+8,y,-7),new Vector3(x,y+8,-7)),expected.intersectsTriangle(point,new Vector3(x+8,y,-7),new Vector3(x,y+8,-7)));triangles++;
}
same('support traversal work',actual.getSupportStats(),expected.getSupportStats());
const prepared=await prepareCollisionInWorker(faces,new AbortController().signal);
const cooperative=await prepareCollisionCooperatively(faces,new AbortController().signal);
for(const result of [prepared,cooperative]){same('coordinates',hash(result.coordinates),hash(snapshot.coordinates));same('provenance',hash(result.provenance),hash(snapshot.provenance));same('bounds',hash(result.root.bounds),hash(snapshot.root.bounds));same('links',hash(result.root.links),hash(snapshot.root.links));same('leaf order',hash(result.root.triangles),hash(snapshot.root.triangles));same('metadata',result.metadata,snapshot.metadata);}
const originalMetadata=JSON.stringify(snapshot.metadata);borrowed.dispose();same('borrowed disposal metadata',JSON.stringify(snapshot.metadata),originalMetadata);
const {wheel}=DEVICE_LAYOUT,{displayWell}=DEVICE_SURFACE_LAYOUT.front;
const points=[[0,0],[0,wheel.centerY],[wheel.outerR*.7,wheel.centerY],[wheel.outerR,wheel.centerY],[0,wheel.centerY+wheel.outerR],[-160,0],[-140,0],[-100,0],[160,0],[140,0],[100,0],[0,270],[0,-270],[145,250],[-145,-250],[0,displayWell.centerY],[displayWell.width/2,displayWell.centerY],[displayWell.width/2+2,displayWell.centerY],[displayWell.width/2-2,displayWell.centerY],[0,displayWell.centerY+displayWell.height/2]];
const poses=[[0,0],[0,45],[0,90],[0,180],[45,45],[-45,-45],[30,160]];
const hit=(value:Intersection)=>({distance:value.distance,point:value.point.toArray(),uv:value.uv?.toArray(),normal:value.normal?.toArray(),faceIndex:value.faceIndex,face:value.face?{a:value.face.a,b:value.face.b,c:value.face.c,normal:value.face.normal.toArray(),materialIndex:value.face.materialIndex}:null});
let rays=0,alphaFiltered=0;
for(const geometry of [shells.front,shells.back]){
 const position=geometry.getAttribute('position');if(!(position.array instanceof Float32Array))throw Error('Expected float positions');
 const index=buildShellPickingIndex({positions:position.array.slice(),indices:geometry.index?Uint32Array.from(geometry.index.array):null});
 const query=createIndexedShellRaycast(geometry,index),material=new MeshBasicMaterial(),mesh=new Mesh(geometry,material);
 for(const side of [FrontSide,BackSide,DoubleSide])for(const pose of poses){const [pitch=0,yaw=0]=pose;material.side=side;mesh.rotation.copy(new Euler(pitch*Math.PI/180,yaw*Math.PI/180,0));mesh.updateMatrixWorld();
  for(const [x=0,y=0] of points){const origin=new Vector3(0,0,1500),target=new Vector3(x,y,0).applyMatrix4(mesh.matrixWorld),ray=new Raycaster(origin,target.sub(origin).normalize()),before:Intersection[]=[],after:Intersection[]=[];
   Mesh.prototype.raycast.call(mesh,ray,before);query.raycast.call(mesh,ray,after);same('exact shell hits',after.map(hit),before.map(hit));if(after.some(value=>value.object!==mesh))throw Error('Lost mesh provenance');rays++;
   const alpha=(value:Intersection)=>value.uv!==undefined&&Math.sin(value.uv.x*3)+Math.cos(value.uv.y*7)>.2;same('UV alpha admission',after.filter(alpha).map(hit),before.filter(alpha).map(hit));alphaFiltered++;
  }
 }
 query.dispose();material.dispose();
}
const copied=collisionWorkerFaces(faces),copyBytes=copied.reduce((sum,face)=>sum+face.positions.byteLength+(face.indices?.byteLength??0),0);
const output={baseline,segments,support,triangles,exactShellRays:rays,uvAlphaFilteredRays:alphaFiltered,workerCooperativePackedParity:true,snapshotIdentity:true,borrowedDisposalSafe:true,triangleCount:actual.stats.triangleCount,nodeCount:actual.stats.nodeCount,formerDenseNodeRestorations:expected.stats.nodeCount,packedNodeRestorations:0,packedTypedBytes:actual.stats.typedBytes,inputCopyBytes:copyBytes,supportWork:actual.getSupportStats(),claim:'Exact query/representation work counts only; no browser or GPU time measurement'};
writeFileSync('docs/workstreams/023-mobile-tactility/evidence/gpu-worker/collision/parity.json',JSON.stringify(output,null,2)+'\n');console.log(output);
actual.dispose();expected.dispose();shells.front.dispose();shells.back.dispose();for(const part of hardware)part.geometry.dispose();rmSync(temporary,{recursive:true,force:true});
