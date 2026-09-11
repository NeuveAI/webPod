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
const {createNativeStickerWarmup}=await import('../../../../../../packages/composite/src/native-sticker-warmup');
const {inspectPaperPool,releaseUnusedPaperPackGeometry}=await import('../../../../../../packages/device/src/sticker-paper-pool');
const {inspectStickerTransactions,releaseUnusedStickerTransactions}=await import('../../../../../../packages/device/src/sticker-transaction-broker');
const requested=(Bun.env.REVIEW_WARM_IDS?.split(',')??STICKER_CATALOGUE.slice(0,10).map(art=>art.id));
const slotIds=Bun.env.REVIEW_PACKET_IDS?.split(',')??STICKER_CATALOGUE.slice(0,5).map(art=>art.id);
const neighborIds=Bun.env.REVIEW_NEIGHBOR_IDS?.split(',')??[STICKER_CATALOGUE[10]?.id,STICKER_CATALOGUE[20]?.id];
assert(requested.every(id=>STICKER_CATALOGUE.some(art=>art.id===id)));assert(slotIds.every(id=>STICKER_CATALOGUE.some(art=>art.id===id)));assert(neighborIds.every(id=>id&&STICKER_CATALOGUE.some(art=>art.id===id)));
const {prepareNativePackFrame}=await import('../../../../../../packages/composite/src/native-pack-resources');
const {createStickerPackRecipe}=await import('../../../../../../packages/device/src/sticker-pack-recipe');
const pack={progress:1,peel:0,stickerId:null,placement:null,landing:0,sheet:{reveal:1,ink:'#b7aa86',slots:slotIds.map((stickerId,index)=>({stickerId,state:index===0?'earned' as const:'locked' as const})),neighbors:neighborIds.map(stickerId=>{assert(stickerId);return{ink:'#b7aa86',stickerId};})}};
const scene={assets:STICKER_CATALOGUE,prepareIds:requested,placements:[],pack};
const recipe=createStickerPackRecipe(scene,pack,{width:300,height:315,pixel:1,x:0,y:0,workspaceLowering:0},true);
let failure:string|null=null,visibleFailure:string|null=null,ready=false,sent=0,failedUsage:unknown=null;
const abort=new AbortController();
const ackDelayMs=Number(Bun.env.REVIEW_WARM_ACK_MS??0);
const ackTimers=new Set<ReturnType<typeof setTimeout>>();
const warm=createNativeStickerWarmup({send(sequence){sent++;const timer=setTimeout(()=>{ackTimers.delete(timer);warm.ack(sequence);ready=true;},ackDelayMs);ackTimers.add(timer);},fail(error){failure=error.message.split('; preparation=')[0]??error.message;failedUsage={transactions:inspectStickerTransactions(),paper:inspectPaperPool()};abort.abort(error);}});
let visible:Awaited<ReturnType<typeof prepareNativePackFrame>>|null=null;
warm.update(scene);
try{visible=await prepareNativePackFrame(recipe,scene,abort.signal,{owner:{}});}catch(error){visibleFailure=(error instanceof Error?error.message:String(error)).split('; preparation=')[0]??'Unknown preparation error';failedUsage??={transactions:inspectStickerTransactions(),paper:inspectPaperPool()};warm.dispose();}
const deadline=Date.now()+60_000;while(!failure&&!visibleFailure&&!ready&&Date.now()<deadline)await Bun.sleep(5);
const admitted={transactions:inspectStickerTransactions(),paper:inspectPaperPool(),visiblePrints:visible?.frame.prints.length??0};
visible?.release();warm.dispose();warm.rendererRetired();for(const timer of ackTimers)clearTimeout(timer);const cleanupDeadline=Date.now()+15_000;do{releaseUnusedPaperPackGeometry();releaseUnusedStickerTransactions();await Bun.sleep(10);}while((inspectStickerTransactions().accountedBytes||inspectPaperPool().accountedBytes)&&Date.now()<cleanupDeadline);
const result={method:'Concurrent new-renderer warmup and previous usable packet snapshot adapters using actual shared texture cache, exact PNG alpha and real workers; controlled bitmap/compile ACK boundary, no GPU timing.',requested,slotIds,neighborIds,ackDelayMs,acquired,sent,ready,failure,visibleFailure,failedUsage,admitted,privateAcquisitions:[...privateAcquisitions].map(([keyHash,value])=>({keyHash,...value})),final:{owners,transactions:inspectStickerTransactions(),paper:inspectPaperPool()}};
await Bun.write(new URL('./reviewer-cold-overlap.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);await GlobalRegistrator.unregister();assert.equal(owners,0);assert.equal(inspectStickerTransactions().accountedBytes,0);assert.equal(inspectPaperPool().accountedBytes,0);assert.equal(failure,null);assert.equal(visibleFailure,null);assert(ready);
