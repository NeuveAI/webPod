import assert from 'node:assert/strict';
import {PlaneGeometry,Texture,BoxGeometry,Matrix4,PerspectiveCamera} from '../../../../../../../packages/device/node_modules/three/build/three.module.js';
import {preparePrint} from '../../../../../../../packages/device/src/sticker-prepared-damage';
import {preparedStickerContourDescriptor,getPreparedStickerContour} from '../../../../../../../packages/device/src/sticker-contour-preparation-data';
import {createStickerCollision} from '../../../../../../../packages/device/src/sticker-collision';
import {captureStickerQuadSamples} from '../../../../../../../packages/device/src/sticker-transform-projection';
import {createStickerContourQuery,type StickerContourDemand} from '../../../../../../../packages/device/src/sticker-contour-query';
import {stickerCollisionBudgetSnapshot,reserveStickerCollisionBytes} from '../../../../../../../packages/device/src/sticker-collision-budget';
import {inspectStickerTransactions,releaseUnusedStickerTransactions} from '../../../../../../../packages/device/src/sticker-transaction-broker';
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
const owners:ReturnType<typeof createStickerContourQuery>[]=[];
const make=(timeoutMs=1000)=>{const owner=createStickerContourQuery({requestFrame:frame,cancelFrame,timeoutMs});owners.push(owner);return owner;};
const print=await preparePrint({texture,id:'owner-proof',geometry,wearGeometry:null,wear:0},new AbortController().signal);
const descriptor=preparedStickerContourDescriptor(print.geometry);assert(descriptor);
const contour=getPreparedStickerContour(print.geometry,descriptor.input.field,descriptor.input.wear);assert(contour);
const quad=captureStickerQuadSamples(print.geometry);assert(quad);
const camera=new PerspectiveCamera(40,440/956,1,3000);camera.position.set(0,0,1000);camera.updateMatrixWorld();
const world=new Matrix4().makeTranslation(0,0,2),identity=new Matrix4().toArray();
const demand:StickerContourDemand={lineage:{session:1,stickerId:'owner-proof',source:'equipped'},pose:{backend:'gl',sequence:1,layoutRevision:1,sceneRevision:1,resourceRevision:1},visibilityRevision:1,
 projection:{world:world.toArray(),cameraInverse:camera.matrixWorldInverse.toArray(),cameraProjection:camera.projectionMatrix.toArray(),canvas:{left:0,top:0,width:440,height:956}},contentWorld:identity,cameraWorld:camera.matrixWorld.toArray(),collider:{snapshot:collision.snapshot(),revision:1},print:{identity:print.geometry,revision:1,descriptor,contour:contour.value,quad}};
let pressure:ReturnType<typeof reserveStickerCollisionBytes>|null=null;
let retained:boolean,error:string|null;
try {
 const owner=make();owner.request(demand);await until(()=>owner.getSnapshot().result!==null);
 const displayed=owner.getSnapshot().result;
 const budget=stickerCollisionBudgetSnapshot();pressure=reserveStickerCollisionBytes(budget.limit-budget.bytes);
 owner.request({...demand,print:{...demand.print,identity:{},revision:2}});
 await until(()=>owner.getSnapshot().error!==null);
 retained=owner.getSnapshot().result===displayed;error=owner.getSnapshot().error;
 pressure.release();pressure=null;
} finally {
 pressure?.release();for(const owner of owners)owner.dispose();print.release();texture.dispose();geometry.dispose();box.dispose();collision.dispose();
 if(originalImage)Object.defineProperty(globalThis,'HTMLImageElement',originalImage);else Reflect.deleteProperty(globalThis,'HTMLImageElement');
 if(originalDocument)Object.defineProperty(globalThis,'document',originalDocument);else Reflect.deleteProperty(globalThis,'document');
}
await Bun.sleep(30);releaseUnusedStickerTransactions();
check(stickerCollisionBudgetSnapshot().bytes===0&&inspectStickerTransactions().privateOwners===0,'final collision/private ownership zero');
const result={retained,error,checks,budget:stickerCollisionBudgetSnapshot(),transactions:inspectStickerTransactions()};
await Bun.write(new URL('./reviewer-candidate-capacity.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);
assert.equal(retained,true,'compatible capacity rejection must retain the displayed result');
