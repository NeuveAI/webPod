import type { BufferGeometry } from '../../../../../packages/device/node_modules/three/build/three.module.js';
import type { CarryInput } from '../../../../../packages/device/src/sticker-carry-computation';
import type { CarryWorkerResult } from '../../../../../packages/device/src/sticker-carry-worker';
import { BoxGeometry, Matrix4, PerspectiveCamera } from '../../../../../packages/device/node_modules/three/build/three.module.js';
import { former } from './former-carry';
import { computeStickerCarry,computeStickerCarrySteps } from '../../../../../packages/device/src/sticker-carry-computation';
import { createStickerSurfaceGeometry } from '../../../../../packages/device/src/sticker-surface';
import { createStickerCollision } from '../../../../../packages/device/src/sticker-collision';
import { transferPaperGeometry,restorePaperGeometry } from '../../../../../packages/device/src/sticker-paper-transfer';
import { bindStickerWrapSurface,createStickerWrapSurface } from '../../../../../packages/device/src/sticker-wrap';
import { DEFAULT_DEVICE_FORM } from '../../../../../packages/device/src/form';
import { yieldSteps } from '../../../../../packages/device/src/sticker-computation-steps';
const art={id:'parity',url:'',width:100,height:180,visibleBounds:[0,0,100,180] as const}, placement={stickerId:'parity',surface:'back' as const,x:.8,y:.22,width:.2,rotationDeg:23};
const rear=new BoxGeometry(330,550,50); rear.computeBoundingSphere();bindStickerWrapSurface(rear,createStickerWrapSurface(DEFAULT_DEVICE_FORM,[]));
const world=new Matrix4().makeRotationY(.7);world.setPosition(23,-11,7);
const camera=new PerspectiveCamera(40,440/956,1,3000);camera.position.set(0,0,-1000);camera.lookAt(0,0,0);camera.updateMatrixWorld();
const collider=createStickerCollision([{geometry:rear,source:'box',kind:'surface'}]);
const source=createStickerSurfaceGeometry(art,placement,rear);
const base={art,width:66,paperWidth:300,pixel:1,seatX:.5,origin:[0,-140,132] as const,world:world.toArray(),cameraWorld:camera.matrixWorld.toArray(),projection:camera.projectionMatrix.toArray(),viewportWidth:440,viewportHeight:956,worldPixel:1,workspaceBounds:null};
const cases=[{name:'sheet',peel:.4,landing:0,placement:null},{name:'attached',peel:.4,sourcePeelFront:.4,sourcePlacement:placement,landing:0,placement:null},{name:'detached',peel:1,sourcePeelFront:1,detachTransport:1,sourcePlacement:placement,dragOffset:{x:100,y:30},landing:0,placement:null},{name:'landing',peel:.6,sourcePeelFront:1,detachTransport:1,sourcePlacement:placement,dragOffset:{x:100,y:30},landing:.6,placement},{name:'landed',peel:0,sourcePeelFront:1,detachTransport:1,sourcePlacement:placement,landing:1,placement},{name:'return',peel:1,sourcePeelFront:1,detachTransport:1,sourcePlacement:placement,returnToSheet:true,landing:.6,placement:null}];
function same(a:BufferGeometry,b:BufferGeometry){for(const k of ['position','normal','uv']){const aa=a.getAttribute(k)?.array,bb=b.getAttribute(k)?.array;if(aa?.length!==bb?.length)throw Error(k+' length');for(let i=0;i<(aa?.length??0);i++)if(aa[i]!==bb[i])throw Error(k+' '+i+' '+aa[i]+' != '+bb[i]);}if(JSON.stringify(a.boundingSphere)!==JSON.stringify(b.boundingSphere))throw Error('bounds');}
const worker=new Worker(new URL('../../../../../packages/device/src/sticker-carry-worker.ts',import.meta.url).href,{type:'module'});worker.postMessage({context:{rear:transferPaperGeometry(rear),form:DEFAULT_DEVICE_FORM,collision:collider.snapshot()}});
const evidence=[];let id=0;
for(const pose of cases){const input:CarryInput={...base,pack:{progress:1,stickerId:art.id,...pose}};const seated=pose.sourcePlacement?source:null,target=pose.landing>0&&pose.placement?source:null;
const original=former(input,rear,seated,target,collider),sync=computeStickerCarry(input,rear,seated,target,collider).geometry;same(original,sync);
let ticks=0;const timer=setInterval(()=>ticks++,0);const asyncResult=await yieldSteps(computeStickerCarrySteps(input,rear,seated,target,collider),new AbortController().signal);clearInterval(timer);same(original,asyncResult.geometry);
const result=await new Promise<CarryWorkerResult>((resolve,reject)=>{worker.onmessage=({data})=>resolve(data);worker.onerror=reject;worker.postMessage({id:++id,input});});if(result.error||!result.geometry)throw Error(result.error??'missing geometry');const output=restorePaperGeometry(result.geometry);same(original,output);evidence.push({case:pose.name,vertices:output.getAttribute('position').count,originalSyncWorkerCooperativeExact:true,cooperativeTimerTicks:ticks});for(const g of [original,sync,asyncResult.geometry,output])g.dispose();}
worker.terminate();source.dispose();rear.dispose();collider.dispose();await Bun.write(new URL('./carry-parity.json',import.meta.url),JSON.stringify(evidence,null,2));console.log(evidence);
