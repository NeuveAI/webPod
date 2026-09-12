import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Vector3,BufferGeometry,BufferAttribute,Mesh,PerspectiveCamera} from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import {createImmutableShells} from '../../../../../../packages/device/src/immutable-shells';
import {createHardwareGeometry} from '../../../../../../packages/device/src/hardware-geometry';
import {DEFAULT_DEVICE_FORM} from '../../../../../../packages/device/src/form';
import {createStickerCollision,type StickerCollisionFace,type StickerCollisionSnapshot} from '../../../../../../packages/device/src/sticker-collision';
import {createStickerSurfaceGeometry} from '../../../../../../packages/device/src/sticker-surface';
import {createStickerWrapSurface} from '../../../../../../packages/device/src/sticker-wrap';
import {createStickerDamageField} from '../../../../../../packages/device/src/sticker-alpha';
import {prepareStickerContourSteps} from '../../../../../../packages/device/src/sticker-contour-computation';
import {drainSteps} from '../../../../../../packages/device/src/sticker-computation-steps';
import {setPreparedStickerContour} from '../../../../../../packages/device/src/sticker-contour-preparation-data';
import {projectStickerContourField} from '../../../../../../packages/device/src/sticker-contour';
import {scalarCollider} from './scalar';
type RayPair=readonly [Vector3,Vector3];
const hash=(x:ArrayBufferView)=>createHash('sha256').update(new Uint8Array(x.buffer,x.byteOffset,x.byteLength)).digest('hex');
const snapshotHashes=(s:StickerCollisionSnapshot)=>[s.coordinates,s.provenance,s.root.bounds,s.root.links,s.root.triangles].map(hash);
const shells=createImmutableShells(DEFAULT_DEVICE_FORM),hardware=createHardwareGeometry(DEFAULT_DEVICE_FORM);
const faces:StickerCollisionFace[]=[{geometry:shells.front,source:'front',kind:'surface',adhesiveSupport:true},{geometry:shells.back,source:'rear',kind:'surface',adhesiveSupport:true},...hardware.map(p=>({geometry:p.geometry,source:p.name,kind:'surface' as const}))];
const canonical=createStickerCollision(faces),snapshot=canonical.snapshot(),before=snapshotHashes(snapshot),scalar=scalarCollider(snapshot);
const rear=new BufferGeometry(),art={id:'synthetic-cutout',url:'fixture',width:64,height:96,visibleBounds:[0,0,64,96] as const};
const geometry=createStickerSurfaceGeometry(art,{stickerId:art.id,surface:'back',x:.65,y:.5,width:.45,rotationDeg:27},rear,createStickerWrapSurface(DEFAULT_DEVICE_FORM,[]));
const positions=geometry.getAttribute('position').array,uv=geometry.getAttribute('uv').array;
assert.ok(positions instanceof Float32Array&&uv instanceof Float32Array);
const field=createStickerDamageField({width:64,height:96,pixels:Uint8Array.from({length:64*96},(_,i)=>{const x=i%64,y=Math.floor(i/64);return x>3&&x<60&&y>5&&y<91&&!(x>20&&x<45&&y>30&&y<65)?255:0;})},art.id);
const contour=drainSteps(prepareStickerContourSteps(field,.2,positions,uv));
const points=contour.paths.flatMap(p=>Array.from({length:p.visiblePoints.length/3},(_,i)=>new Vector3().fromArray(p.visiblePoints,i*3)));
points.push(...Array.from({length:4},(_,i)=>new Vector3().fromArray(contour.anchors,i*3)));
const rays:RayPair[]=[];
for(const origin of [new Vector3(0,0,-1200),new Vector3(1200,0,-100),new Vector3(900,450,-900)])for(const point of points)rays.push([origin,point]);
let seed=123456789;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let i=0;i<1200;i++)rays.push([new Vector3((random()-.5)*700,(random()-.5)*900,(random()-.5)*2500),new Vector3((random()-.5)*360,(random()-.5)*580,(random()-.5)*80)]);
let parity=0,hits=0;
for(const [start,end] of rays){const a=canonical.castSegment(start,end),b=scalar.castSegment(start,end,true);assert.deepEqual(b,a,`device ray ${parity}`);if(a)hits++;parity++;}
// Exact edge/vertex, coplanar, signed-zero, short/endpoint, reversed, duplicate tie,
// degenerate and large-coordinate cases on explicitly synthetic triangles.
let adversarial=0;
const adversarialWork:ReturnType<ReturnType<typeof scalarCollider>['stats']>[]=[];
for(const scale of [1,1e-5,1e8]){
 const triangles=[0,0,0,1,0,0,0,1,0, 0,0,0,1,0,0,0,1,0, 0,0,0,0,0,0,0,0,0].map(x=>x*scale);
 const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float64Array(triangles),3));
 const a=createStickerCollision([{geometry:g,source:'first',kind:'surface'},{geometry:g,source:'second',kind:'bridge'}]),b=scalarCollider(a.snapshot());
 for(const [x,y] of [[0,0],[.5,.5],[1,0],[0,1],[.2,.2],[.5,.5+Number.EPSILON],[.5,.5-Number.EPSILON],[-Number.EPSILON,0]]){
  for(const z of [-1,0,-0,1,1e-9])for(const final of [-1,0,1,1e-8]){
   const start=new Vector3(x*scale,y*scale,z*scale),end=new Vector3(x*scale,y*scale,final*scale);
   assert.deepEqual(b.castSegment(start,end,true),a.castSegment(start,end),`adversarial ${adversarial}`);adversarial++;
  }
 }
 for(const value of [NaN,Infinity,-Infinity]){assert.throws(()=>a.castSegment(new Vector3(value,0,0),new Vector3()),/Nonfinite/);assert.throws(()=>b.castSegment(new Vector3(value,0,0),new Vector3()),/Nonfinite/);adversarial++;}
 adversarialWork.push(b.stats());a.dispose();g.dispose();
}
let projectedContours=0, nonnullProjectedContours=0;
setPreparedStickerContour(geometry,field,.2,contour);
const mesh=new Mesh(geometry),camera=new PerspectiveCamera(30,440/956,1,4000);
for(const origin of [new Vector3(0,0,-1200),new Vector3(1200,0,-100),new Vector3(900,450,-900)]){
 camera.position.copy(origin);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const visible=(query:(start:Vector3,end:Vector3)=>ReturnType<typeof canonical.castSegment>)=>(point:Vector3)=>{const hit=query(origin,point);return hit===null||hit.distance>=origin.distanceTo(point)-1e-5;};
 const bounds={left:17,top:53,width:440,height:956};
 const expected=projectStickerContourField(mesh,camera,bounds,field,.2,visible((a,b)=>canonical.castSegment(a,b)));
 assert.deepEqual(projectStickerContourField(mesh,camera,bounds,field,.2,visible((a,b)=>scalar.castSegment(a,b))),expected);projectedContours++;if(expected)nonnullProjectedContours++;
}
assert.ok(nonnullProjectedContours>0);mesh.material.dispose();
assert.deepEqual(snapshotHashes(snapshot),before);
assert.ok(adversarialWork.some(stats=>stats.fallbackHits>0),'Exercise exact shared-edge fallback');
const benchRays=rays.slice(0,Math.min(rays.length,4000));
let sink=0;
function run(kernel:(start:Vector3,end:Vector3)=>ReturnType<typeof canonical.castSegment>){const start=performance.now();for(const [a,b]of benchRays){const hit=kernel(a,b);sink+=hit?.distance??0;}return performance.now()-start;}
const old=(a:Vector3,b:Vector3)=>canonical.castSegment(a,b),next=(a:Vector3,b:Vector3)=>scalar.castSegment(a,b);
for(let i=0;i<2;i++){run(old);run(next);}
const oldMs:number[]=[],scalarMs:number[]=[];
for(let i=0;i<6;i++){if(i%2){scalarMs.push(run(next));oldMs.push(run(old));}else{oldMs.push(run(old));scalarMs.push(run(next));}}
const median=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b);return ((sorted[2]??0)+(sorted[3]??0))/2;};
const report={runtime:Bun.version,fixture:'Source-built default device shells/hardware and production prepared contour from synthetic 64x96 cutout alpha. Not a captured user scene/catalogue.',parity:{deviceRays:parity,deviceHits:hits,adversarial,projectedContours,nonnullProjectedContours,comparison:'node assert.deepEqual full Vector3 point/normal/distance/provenance, including signed zero',borrowedBuffersUnchanged:true},geometry:{triangles:canonical.stats.triangleCount,nodes:canonical.stats.nodeCount,bytes:canonical.stats.typedBytes,contourPoints:points.length},scalarWork:scalar.stats(),adversarialWork,benchmark:{raysPerBatch:benchRays.length,warmupBatchesPerKernel:2,order:'alternating six batches each, no instrumentation counters',oldMs,scalarMs,oldMedianMs:median(oldMs),scalarMedianMs:median(scalarMs),speedup:median(oldMs)/median(scalarMs),sink},limits:'Bun/JSC bounded warm microbenchmark, not Chrome/6x/production UI/worker latency. Not a complete proof for arbitrary geometry or asynchronous ownership.'};
await Bun.write(new URL('./result.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
canonical.dispose();geometry.dispose();rear.dispose();shells.front.dispose();shells.back.dispose();for(const p of hardware)p.geometry.dispose();
