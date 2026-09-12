import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {mock} from 'bun:test';
import {GlobalRegistrator} from '../../../../../../packages/composite/node_modules/@happy-dom/global-registrator';
import {Texture, BoxGeometry, Matrix4, PerspectiveCamera} from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import type {Texture as TextureType} from '../../../../../../packages/device/node_modules/@types/three';
import type {StickerArtwork} from '../../../../../../packages/device/src/sticker-contract';
import type {DeviceFontBitmap} from '../../../../../../packages/device/src/device-font-assets';
import {STICKER_CATALOGUE} from '../../../../../../packages/stickers/src/catalogue';
GlobalRegistrator.register();
// Exact RGBA8 PNG decode of the pinned artwork. No browser/color raster claim:
// damage consumes alpha only, which PNG filtering reconstructs losslessly.
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
const pixels = new WeakMap<object, Uint8ClampedArray>();
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {value() {let source: object|null=null; return {drawImage(image: object) {source=image;}, getImageData() {assert(source); const data=pixels.get(source); assert(data); return {data};}};}});
let owners=0, acquired=0;
class Bitmap implements ImageBitmap {constructor(readonly width:number,readonly height:number){} close(){}}
mock.module('../../../../../../packages/composite/src/native-sticker-resources',()=>({
 async acquireArtwork(art:StickerArtwork, signal:AbortSignal) {signal.throwIfAborted(); const decoded=await rgba(`assets${art.url}`); const image=document.createElement('img'); pixels.set(image,decoded.output); for(const [key,value]of Object.entries({complete:true,naturalWidth:decoded.width,naturalHeight:decoded.height}))Object.defineProperty(image,key,{value}); const texture=new Texture(image); owners++;acquired++;let live=true;return{texture,release(){if(live){live=false;owners--;texture.dispose();}}};},
 async snapshotArtwork(texture:TextureType,signal:AbortSignal):Promise<DeviceFontBitmap>{signal.throwIfAborted();const image:unknown=texture.image;assert(image instanceof HTMLImageElement);return{image:new Bitmap(image.naturalWidth,image.naturalHeight),colorSpace:texture.colorSpace,wrapS:texture.wrapS,wrapT:texture.wrapT,minFilter:texture.minFilter,magFilter:texture.magFilter,generateMipmaps:texture.generateMipmaps,anisotropy:texture.anisotropy};},
}));
const {createNativeStickerWarmup}=await import('../../../../../../packages/composite/src/native-sticker-warmup');
const {inspectPaperPool,releaseUnusedPaperPackGeometry}=await import('../../../../../../packages/device/src/sticker-paper-pool');
const {inspectStickerTransactions,releaseUnusedStickerTransactions}=await import('../../../../../../packages/device/src/sticker-transaction-broker');
let failure:string|null=null, sent=0, sentSequence=0;
const warm=createNativeStickerWarmup({send(sequence){sent++;sentSequence=sequence;},fail(error){failure=error.message;}});
warm.update({assets:STICKER_CATALOGUE,prepareIds:STICKER_CATALOGUE.slice(0,10).map(art=>art.id),placements:[],pack:null});
const end=Date.now()+60_000;while(!failure&&!sent&&Date.now()<end)await Bun.sleep(10);
if(sent) warm.ack(sentSequence);
const beforeRelease={paper:inspectPaperPool(),transactions:inspectStickerTransactions()};
const {prepareNativePackFrame} = await import('../../../../../../packages/composite/src/native-pack-resources');
const {createStickerPackRecipe} = await import('../../../../../../packages/device/src/sticker-pack-recipe');
const firstArt = STICKER_CATALOGUE[0]; assert(firstArt);
const neighborA = STICKER_CATALOGUE[10], neighborB = STICKER_CATALOGUE[20]; assert(neighborA && neighborB);
const pack = {progress:1,peel:0,stickerId:null,placement:null,landing:0,sheet:{reveal:1,ink:'#b7aa86',slots:STICKER_CATALOGUE.slice(0,5).map((art,index)=>({stickerId:art.id,state:index===0?'earned' as const:'locked' as const})),neighbors:[{ink:'#b7aa86',stickerId:neighborA.id},{ink:'#b7aa86',stickerId:neighborB.id}]}};
const visibleRecipe=createStickerPackRecipe({assets:STICKER_CATALOGUE},pack,{width:300,height:315,pixel:1,x:0,y:0,workspaceLowering:0},true);
let visibleFailure:string|null=null,visiblePrints=0,carryFailure:string|null=null;
let combined:unknown=null, finalCarry:unknown=null;
if(sent){try{
 const visible=await prepareNativePackFrame(visibleRecipe,{assets:STICKER_CATALOGUE,placements:[],pack},new AbortController().signal);visiblePrints=visible.frame.prints.length;
 try {
  const {createCarryPreparation}=await import('../../../../../../packages/device/src/sticker-carry-preparation');
  const {prepareNativeCarryFrame}=await import('../../../../../../packages/composite/src/native-carry-resources');
  const {createStickerCollision}=await import('../../../../../../packages/device/src/sticker-collision');
  const {bindStickerWrapSurface,createStickerWrapSurface}=await import('../../../../../../packages/device/src/sticker-wrap');
  const {DEFAULT_DEVICE_FORM}=await import('../../../../../../packages/device/src/form');
  const rear=new BoxGeometry(330,550,50);rear.computeBoundingSphere();const unbind=bindStickerWrapSurface(rear,createStickerWrapSurface(DEFAULT_DEVICE_FORM,[]));
  const collision=createStickerCollision([{geometry:rear,source:'box',kind:'surface'}]),visibility={ready:true,revision:1,snapshot:()=>collision.snapshot()};
  const camera=new PerspectiveCamera(40,440/956,1,3000);camera.position.set(0,0,-1000);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const runtime=createCarryPreparation({renderer:true}),unmount=runtime.mount();
  const input={art:firstArt,pack:{progress:1,stickerId:firstArt.id,sourcePlacement:{stickerId:firstArt.id,surface:'back' as const,x:.8,y:.22,width:.2,rotationDeg:23},peel:.3,sourcePeelFront:.3,landing:0,placement:null,computationEpoch:1},width:66,paperWidth:300,pixel:1,seatX:.5,origin:[0,-140,132] as const,world:new Matrix4().toArray(),cameraWorld:camera.matrixWorld.toArray(),projection:camera.projectionMatrix.toArray(),viewportWidth:440,viewportHeight:956,worldPixel:1,workspaceBounds:null};
  const sourcePrint=[...visible.queryPrints.values()].find(value=>value.damage.id===firstArt.id);assert(sourcePrint);
  const retained:Awaited<ReturnType<typeof prepareNativeCarryFrame>>[]=[];
  const until=async(check:()=>boolean)=>{const deadline=Date.now()+15_000;while(!check()&&Date.now()<deadline)await Bun.sleep(5);assert(check(),'carry deadline');};
  try{
   runtime.request(input,rear,visibility);await until(()=>!!runtime.getSnapshot().frame);const first=runtime.getSnapshot().frame;assert(first);
   retained.push(await prepareNativeCarryFrame({frame:first,runtime,texture:sourcePrint.texture,wear:.2},new AbortController().signal));
   runtime.request({...input,pack:{...input.pack,peel:.5}},rear,visibility);await until(()=>runtime.getSnapshot().frame!==first);const second=runtime.getSnapshot().frame;assert(second);
   retained.push(await prepareNativeCarryFrame({frame:second,runtime,texture:sourcePrint.texture,wear:.2},new AbortController().signal));
   combined={transactions:inspectStickerTransactions(),paper:inspectPaperPool(),carry:runtime.inspectRendererResources()};
   assert.equal(runtime.inspectRendererResources().privateOwners,2);assert.equal(inspectStickerTransactions().privateOwners,20);
  }catch(error){carryFailure=error instanceof Error?error.message:String(error);combined={transactions:inspectStickerTransactions(),paper:inspectPaperPool(),carry:runtime.inspectRendererResources(),retainedCarry:retained.length};}
  finally{for(const value of retained)value.release();unmount();finalCarry=runtime.inspectRendererResources();collision.dispose();unbind();rear.dispose();}
 }finally{visible.release();}
}catch(error){visibleFailure=error instanceof Error?error.message:String(error);}}
warm.rendererRetired();releaseUnusedPaperPackGeometry();releaseUnusedStickerTransactions();await Bun.sleep(30);
const result={provenance:'Actual catalogue PNG alpha and real canonical/private worker preparation; simulated browser bitmap object, no GPU compile.',catalogueArtworks:STICKER_CATALOGUE.length,requestedArtworks:10,acquired,sent,failure,visibleFailure,visiblePrints,carryFailure,combined,finalCarry,beforeRelease,finalOwners:owners,finalPaper:inspectPaperPool(),finalTransactions:inspectStickerTransactions()};
await Bun.write(new URL('./catalogue.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);await GlobalRegistrator.unregister();assert.equal(failure,null);assert.equal(visibleFailure,null);assert.equal(carryFailure,null);assert.equal(sent,1);assert.equal(visiblePrints,8);assert.equal(owners,0);assert.equal(inspectPaperPool().accountedBytes,0);assert.equal(inspectStickerTransactions().accountedBytes,0);assert.deepEqual(finalCarry,{canonical:0,privateOwners:0,pendingPrivate:0,preparing:false,bytes:0});
