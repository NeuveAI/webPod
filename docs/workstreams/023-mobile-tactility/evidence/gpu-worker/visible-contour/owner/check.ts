import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PlaneGeometry,Texture,BoxGeometry,Matrix4,PerspectiveCamera,Vector3} from '../../../../../../../packages/device/node_modules/three/build/three.module.js';
import {preparePrint} from '../../../../../../../packages/device/src/sticker-prepared-damage';
import {preparedStickerContourDescriptor,getPreparedStickerContour} from '../../../../../../../packages/device/src/sticker-contour-preparation-data';
import {createImmutableShells} from '../../../../../../../packages/device/src/immutable-shells';
import {createHardwareGeometry} from '../../../../../../../packages/device/src/hardware-geometry';
import {DEFAULT_DEVICE_FORM} from '../../../../../../../packages/device/src/form';
import {prepareCollisionInWorker} from '../../../../../../../packages/device/src/sticker-collision-preparation';
import {createStickerCollision} from '../../../../../../../packages/device/src/sticker-collision';
import {captureStickerQuadSamples,projectStickerQuadSamples} from '../../../../../../../packages/device/src/sticker-transform-projection';
import {projectPreparedStickerContour} from '../../../../../../../packages/device/src/sticker-contour';
import {createStickerContourQuery,type StickerContourDemand} from '../../../../../../../packages/device/src/sticker-contour-query';
import {stickerCollisionBudgetSnapshot,reserveStickerCollisionBytes} from '../../../../../../../packages/device/src/sticker-collision-budget';
import {acquirePrivateStickerTransaction,inspectStickerTransactions,releaseUnusedStickerTransactions} from '../../../../../../../packages/device/src/sticker-transaction-broker';
import type {StickerContourQueryRequest} from '../../../../../../../packages/device/src/sticker-contour-query-data';
const checks:string[]=[];const check=(value:boolean,label:string)=>{assert.ok(value,label);checks.push(label);};
const until=async(test:()=>boolean)=>{const end=Date.now()+5000;while(!test()&&Date.now()<end)await Bun.sleep(2);assert.ok(test(),'deadline');};
const originalImage=Object.getOwnPropertyDescriptor(globalThis,'HTMLImageElement'),originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
class ImageFixture{complete=true;naturalWidth=8;naturalHeight=8;}
Object.defineProperty(globalThis,'HTMLImageElement',{configurable:true,value:ImageFixture});
Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(256).fill(255)})})})}});
const frame=(callback:FrameRequestCallback)=>Number(setTimeout(()=>callback(performance.now()),0));
const cancelFrame=(id:number)=>clearTimeout(id);
const geometry=new PlaneGeometry(30,20,96,96),texture=new Texture(new ImageFixture()),box=new BoxGeometry(30,20,1);
const collision=createStickerCollision([{geometry:box,source:'shell',kind:'surface'}]);
let held:StickerContourQueryRequest|null=null,hold=false,failQuery=false,holdRelease=false,queries=0,colliders=0,prints=0,terminations=0;
const workers:ControlledWorker[]=[];
class ControlledWorker extends Worker {
 constructor(){super(new URL('../../../../../../../packages/device/src/sticker-contour-query-worker.ts',import.meta.url),{type:'module'});workers.push(this);}
 override postMessage(message:StickerContourQueryRequest,transfer?:Transferable[]|StructuredSerializeOptions){
  if(message.type==='query'){if(failQuery)throw Error('send fixture');queries++;if(hold){assert.equal(held,null);held=message;return;}}
  if(message.type==='release-resource'&&holdRelease)return;
  if(message.type==='install-collider')colliders++;if(message.type==='install-print')prints++;
  if(Array.isArray(transfer))super.postMessage(message,transfer);else super.postMessage(message,transfer);
 }
 flush(){const message=held;held=null;assert(message);super.postMessage(message);}
 override terminate(){terminations++;super.terminate();}
}
let assemblyPeak:unknown;
const owners:ReturnType<typeof createStickerContourQuery>[]=[];
const make=(timeoutMs=1000)=>{const owner=createStickerContourQuery({createWorker:()=>new ControlledWorker(),requestFrame:frame,cancelFrame,timeoutMs});owners.push(owner);return owner;};
const print=await preparePrint({texture,id:'owner-proof',geometry,wearGeometry:null,wear:0},new AbortController().signal);
const descriptor=preparedStickerContourDescriptor(print.geometry);assert(descriptor);
const contour=getPreparedStickerContour(print.geometry,descriptor.input.field,descriptor.input.wear);assert(contour);
const quad=captureStickerQuadSamples(print.geometry);assert(quad);
const camera=new PerspectiveCamera(40,440/956,1,3000);camera.position.set(0,0,1000);camera.updateMatrixWorld();
const world=new Matrix4().makeTranslation(0,0,2),identity=new Matrix4().toArray();
const demand:StickerContourDemand={lineage:{session:1,stickerId:'owner-proof',source:'equipped'},pose:{backend:'gl',sequence:1,layoutRevision:1,sceneRevision:1,resourceRevision:1},visibilityRevision:1,
 projection:{world:world.toArray(),cameraInverse:camera.matrixWorldInverse.toArray(),cameraProjection:camera.projectionMatrix.toArray(),canvas:{left:0,top:0,width:440,height:956}},contentWorld:identity,cameraWorld:camera.matrixWorld.toArray(),collider:{snapshot:collision.snapshot(),revision:1},print:{identity:print.geometry,revision:1,descriptor,contour:contour.value,quad}};
const hash=()=>createHash('sha256').update(new Uint8Array(collision.snapshot().coordinates.buffer)).digest('hex');const borrowedHash=hash();
try{
 const owner=make();hold=true;owner.request(demand);check(queries===0,'cold request yields before worker/copy/query work');
 await until(()=>held!==null);const during=stickerCollisionBudgetSnapshot();check(during.bytes>0,'installed resources/output reserved before query');
 for(let sequence=2;sequence<=1001;sequence++)owner.request({...demand,pose:{...demand.pose,sequence}});
 await Bun.sleep(10);check(queries===1,'1000 compatible notifications retain one executing and one latest demand');
 hold=false;workers[0]?.flush();await until(()=>owner.getSnapshot().result!==null);
 check(queries===1,'1000 transport-only sequence changes do not dispatch another identical query');
 hold=true;owner.request({...demand,pose:{...demand.pose,sequence:1002},projection:{...demand.projection,world:new Matrix4().makeTranslation(.01,0,2).toArray()}});await until(()=>held!==null);
 let newest=demand;for(let sequence=1003;sequence<=2002;sequence++){newest={...demand,pose:{...demand.pose,sequence},projection:{...demand.projection,world:new Matrix4().makeTranslation(sequence*.0001,0,2).toArray()}};owner.request(newest);}
 await Bun.sleep(10);check(queries===2,'1000 changed poses still retain one active query');hold=false;workers[0]?.flush();await until(()=>owner.getSnapshot().result?.stamp.pose.sequence===2002);
 check(queries===3&&colliders===1&&prints===1,'latest changed pose drains once without duplicate private installation');
 const local=new Vector3(),origin=camera.position;
 const expectedQuad=projectStickerQuadSamples(quad,newest.projection);assert(expectedQuad);
 const expected=projectPreparedStickerContour(contour.value,newest.projection,expectedQuad.center,point=>{local.copy(point);const hit=collision.castSegment(origin,local);return hit===null||hit.distance>=origin.distanceTo(local)-1e-5;});
 assert.deepEqual(owner.getSnapshot().result?.contour,expected);check(expected!==null,'actual worker full contour equals synchronous exact kernel');
 owner.request({...demand,pose:{...demand.pose,sequence:3000},print:{...demand.print,identity:{},revision:2}});
 await until(()=>owner.getSnapshot().result?.stamp.pose.sequence===3000);
 check(colliders===1&&prints===2,'print candidate reuses exact current collider private owner');
 await until(()=>stickerCollisionBudgetSnapshot().reservations===2);
 check(hash()===borrowedHash&&descriptor.input.positions.byteLength>0,'private copies never detach/mutate borrowed collider/contour inputs');
 owner.clear();await until(()=>stickerCollisionBudgetSnapshot().bytes===0);check(owner.getSnapshot().result===null,'clear retires worker and presentation with zero ownership');
 owner.request({...demand,lineage:{...demand.lineage,session:2}});await until(()=>owner.getSnapshot().result!==null);check(owner.getSnapshot().result?.stamp.lineage.session===2,'reopen creates valid fresh generation');owner.dispose();await until(()=>stickerCollisionBudgetSnapshot().bytes===0);
 // Real default assembly: current/candidate query outputs coexist with the existing build reservation.
 const shells=createImmutableShells(DEFAULT_DEVICE_FORM),hardware=createHardwareGeometry(DEFAULT_DEVICE_FORM);
 const faces=[{geometry:shells.front,source:'front',kind:'surface' as const},{geometry:shells.back,source:'rear',kind:'surface' as const},...hardware.map(part=>({geometry:part.geometry,source:part.name,kind:'surface' as const}))];
 const large=createStickerCollision(faces),largeOwner=make(15000);
 try{
  const big={...demand,collider:{snapshot:large.snapshot(),revision:2}};largeOwner.request(big);await until(()=>largeOwner.getSnapshot().result!==null);
  hold=true;largeOwner.request({...big,print:{...big.print,identity:{},revision:2},pose:{...big.pose,sequence:2}});await until(()=>held!==null);
  const build=prepareCollisionInWorker(faces,new AbortController().signal);assemblyPeak={...stickerCollisionBudgetSnapshot(),triangles:large.stats.triangleCount,snapshotTypedBytes:large.stats.typedBytes};
  const built=await build;assert.deepEqual(built.root.links,large.snapshot().root.links);
  check(stickerCollisionBudgetSnapshot().reservations===3,'real assembly current+candidate outputs retain one shared collider while build completes');
  hold=false;workers.at(-1)?.flush();await until(()=>largeOwner.getSnapshot().result?.stamp.pose.sequence===2);
 }finally{largeOwner.dispose();held=null;hold=false;large.dispose();shells.front.dispose();shells.back.dispose();for(const part of hardware)part.geometry.dispose();}
 await until(()=>stickerCollisionBudgetSnapshot().bytes===0);check(true,'real assembly/build/current/candidate overlap returns to zero under original cap');
 // Hard layout/selection barrier terminates old generation; a late reply cannot republish.
 const barrier=make();hold=true;barrier.request(demand);await until(()=>held!==null);
 const oldMessage:StickerContourQueryRequest|null=held;const oldWorker=workers.at(-1);assert(oldMessage&&oldMessage.type==='query'&&oldWorker);held=null;hold=false;
 barrier.request({...demand,lineage:{...demand.lineage,session:3},pose:{...demand.pose,layoutRevision:2}});
 await until(()=>barrier.getSnapshot().result?.stamp.lineage.session===3);
 const fresh=barrier.getSnapshot().result;
 oldWorker.dispatchEvent(new MessageEvent('message',{data:{type:'result',version:1,stamp:oldMessage.stamp,contour:null,startedAt:0,completedAt:0}}));
 check(barrier.getSnapshot().result===fresh,'late retired-generation result cannot replace new layout/selection result');barrier.dispose();
 const failedSend=make();failQuery=true;failedSend.request(demand);await until(()=>failedSend.getSnapshot().error!==null);failQuery=false;
 check(stickerCollisionBudgetSnapshot().bytes===0,'synchronous query postMessage failure releases installed resources');
 // Missing worker response: termination precedes release of settled private owners.
 const timeout=make(100);hold=true;timeout.request(demand);await until(()=>held!==null);await until(()=>timeout.getSnapshot().error!==null);held=null;hold=false;
 check(stickerCollisionBudgetSnapshot().bytes===0,'missing result watchdog retires then releases all units');
 const releaseTimeout=make(150);releaseTimeout.request(demand);await until(()=>releaseTimeout.getSnapshot().result!==null);
 holdRelease=true;releaseTimeout.request({...demand,print:{...demand.print,identity:{},revision:2}});
 await until(()=>releaseTimeout.getSnapshot().error!==null);holdRelease=false;
 check(stickerCollisionBudgetSnapshot().bytes===0,'missing replacement release ACK retains charges until watchdog termination');
 const native=make();native.request({...demand,pose:{backend:'native',sequence:7,motionEpoch:3,lastAcceptedCommand:4,layoutRevision:1,sceneRevision:2,resourceRevision:5}});
 await until(()=>native.getSnapshot().result!==null);
 const stamp=native.getSnapshot().result?.stamp.pose;check(stamp?.backend==='native'&&stamp.motionEpoch===3&&stamp.lastAcceptedCommand===4,'native authority stamp echoes without replacing it with GL capture metadata');native.dispose();
 const smallGeometry=new PlaneGeometry(30,20,4,4),smallPrint=await preparePrint({texture,id:'owner-proof',geometry:smallGeometry,wearGeometry:null,wear:0},new AbortController().signal);
 const smallDescriptor=preparedStickerContourDescriptor(smallPrint.geometry);assert(smallDescriptor);const smallContour=getPreparedStickerContour(smallPrint.geometry,smallDescriptor.input.field,smallDescriptor.input.wear);assert(smallContour);const smallQuad=captureStickerQuadSamples(smallPrint.geometry);assert(smallQuad);
 const empty=make();empty.request({...demand,print:{identity:smallPrint.geometry,revision:2,descriptor:smallDescriptor,contour:smallContour.value,quad:smallQuad}});await until(()=>empty.getSnapshot().result!==null||empty.getSnapshot().error!==null);
 check(empty.getSnapshot().error===null&&empty.getSnapshot().result?.contour===null,'canonical empty prepared contour preserves null result without failure');empty.dispose();smallPrint.release();smallGeometry.dispose();
 // Observer throws on publication: credit/resources must not remain stranded.
 const throwing=make();throwing.subscribe(()=>{if(throwing.getSnapshot().result)throw Error('observer fixture');});throwing.request(demand);await until(()=>throwing.getSnapshot().error!==null);
 check(stickerCollisionBudgetSnapshot().bytes===0,'throwing publication observer cannot strand resources or credit');
 const retained=make();retained.request(demand);await until(()=>retained.getSnapshot().result!==null);
 const previousResult=retained.getSnapshot().result,previousBudget=stickerCollisionBudgetSnapshot().bytes;
 const pressure=reserveStickerCollisionBytes(stickerCollisionBudgetSnapshot().limit-previousBudget);
 const rejected={...demand,print:{...demand.print,identity:{},revision:999}};
 const queryCount=queries;retained.request(rejected);await until(()=>retained.getSnapshot().error!==null);
 check(retained.getSnapshot().result===previousResult&&stickerCollisionBudgetSnapshot().bytes===pressure.bytes+previousBudget,'candidate capacity rejection retains exact current result and private reservations');
 for(let i=0;i<1000;i++)retained.request(rejected);await Bun.sleep(20);
 check(queries===queryCount,'rejected candidate remains latched without admission retry loop');
 pressure.release();retained.clear();retained.request(rejected);await until(()=>retained.getSnapshot().result!==null);
 check(retained.getSnapshot().error===null,'explicit retry after capacity release installs current demand');retained.dispose();await until(()=>stickerCollisionBudgetSnapshot().bytes===0);
 const privateCurrent=make();privateCurrent.request(demand);await until(()=>privateCurrent.getSnapshot().result!==null);
 const privateResult=privateCurrent.getSnapshot().result,privateBudget=stickerCollisionBudgetSnapshot().bytes;
 const privateLeases:Awaited<ReturnType<typeof acquirePrivateStickerTransaction>>[]=[];
 try{
  while(inspectStickerTransactions().privateOwners<32){const ports=new MessageChannel();ports.port2.onmessage=()=>ports.port2.close();ports.port2.start();privateLeases.push(await acquirePrivateStickerTransaction(descriptor.key,descriptor.input,ports.port1,new AbortController().signal));}
  privateCurrent.request(rejected);await until(()=>privateCurrent.getSnapshot().error!==null);
  check(privateCurrent.getSnapshot().result===privateResult&&stickerCollisionBudgetSnapshot().bytes===privateBudget&&inspectStickerTransactions().privateOwners===32,'private admission rejection rolls back allocated candidate and shared collider ref');
  privateCurrent.request({...rejected,lineage:{...rejected.lineage,session:900}});
  check(privateCurrent.getSnapshot().result===null,'hard barrier clears retained capacity-error presentation immediately');
 }finally{privateCurrent.dispose();for(const lease of privateLeases)lease.release();}
 await until(()=>stickerCollisionBudgetSnapshot().bytes===0);check(true,'private-pressure candidate and hard barrier finish with zero collision ownership');
 const all=reserveStickerCollisionBytes(128*1024*1024),capacity=make();capacity.request(demand);await until(()=>capacity.getSnapshot().error!==null);
 check(stickerCollisionBudgetSnapshot().bytes===all.bytes,'capacity failure does not disturb an existing reservation');all.release();
 // Run only the first scheduled callback; copy has an explicit initial async yield.
 const callback:{current:FrameRequestCallback|null}={current:null};
 const copying=createStickerContourQuery({createWorker:()=>new ControlledWorker(),requestFrame:cb=>{callback.current=cb;return 1;},cancelFrame:()=>{callback.current=null;}});owners.push(copying);
 copying.request(demand);const run=callback.current;assert.ok(typeof run==='function');run(performance.now());
 check(stickerCollisionBudgetSnapshot().bytes>0,'copy reservation is visible before initial yield');copying.clear();
 check(stickerCollisionBudgetSnapshot().bytes>0,'cancelled copy retains reservation until continuation settles');await until(()=>stickerCollisionBudgetSnapshot().bytes===0);
 check(true,'cancelled copy settles with zero ownership');
}finally{
 for(const owner of owners)owner.dispose();print.release();texture.dispose();geometry.dispose();box.dispose();collision.dispose();
 if(originalImage)Object.defineProperty(globalThis,'HTMLImageElement',originalImage);else Reflect.deleteProperty(globalThis,'HTMLImageElement');if(originalDocument)Object.defineProperty(globalThis,'document',originalDocument);else Reflect.deleteProperty(globalThis,'document');
}
await Bun.sleep(30);releaseUnusedStickerTransactions();
check(stickerCollisionBudgetSnapshot().bytes===0&&inspectStickerTransactions().privateOwners===0,'final collision/private ownership zero');
const result={checks,assemblyPeak,queries,colliders,prints,terminations,budget:stickerCollisionBudgetSnapshot(),transactions:inspectStickerTransactions(),scope:'Actual query and transaction module workers/private MessagePorts; controlled timers/query hold only; synthetic alpha +production prepared geometry. No browser/performance claim.'};
await Bun.write(new URL('./result.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);
