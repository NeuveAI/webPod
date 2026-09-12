import assert from 'node:assert/strict'
import { mock } from 'bun:test'
import { createRequire } from 'node:module'
import { Group, Mesh, PlaneGeometry, PerspectiveCamera } from '../../../../../../../packages/device/node_modules/three/build/three.module.js'
import { setPreparedStickerContour } from '../../../../../../../packages/device/src/sticker-contour-preparation-data'
import { createStickerVisibility } from '../../../../../../../packages/device/src/sticker-visibility'
import { FRONT_DEVICE_ORIENTATION } from '../../../../../../../packages/device/src/orientation'
import type { StickerContourDemand } from '../../../../../../../packages/device/src/sticker-contour-query'
import type { RenderPose } from '../../../../../../../packages/device/src/device-render-protocol'
const require = createRequire(new URL('../../../../../../../packages/composite/package.json', import.meta.url))
const { GlobalRegistrator } = require('@happy-dom/global-registrator') as {GlobalRegistrator:{register():void;unregister():void}}
GlobalRegistrator.register()
Object.defineProperty(document,'hidden',{configurable:true,value:false})
let latest: StickerContourDemand | null = null, requests=0, clears=0, retired=0
mock.module(new URL('../../../../../../../packages/device/src/sticker-contour-query.ts',import.meta.url).pathname,()=>({createStickerContourQuery:()=>({
 request(value:StickerContourDemand){latest=value;requests++},clear(){clears++},dispose(){retired++},subscribe:()=>()=>{},getSnapshot:()=>({result:null,error:null,pending:false}),
})}))
const {createStickerProjection}=await import('../../../../../../../packages/device/src/sticker-projection')
const scene=new Group(),content=new Group(),equipped=new Group(),carried=new Group()
content.name='device-model-content';equipped.name='device-equipped-stickers';carried.name='device-carried-sticker';scene.add(content,carried);content.add(equipped)
const geometry=new PlaneGeometry(30,20,2,2),print=new Mesh(geometry);print.name='sticker-test-art';equipped.add(print)
const field={width:1,height:1,alpha:new Uint8Array([255]),onset:new Uint8Array([255]),boundaryCandidates:new Uint32Array()}
const contour={paths:[],anchors:new Float64Array(12)}
const positions=geometry.getAttribute('position').array,uv=geometry.getAttribute('uv').array
assert(positions instanceof Float32Array && uv instanceof Float32Array)
setPreparedStickerContour(geometry,field,0,contour,{key:'capture-contour',input:{kind:'contour',damageKey:'capture-damage',field,wear:0,positions,uv}})
const placement={stickerId:'test-art',surface:'back' as const,x:.5,y:.5,width:.3,rotationDeg:0}
let pack: import('../../../../../../../packages/device/src/sticker-contract').StickerPackVisual|null=null
const camera=new PerspectiveCamera(30,1,1,2000);camera.position.z=400
const canvas=document.createElement('canvas');let width=440
canvas.getBoundingClientRect=()=>new DOMRect(4,8,width,956)
const visibility=createStickerVisibility()
const input={scene,camera,canvas,visibility,readScene:()=>({assets:[],placements:[placement],pack})}
const owner=createStickerProjection(input)
const get=()=>{assert(latest);return latest as StickerContourDemand}
try {
 owner.handle.contourQuery.request(placement,2)
 const first=get();assert.equal(first.pose.backend,'gl');assert.equal(first.lineage.session,2);assert.equal(first.print.identity,geometry);assert.equal(first.collider.snapshot,visibility.snapshot())
 assert.notEqual(first.print.quad.buffer,positions.buffer);assert.equal(first.print.quad.length,27)
 content.rotation.y=.4;owner.refreshContour();const changed=get();assert.notDeepEqual(changed.projection.world,first.projection.world);assert.equal(changed.pose.layoutRevision,first.pose.layoutRevision);assert.equal(clears,0)
 width=500;owner.refreshContour();assert(get().pose.layoutRevision>first.pose.layoutRevision)
 owner.handle.contourQuery.request(placement,4);assert.equal(get().lineage.session,4)
 pack={stickerId:'test-art',progress:1,peel:1,placement,landing:0,sourcePlacement:placement};carried.add(print)
 owner.refreshContour();assert.equal(get().lineage.source,'carry')
 const prior=requests;Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));owner.refreshContour();assert.equal(requests,prior);assert(clears>0)
 Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));assert(requests>prior)
 geometry.getAttribute('uv').needsUpdate=true;const previous=requests;owner.refreshContour();assert.equal(requests,previous)
 owner.dispose();const ended=requests;document.dispatchEvent(new Event('visibilitychange'));owner.refreshContour();assert.equal(requests,ended);assert.equal(retired,1)
 setPreparedStickerContour(geometry,field,0,contour,{key:'capture-contour',input:{kind:'contour',damageKey:'capture-damage',field,wear:0,positions,uv}})
 let pose:RenderPose={sequence:19,motionEpoch:7,lastAcceptedCommand:12,layoutRevision:5,sceneRevision:8,resourceRevision:9,nodes:[],orientation:FRONT_DEVICE_ORIENTATION,reveal:null}
 const native=createStickerProjection({...input,readPose:()=>pose});native.handle.contourQuery.request(placement,8)
 assert.deepEqual(get().pose,{backend:'native',sequence:19,motionEpoch:7,lastAcceptedCommand:12,layoutRevision:5,sceneRevision:8,resourceRevision:9})
 // Notifications carry no pose payload. After host terminal adoption, even a
 // delayed notification recaptures current admitted state through binding.read.
 pose={...pose,sequence:20,lastAcceptedCommand:13};native.refreshContour();assert.equal(get().pose.sequence,20)
 native.handle.contourQuery.request(placement,8);assert.equal(get().pose.sequence,20)
 const terminal=get().pose;if(terminal.backend==='native')assert.equal(terminal.lastAcceptedCommand,13)
 native.dispose()
 const result={passed:13,requests,clears,retired,scope:'Actual shared projection capture, real Three geometry/visibility, mocked query transport; worker lifecycle is separately proved by C1.'}
 await Bun.write(new URL('./capture.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result)
} finally {visibility.dispose();geometry.dispose();print.material.dispose();mock.restore();GlobalRegistrator.unregister()}
