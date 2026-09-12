import assert from 'node:assert/strict';
import {GlobalRegistrator} from '../../../../../../packages/device/node_modules/@happy-dom/global-registrator';
import {WebGPURenderer} from '../../../../../../packages/device/node_modules/three/build/three.webgpu.js';
import {createNativeScreenTexture} from '../../../../../../packages/device/src/native-element-image';
GlobalRegistrator.register();
class ProbeGPUTexture {readonly format='rgba8unorm';constructor(readonly width:number,readonly height:number){}}
class ProbeGPUDevice {readonly queue={copyElementImageToTexture(_source:unknown,destination:{width:number;height:number}){copies.push([destination.width,destination.height]);}};}
const copies:number[][]=[], allocations:number[][]=[];let closed=0,disposed=0,failAllocation=false;
Object.defineProperty(globalThis,'GPUTexture',{value:ProbeGPUTexture,configurable:true});
Object.defineProperty(globalThis,'GPUDevice',{value:ProbeGPUDevice,configurable:true});
const renderer=new WebGPURenderer({canvas:document.createElement('canvas')});
Reflect.set(renderer.backend,'device',new ProbeGPUDevice());
Object.defineProperty(renderer,'initTexture',{value:(texture:{image:{width:number;height:number};addEventListener:(name:string,listener:()=>void)=>void})=>{
 if(failAllocation)throw new Error('Injected allocation failure');
 allocations.push([texture.image.width,texture.image.height]);
 texture.addEventListener('dispose',()=>disposed++);
 const get:unknown=Reflect.get(renderer.backend,'get');assert.equal(typeof get,'function');
 if(typeof get!=='function')throw new Error('Backend contract missing');
 Reflect.set(get.call(renderer.backend,texture),'texture',new ProbeGPUTexture(texture.image.width,texture.image.height));
}});
try{
 const screen=createNativeScreenTexture(renderer,960,720),identity=screen.texture;
 const image=()=>({width:640,height:480,close(){closed++;}});
 screen.upload(image());assert.deepEqual(allocations,[[960,720]]);
 // Pending/old snapshots never call upload with a new admitted generation.
 assert.equal(disposed,0);assert.equal(screen.texture,identity);
 screen.upload(image(),{width:1280,height:960});assert.equal(screen.texture,identity);
 assert.deepEqual(allocations,[[960,720],[1280,960]]);assert.deepEqual(copies,[[960,720],[1280,960]]);assert.equal(closed,2);
 screen.upload(image(),{width:1280,height:960});assert.equal(allocations.length,2);
 failAllocation=true;assert.throws(()=>screen.upload(image(),{width:1600,height:1200}),/allocation failure/);assert.equal(closed,4);
 screen.dispose();screen.dispose();assert.throws(()=>screen.upload(image()),/retired/);assert.equal(closed,5);
 console.log(JSON.stringify({sameTextureSamplerIdentity:true,oldAllocationRetainedBeforeMatchingCapture:true,equalRasterDoesNotReallocate:true,matchingRasterAllocatesThenCopies:true,allocationFailureClosesImage:true,retiredUploadClosesImage:true,allocations,copies,scope:'Actual wrapper and installed Three StorageTexture/Backend with controlled allocation and copy callbacks; bind-group disposal behavior grounded in installed Textures.js, actual GPU resize validation remains browser gate.'},null,2));
}finally{Reflect.deleteProperty(globalThis,'GPUTexture');Reflect.deleteProperty(globalThis,'GPUDevice');GlobalRegistrator.unregister();}
