import assert from 'node:assert/strict';
import {mock} from 'bun:test';
import {GlobalRegistrator} from '../../../../../../packages/composite/node_modules/@happy-dom/global-registrator';
import {Texture,Mesh} from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import type {StickerArtwork} from '../../../../../../packages/device/src/sticker-contract';
import {stickerPackGeometryKey,type StickerPackNode} from '../../../../../../packages/device/src/sticker-pack-recipe';
GlobalRegistrator.register();
Object.defineProperty(HTMLCanvasElement.prototype,'getContext',{value:()=>({drawImage(){},getImageData(){return{data:new Uint8ClampedArray(8*8*4).fill(255)};}})});
let live=0,peak=0,attempt=0,failAt=0,abortAt=0,closes=0;
let cancellation:AbortController|null=null;
class Bitmap implements ImageBitmap{readonly width=8;readonly height=8;closed=false;close(){assert(!this.closed,'bitmap closes once');this.closed=true;closes++;}}
mock.module('../../../../../../packages/composite/src/native-sticker-resources',()=>({
 async acquireArtwork(_art:StickerArtwork,signal:AbortSignal){signal.throwIfAborted();attempt++;live++;peak=Math.max(peak,live);const image=document.createElement('img');for(const [key,value]of Object.entries({complete:true,naturalWidth:8,naturalHeight:8}))Object.defineProperty(image,key,{value});const texture=new Texture(image);let released=false;return{texture,release(){if(released)return;released=true;live--;texture.dispose();}};},
 async snapshotArtwork(texture:Texture,signal:AbortSignal){if(attempt===abortAt)cancellation?.abort();signal.throwIfAborted();if(attempt===failAt)throw new Error('capture failed');return{image:new Bitmap(),colorSpace:texture.colorSpace,wrapS:texture.wrapS,wrapT:texture.wrapT,minFilter:texture.minFilter,magFilter:texture.magFilter,generateMipmaps:texture.generateMipmaps,anisotropy:texture.anisotropy};},
}));
const {prepareNativePackFrame}=await import('../../../../../../packages/composite/src/native-pack-resources');
const {prepareStickerPackRenderFrame}=await import('../../../../../../packages/device/src/sticker-pack-render-frame');
const {inspectStickerTransactions,releaseUnusedStickerTransactions}=await import('../../../../../../packages/device/src/sticker-transaction-broker');
const {inspectPaperPool,releaseUnusedPaperPackGeometry}=await import('../../../../../../packages/device/src/sticker-paper-pool');
const assets:StickerArtwork[]=Array.from({length:3},(_,i)=>({id:`art-${i}`,url:`art-${i}`,width:8,height:8,visibleBounds:[0,0,1,1]}));
const recipe:StickerPackNode={kind:'group',id:'warm',children:assets.map(art=>{const geometry={kind:'parked-print' as const,art,width:1};return{kind:'print',id:art.id,artId:art.id,geometry,geometryKey:stickerPackGeometryKey(geometry),width:1,appearance:'earned',wear:0,renderOrder:4};})};
const scene={assets,placements:[],pack:null};
const material=await prepareNativePackFrame(recipe,scene,new AbortController().signal,{prepareContours:false,materialOnly:true});
assert.equal(live,0);assert.equal(peak,1);assert.equal(material.prepared.size,0);assert.equal(material.queryPrints.size,0);assert.equal(material.cache.geometry.size,0);assert.equal(material.cache.artwork.size,0);assert(material.queryPeakBytes>0);assert(material.queryCaptureBytes>=material.queryPeakBytes*3);assert.equal(material.frame.damage.length,3);assert.equal(inspectStickerTransactions().privateOwners,3);
const rendered=await prepareStickerPackRenderFrame(material.frame,null,new AbortController().signal);material.transferred();material.releaseQueries();assert.equal(closes,0);let meshes=0;rendered.root.traverse(object=>{if(object instanceof Mesh){meshes++;assert(object.geometry.getAttribute('position'));assert(object.geometry.getAttribute('uv'));}});assert.equal(meshes,6);assert.equal(inspectStickerTransactions().privateOwners,3);const baseline=await prepareNativePackFrame(recipe,scene,new AbortController().signal);
for(const print of material.frame.prints){const main=baseline.queryPrints.get(print.key),gpu=rendered.resources.geometry.get(print.geometryKey)?.unit.value['geometry'],damage=rendered.resources.damage.get(print.damageResource)?.value.result;assert(main&&gpu&&damage);for(const name of Object.keys(main.geometry.attributes))assert.deepEqual(gpu.getAttribute(name).array,main.geometry.getAttribute(name).array);assert.deepEqual(damage.gpu,main.damage.texture.image.data);}
baseline.release();rendered.dispose();material.release();material.release();assert.equal(closes,6);
// Existing visible frame retains its query owners during failed warm captures.
attempt=0;peak=0;const current=await prepareNativePackFrame(recipe,scene,new AbortController().signal);assert.equal(live,3);assert.equal(current.queryPrints.size,3);const currentGeometry=current.queryPrints.get('art-0')?.geometry;assert(currentGeometry);
for(const mode of ['failure','cancel']as const){attempt=0;failAt=mode==='failure'?2:0;abortAt=mode==='cancel'?2:0;cancellation=new AbortController();await assert.rejects(prepareNativePackFrame(recipe,scene,cancellation.signal,{prepareContours:false,materialOnly:true}),mode==='failure'?/capture failed/:{name:'AbortError'});assert.equal(live,3);assert.equal(current.queryPrints.get('art-0')?.geometry,currentGeometry);assert.equal(inspectStickerTransactions().privateOwners,3);}
current.release();assert.equal(live,0);assert.equal(inspectStickerTransactions().privateOwners,0);assert.equal(inspectPaperPool().privateOwners,0);releaseUnusedStickerTransactions();releaseUnusedPaperPackGeometry();await Bun.sleep(30);assert.equal(inspectStickerTransactions().accountedBytes,0);assert.equal(inspectPaperPool().accountedBytes,0);
await Bun.write(new URL('./per-art-lifetime.json',import.meta.url),JSON.stringify({method:'Actual adapter, computation workers, private MessagePorts and node assembly; controlled decode/bitmap boundary, no native GPU timing',queryPeakBytes:material.queryPeakBytes,queryCaptureBytes:material.queryCaptureBytes,perArtQueryPeakOwners:1,emptyMainQueryCollectionsBeforeCompile:true,privateOwnersRetainedUntilRenderRetirement:true,materialMeshes:meshes,exactPrivateGeometryAndGpuAgainstVisibleDefault:true,visibleCurrentSurvivesCaptureFailureAndCancellation:true,bitmapCloses:closes,finalTransactions:inspectStickerTransactions(),finalPaper:inspectPaperPool()},null,2)+'\n');await GlobalRegistrator.unregister();
