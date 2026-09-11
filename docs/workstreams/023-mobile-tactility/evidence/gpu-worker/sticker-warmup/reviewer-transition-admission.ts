import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {mock} from 'bun:test';
import {GlobalRegistrator} from '../../../../../../packages/composite/node_modules/@happy-dom/global-registrator';
import {Texture, BoxGeometry, Matrix4, PerspectiveCamera} from '../../../../../../packages/device/node_modules/three/build/three.module.js';
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
const textureModule=await import('../../../../../../packages/device/src/sticker-textures');
const {createStickerTextureCache}=await import('../../../../../../packages/device/src/sticker-texture-cache');
const cache=createStickerTextureCache((url,success,failure)=>{void rgba(`assets${url}`).then(decoded=>{const image=document.createElement('img');pixels.set(image,decoded.output);for(const [key,value]of Object.entries({complete:true,naturalWidth:decoded.width,naturalHeight:decoded.height}))Object.defineProperty(image,key,{value});success(new Texture(image));}).catch(failure);});
mock.module('../../../../../../packages/device/src/sticker-textures',()=>({...textureModule,
 acquireStickerTexture(url:string,notify:()=>void){owners++;acquired++;let live=true;const unsubscribe=cache.subscribe(url,notify);
  return{read:()=>cache.getSnapshot(url),release(){if(!live)return;live=false;owners--;unsubscribe();}};
 },
}));
Object.defineProperty(globalThis,'createImageBitmap',{configurable:true,value:async(source:HTMLImageElement)=>new Bitmap(source.naturalWidth,source.naturalHeight)});
const brokerModule=await import('../../../../../../packages/device/src/sticker-transaction-broker');
const originalAcquirePrivate=brokerModule.acquirePrivateStickerTransaction;
const privateAcquisitions=new Map<string,{kind:string;purpose:string;count:number;contentHash:string|null}>();
mock.module('../../../../../../packages/device/src/sticker-transaction-broker',()=>({...brokerModule,
 acquirePrivateStickerTransaction(...args:Parameters<typeof brokerModule.acquirePrivateStickerTransaction>){const [key,input,,,options]=args;const contentHash=input.kind==='damage'?Bun.hash(JSON.stringify([input.stickerId,input.mask.width,input.mask.height,Bun.hash(input.mask.pixels).toString(),input.surface?Bun.hash(input.surface.normals).toString():null,input.surface?Bun.hash(input.surface.uv).toString():null])).toString(16):null;const id=Bun.hash(key).toString(16),entry=privateAcquisitions.get(id)??{kind:input.kind,purpose:options?.purpose??'full',count:0,contentHash};entry.count++;privateAcquisitions.set(id,entry);return originalAcquirePrivate(...args);},
}));
const geometryModule=await import('../../../../../../packages/device/src/sticker-pack-resources');
const originalPrepareGeometry=geometryModule.preparePackGeometry;
const geometryInputs=new Map<string,{kind:string;artId:string|null;width:number;normalHash:string|null;uvHash:string|null;normalCount:number;uvCount:number}>();
mock.module('../../../../../../packages/device/src/sticker-pack-resources',()=>({...geometryModule,
 async preparePackGeometry(...args:Parameters<typeof originalPrepareGeometry>){const value=await originalPrepareGeometry(...args),geometry=value.parts['geometry'];const normal=geometry?.getAttribute('normal'),uv=geometry?.getAttribute('uv');geometryInputs.set(Bun.hash(value.key).toString(16),{kind:args[0].kind,artId:'art' in args[0]?args[0].art.id:null,width:args[0].width,normalHash:normal?Bun.hash(normal.array).toString(16):null,uvHash:uv?Bun.hash(uv.array).toString(16):null,normalCount:normal?.count??0,uvCount:uv?.count??0});return value;},
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
let combined:unknown=null, finalCarry:unknown=null,transitionFailure:string|null=null,transition:unknown=null;
const packetOwner={},reusePacket=Bun.env.REVIEW_PACKET_REUSE!=='off',resizeScale=Number(Bun.env.REVIEW_RESIZE_SCALE??1);assert(resizeScale>0&&Number.isFinite(resizeScale));
if(sent){try{
 const visible=await prepareNativePackFrame(visibleRecipe,{assets:STICKER_CATALOGUE,placements:[],pack},new AbortController().signal,{owner:packetOwner});visible.transferred();visiblePrints=visible.frame.prints.length;
 const beforeCrossOwner=inspectStickerTransactions();await assert.rejects(prepareNativePackFrame(visibleRecipe,{assets:STICKER_CATALOGUE,placements:[],pack},new AbortController().signal,{owner:{},reuseFrom:visible.cache}),/crossed renderer ownership/);assert.deepEqual(inspectStickerTransactions(),beforeCrossOwner);
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
   assert.equal(runtime.inspectRendererResources().privateOwners,2);assert(inspectStickerTransactions().privateOwners > 0 && inspectStickerTransactions().privateOwners <= 20); // Exact equivalence reuse may reduce owners; both carry leases remain asserted separately.
   const transitionOwners:(()=>void)[]=[];
   try{
    const {prepareNativeEquippedFrame}=await import('../../../../../../packages/composite/src/native-sticker-resources');
    const placement={...input.pack.sourcePlacement,wear:.2};
    const equipped=await prepareNativeEquippedFrame({scene:{assets:STICKER_CATALOGUE,placements:[placement],pack},form:DEFAULT_DEVICE_FORM,rear,wrap:createStickerWrapSurface(DEFAULT_DEVICE_FORM,[])},new AbortController().signal);transitionOwners.push(equipped.release);
    const nextPack={...pack,sheet:{...pack.sheet,slots:pack.sheet.slots.map((slot,index)=>index===0?{...slot,state:'placed' as const}:slot)}};
    const nextScene={assets:STICKER_CATALOGUE,placements:[placement],pack:nextPack};
    const nextRecipe=createStickerPackRecipe(nextScene,nextPack,{width:300*resizeScale,height:315*resizeScale,pixel:resizeScale,x:0,y:0,workspaceLowering:0},true);
    const candidate=await prepareNativePackFrame(nextRecipe,nextScene,new AbortController().signal,{owner:packetOwner,reuseFrom:reusePacket?visible.cache:undefined});transitionOwners.push(candidate.release);
    transition={transactions:inspectStickerTransactions(),paper:inspectPaperPool(),carry:runtime.inspectRendererResources(),equippedPrints:equipped.prints.length,candidatePrints:candidate.frame.prints.length,newGeometry:candidate.frame.geometry.length,newDamage:candidate.frame.damage.length,newArtwork:candidate.frame.artworks.length,reused:candidate.frame.reuse?{geometry:candidate.frame.reuse.geometry.map(item=>({keyHash:Bun.hash(item.key).toString(16),id:item.id})),damage:candidate.frame.reuse.damage,artworks:candidate.frame.reuse.artworks}:null};
   }catch(error){transitionFailure=error instanceof Error?error.message:String(error);transition={transactions:inspectStickerTransactions(),paper:inspectPaperPool(),carry:runtime.inspectRendererResources()};}
   finally{for(const release of transitionOwners.reverse())release();}

  }catch(error){carryFailure=error instanceof Error?error.message:String(error);combined={transactions:inspectStickerTransactions(),paper:inspectPaperPool(),carry:runtime.inspectRendererResources(),retainedCarry:retained.length};}
  finally{for(const value of retained)value.release();unmount();finalCarry=runtime.inspectRendererResources();collision.dispose();unbind();rear.dispose();}
 }finally{visible.release();await assert.rejects(prepareNativePackFrame(visibleRecipe,{assets:STICKER_CATALOGUE,placements:[],pack},new AbortController().signal,{owner:packetOwner,reuseFrom:visible.cache}),/crossed renderer ownership/);}
}catch(error){visibleFailure=error instanceof Error?error.message:String(error);}}
warm.rendererRetired();releaseUnusedPaperPackGeometry();releaseUnusedStickerTransactions();await Bun.sleep(30);
const result={resizeScale,geometryInputs:[...geometryInputs].map(([keyHash,value])=>({keyHash,...value})),crossOwnerRejectedWithoutReservation:true,retiredOwnerRejected:true,reusePacket,privateAcquisitions:[...privateAcquisitions].map(([keyHash,value])=>({keyHash,...value})),transitionFailure,transition,provenance:'Actual catalogue PNG alpha and real canonical/private worker preparation; actual shared texture-cache identity with simulated browser bitmap object, no GPU compile.',catalogueArtworks:STICKER_CATALOGUE.length,requestedArtworks:10,acquired,sent,failure,visibleFailure,visiblePrints,carryFailure,combined,finalCarry,beforeRelease,finalOwners:owners,finalPaper:inspectPaperPool(),finalTransactions:inspectStickerTransactions()};
await Bun.write(new URL(resizeScale!==1?'./reviewer-resize-admission.json':reusePacket?'./reviewer-transition-admission.json':'./reviewer-transition-admission-before.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);await GlobalRegistrator.unregister();assert.equal(failure,null);if(reusePacket)assert.equal(transitionFailure,null);else assert(transitionFailure?.includes('capacity exceeded'));assert.equal(visibleFailure,null);assert.equal(carryFailure,null);assert.equal(sent,1);assert.equal(visiblePrints,8);assert.equal(owners,0);assert.equal(inspectPaperPool().accountedBytes,0);assert.equal(inspectStickerTransactions().accountedBytes,0);assert.deepEqual(finalCarry,{canonical:0,privateOwners:0,pendingPrivate:0,preparing:false,bytes:0});
