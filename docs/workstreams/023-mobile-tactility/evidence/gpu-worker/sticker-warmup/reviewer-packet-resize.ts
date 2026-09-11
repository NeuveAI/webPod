import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {mock} from 'bun:test';
import {GlobalRegistrator} from '../../../../../../packages/composite/node_modules/@happy-dom/global-registrator';
import {Texture} from '../../../../../../packages/device/node_modules/three/build/three.module.js';
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
let geometryPhase='warmup';
const geometryInputs=new Map<string,{phase:string;kind:string;artId:string|null;width:number;normalHash:string|null;uvHash:string|null;normalCount:number;uvCount:number}>();
mock.module('../../../../../../packages/device/src/sticker-pack-resources',()=>({...geometryModule,
 async preparePackGeometry(...args:Parameters<typeof originalPrepareGeometry>){const value=await originalPrepareGeometry(...args),geometry=value.parts['geometry'];const normal=geometry?.getAttribute('normal'),uv=geometry?.getAttribute('uv');geometryInputs.set(Bun.hash(value.key).toString(16),{phase:geometryPhase,kind:args[0].kind,artId:'art' in args[0]?args[0].art.id:null,width:args[0].width,normalHash:normal?Bun.hash(normal.array).toString(16):null,uvHash:uv?Bun.hash(uv.array).toString(16):null,normalCount:normal?.count??0,uvCount:uv?.count??0});return value;},
}));
const {createNativeStickerWarmup}=await import('../../../../../../packages/composite/src/native-sticker-warmup');
const {inspectPaperPool,releaseUnusedPaperPackGeometry}=await import('../../../../../../packages/device/src/sticker-paper-pool');
const {inspectStickerTransactions,releaseUnusedStickerTransactions}=await import('../../../../../../packages/device/src/sticker-transaction-broker');
const requested=['PW-A01','PW-A02','PW-A03','PW-A04','PW-A05'];
const neighbors=(Bun.env.REVIEW_NEIGHBOR_IDS??'PW-B01,PW-C01').split(',');
const {prepareNativePackFrame}=await import('../../../../../../packages/composite/src/native-pack-resources');
const {createStickerPackRecipe}=await import('../../../../../../packages/device/src/sticker-pack-recipe');
const pack={progress:1,peel:0,stickerId:null,placement:null,landing:0,sheet:{reveal:1,ink:'#b7aa86',slots:requested.map((stickerId,index)=>({stickerId,state:index===0?'earned' as const:'locked' as const})),neighbors:neighbors.map(stickerId=>({ink:'#b7aa86',stickerId}))}};
const scene={assets:STICKER_CATALOGUE,prepareIds:requested,placements:[],pack};
const currentLayout={width:Number(Bun.env.REVIEW_CURRENT_WIDTH??300),height:Number(Bun.env.REVIEW_CURRENT_HEIGHT??315),pixel:Number(Bun.env.REVIEW_CURRENT_PIXEL??1),x:0,y:0,workspaceLowering:0};
const candidateLayout={width:Number(Bun.env.REVIEW_NEXT_WIDTH??330),height:Number(Bun.env.REVIEW_NEXT_HEIGHT??346.5),pixel:Number(Bun.env.REVIEW_NEXT_PIXEL??1.1),x:0,y:0,workspaceLowering:0};
let failure:string|null=null,sent=0,sentSequence=0,visibleFailure:string|null=null,resizeFailure:string|null=null,usage:unknown=null;
const warm=createNativeStickerWarmup({send(sequence){sent++;sentSequence=sequence;},fail(error){failure=error.message;}});warm.update(scene);
const deadline=Date.now()+60_000;while(!failure&&!sent&&Date.now()<deadline)await Bun.sleep(5);if(sent)warm.ack(sentSequence);
const owner={};let current:Awaited<ReturnType<typeof prepareNativePackFrame>>|null=null,candidate:Awaited<ReturnType<typeof prepareNativePackFrame>>|null=null;
if(sent){try{geometryPhase='current';current=await prepareNativePackFrame(createStickerPackRecipe(scene,pack,currentLayout,true),scene,new AbortController().signal,{owner});current.transferred();
 try{geometryPhase='candidate';candidate=await prepareNativePackFrame(createStickerPackRecipe(scene,pack,candidateLayout,true),scene,new AbortController().signal,{owner,reuseFrom:current.cache});}catch(error){resizeFailure=(error instanceof Error?error.message:String(error)).split('; preparation=')[0]??'Unknown resize failure';}
 usage={transactions:inspectStickerTransactions(),paper:inspectPaperPool(),currentPrints:current.frame.prints.length,candidatePrints:candidate?.frame.prints.length??0};
 }catch(error){visibleFailure=(error instanceof Error?error.message:String(error)).split('; preparation=')[0]??'Unknown packet failure';}}
candidate?.release();current?.release();warm.dispose();warm.rendererRetired();const cleanupDeadline=Date.now()+15_000;do{releaseUnusedPaperPackGeometry();releaseUnusedStickerTransactions();await Bun.sleep(10);}while((inspectStickerTransactions().accountedBytes||inspectPaperPool().accountedBytes)&&Date.now()<cleanupDeadline);
const result={method:'Actual same-cache five-artwork warmup then current and resized full packet, old private owner retained; controlled bitmap/compile ACK and explicit world layouts; no browser/GPU timing.',requested,neighbors,currentLayout,candidateLayout,acquired,sent,failure,visibleFailure,resizeFailure,usage,geometryInputs:[...geometryInputs].map(([keyHash,value])=>({keyHash,...value})),privateAcquisitions:[...privateAcquisitions].map(([keyHash,value])=>({keyHash,...value})),final:{owners,transactions:inspectStickerTransactions(),paper:inspectPaperPool()}};
await Bun.write(new URL('./reviewer-packet-resize.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);await GlobalRegistrator.unregister();assert.equal(owners,0);assert.equal(inspectStickerTransactions().accountedBytes,0);assert.equal(inspectPaperPool().accountedBytes,0);assert.equal(failure,null);assert.equal(visibleFailure,null);assert.equal(resizeFailure,null);
