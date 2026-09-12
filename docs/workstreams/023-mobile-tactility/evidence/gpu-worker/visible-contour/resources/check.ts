import assert from 'node:assert/strict';
import {PlaneGeometry, Texture, BoxGeometry} from '../../../../../../../packages/device/node_modules/three/build/three.module.js';
import {reserveStickerCollisionBytes, stickerCollisionBudgetSnapshot} from '../../../../../../../packages/device/src/sticker-collision-budget';
import {prepareCollisionInWorker} from '../../../../../../../packages/device/src/sticker-collision-preparation';
import {preparePrint} from '../../../../../../../packages/device/src/sticker-prepared-damage';
import {preparedStickerContourDescriptor,getPreparedStickerContour} from '../../../../../../../packages/device/src/sticker-contour-preparation-data';
import {preparedStickerResources} from '../../../../../../../packages/device/src/sticker-transaction-client';
import {acquirePrivateStickerTransaction,inspectStickerTransactions,releaseUnusedStickerTransactions} from '../../../../../../../packages/device/src/sticker-transaction-broker';
import type {StickerPrivateTransactionResult} from '../../../../../../../packages/device/src/sticker-transaction-data';
const checks:string[]=[];
const check=(value:boolean,label:string)=>{assert.ok(value,label);checks.push(label);};
const box=new BoxGeometry(1,1,1),faces=[{geometry:box,source:'box',kind:'surface' as const}];
const all=reserveStickerCollisionBytes(128*1024*1024);
await assert.rejects(prepareCollisionInWorker(faces,new AbortController().signal),/capacity/);
assert.throws(()=>reserveStickerCollisionBytes(1),/capacity/);all.release();all.release();
check(stickerCollisionBudgetSnapshot().bytes===0,'shared cap admission rejects build before allocation and releases once');
const resident=reserveStickerCollisionBytes(1024), controllers=Array.from({length:4},()=>new AbortController());
const jobs=controllers.map(controller=>prepareCollisionInWorker(faces,controller.signal));
for(const job of jobs)void job.catch(()=>{});
await assert.rejects(prepareCollisionInWorker(faces,new AbortController().signal),/capacity/);
const before=stickerCollisionBudgetSnapshot();controllers[2]?.abort();
check(stickerCollisionBudgetSnapshot().bytes<before.bytes,'queued cancellation releases only queued reservation');
controllers[0]?.abort();
check(stickerCollisionBudgetSnapshot().bytes>1024,'active copy cancellation stays charged until cooperative task settles');
await Promise.allSettled(jobs);await Bun.sleep(10);
check(stickerCollisionBudgetSnapshot().bytes===1024,'other FIFO owners complete while resident charge remains');resident.release();
const originalWorker=globalThis.Worker;
Object.defineProperty(globalThis,'Worker',{configurable:true,value:class {constructor(){throw Error('worker unavailable fixture');}}});
try { const fallback=await prepareCollisionInWorker(faces,new AbortController().signal);check(fallback.provenance.length===12,'worker-unavailable cooperative recovery keeps exact output');await Bun.sleep(1);check(stickerCollisionBudgetSnapshot().bytes===0,'recovery completion releases shared reservation'); }
finally {Object.defineProperty(globalThis,'Worker',{configurable:true,value:originalWorker});box.dispose();}
const previousImage=Object.getOwnPropertyDescriptor(globalThis,'HTMLImageElement'),previousDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
class ImageFixture{complete=true;naturalWidth=8;naturalHeight=8;}
Object.defineProperty(globalThis,'HTMLImageElement',{configurable:true,value:ImageFixture});
Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>({drawImage:()=>{},getImageData:()=>({data:new Uint8ClampedArray(8*8*4).fill(255)})})})}});
const geometry=new PlaneGeometry(30,20,96,96),texture=new Texture(new ImageFixture());
try{
 const print=await preparePrint({texture,id:'resource-proof',geometry,wearGeometry:null,wear:0},new AbortController().signal);
 const descriptor=preparedStickerContourDescriptor(print.geometry);assert.ok(descriptor);
 check(!preparedStickerResources(print.geometry).some(item=>item.input.kind==='contour'),'actual preparePrint keeps descriptor out of surface/damage render list');
 const ports=new MessageChannel();
 const received=new Promise<StickerPrivateTransactionResult>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('port timeout')),5000);ports.port2.onmessage=({data}:MessageEvent<{result:StickerPrivateTransactionResult}>)=>{clearTimeout(timer);resolve(data.result);};ports.port2.start();});
 const privateLease=await acquirePrivateStickerTransaction(descriptor.key,descriptor.input,ports.port1,new AbortController().signal);
 const value=await received;assert.equal(value.kind,'contour');if(value.kind!=='contour')throw Error('wrong private result');
 const canonical=getPreparedStickerContour(print.geometry,descriptor.input.field,descriptor.input.wear);assert.ok(canonical);assert.deepEqual(value.contour,canonical.value);assert.notEqual(value.contour.anchors.buffer,canonical.value.anchors.buffer);
 check(true,'private contour exact Float64 paths and anchors match canonical with independent buffers');
 check(descriptor.input.positions.byteLength>0&&descriptor.input.uv.byteLength>0,'private actual worker contour delivery does not detach mounted arrays');
 print.geometry.getAttribute('uv').needsUpdate=true;
 check(preparedStickerContourDescriptor(print.geometry)===undefined,'geometry revision invalidates descriptor');
 print.release();privateLease.release();privateLease.release();ports.port2.close();
 const warm=await preparePrint({texture,id:'resource-proof',geometry,wearGeometry:null,wear:0},new AbortController().signal,{prepareContour:false});
 check(preparedStickerContourDescriptor(warm.geometry)===undefined,'material-only preparation has no contour descriptor');warm.release();
}finally{texture.dispose();geometry.dispose();if(previousImage)Object.defineProperty(globalThis,'HTMLImageElement',previousImage);else Reflect.deleteProperty(globalThis,'HTMLImageElement');if(previousDocument)Object.defineProperty(globalThis,'document',previousDocument);else Reflect.deleteProperty(globalThis,'document');}
await Bun.sleep(20);releaseUnusedStickerTransactions();
check(stickerCollisionBudgetSnapshot().bytes===0&&stickerCollisionBudgetSnapshot().reservations===0,'final collision budget zero');
check(inspectStickerTransactions().accountedBytes===0,'final canonical/private transaction bytes zero');
const result={checks,budget:stickerCollisionBudgetSnapshot(),transactions:inspectStickerTransactions(),scope:'Actual build/transaction workers and MessagePort; deterministic alpha-readback fixture; no browser/GPU claim.'};
await Bun.write(new URL('./check.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);
