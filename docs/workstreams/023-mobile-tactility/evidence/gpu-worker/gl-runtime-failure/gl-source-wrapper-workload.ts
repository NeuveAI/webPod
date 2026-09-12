import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {GlobalRegistrator} from '../../../../../../packages/composite/node_modules/@happy-dom/global-registrator';
import {Texture,    type BufferGeometry} from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import {STICKER_CATALOGUE} from '../../../../../../packages/stickers/src/catalogue';
import {createStickerPeelGeometry} from '../../../../../../packages/device/src/sticker-surface';
import {preparePrint,type PreparedPrint} from '../../../../../../packages/device/src/sticker-prepared-damage';
import {preparePackGeometry} from '../../../../../../packages/device/src/sticker-pack-resources';
import {createStickerPackRecipe,type StickerPackNode} from '../../../../../../packages/device/src/sticker-pack-recipe';
import {inspectStickerTransactions,releaseUnusedStickerTransactions} from '../../../../../../packages/device/src/sticker-transaction-broker';
import {releaseUnusedPaperPackGeometry,inspectPaperPool} from '../../../../../../packages/device/src/sticker-paper-pool';
const ActualWorker=globalThis.Worker;let carryWorkers=0;const workerErrors:string[]=[];
GlobalRegistrator.register();
Object.defineProperty(globalThis,'Worker',{configurable:true,value:class extends ActualWorker{constructor(url:string|URL,options?:WorkerOptions){super(url,options);if(String(url).includes('sticker-carry-worker')){carryWorkers++;this.addEventListener('error',event=>workerErrors.push(event.message));}}}});
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

const textures=new Map<string,Texture>(),owners:PreparedPrint[]=[],geometryOwners:(()=>void)[]=[],stages:unknown[]=[];
let phase='',failure:string|null=null;
const textureFor=async(id:string)=>{let texture=textures.get(id);if(texture)return texture;const art=STICKER_CATALOGUE.find(a=>a.id===id);assert(art);const decoded=await rgba(`assets${art.url}`);const image=document.createElement('img');pixels.set(image,decoded.output);for(const [key,value]of Object.entries({complete:true,naturalWidth:decoded.width,naturalHeight:decoded.height}))Object.defineProperty(image,key,{value});texture=new Texture(image);textures.set(id,texture);return texture;};
const print=async(id:string,geometry:BufferGeometry)=>{owners.push(await preparePrint({id,texture:await textureFor(id),geometry,wearGeometry:geometry,wear:0},new AbortController().signal));stages.push({phase,transactions:inspectStickerTransactions()});};
try{
 for(const art of STICKER_CATALOGUE.slice(0,5)){
  const geometry=createStickerPeelGeometry(art,1,.75,4);geometryOwners.push(()=>geometry.dispose());
  for(const variant of ['earned','locked','placed']){phase=`warmup:${art.id}:${variant}`;await print(art.id,geometry);}
 }
 const a=STICKER_CATALOGUE[0],b=STICKER_CATALOGUE[10],c=STICKER_CATALOGUE[20];assert(a&&b&&c);
 const pack={progress:1,peel:0,stickerId:null,placement:null,landing:0,sheet:{reveal:1,ink:'#b7aa86',slots:STICKER_CATALOGUE.slice(0,5).map((art,i)=>({stickerId:art.id,state:i===0?'earned' as const:'locked' as const})),neighbors:[{ink:'#b7aa86',stickerId:b.id},{ink:'#b7aa86',stickerId:c.id}]}};
 const recipe=createStickerPackRecipe({assets:STICKER_CATALOGUE},pack,{width:231.22394283886186,height:242.78513998080496,pixel:.8116761084662326,x:0,y:0,workspaceLowering:0},true);
 const leaves:Extract<StickerPackNode,{kind:'print'}>[]=[];const visit=(nodes:readonly StickerPackNode[])=>{for(const n of nodes){if(n.kind==='group')visit(n.children);else if(n.kind==='print')leaves.push(n);}};visit(recipe.children);
 for(const leaf of leaves){phase=`packet:${leaf.id}`;const resource=await preparePackGeometry(leaf.geometry,new AbortController().signal);geometryOwners.push(resource.release);const geometry=resource.parts.geometry;assert(geometry);await print(leaf.artId,geometry);}
 const sourceLeaf=leaves.find(leaf=>leaf.artId===a.id);assert(sourceLeaf);
 const sourceResource=await preparePackGeometry(sourceLeaf.geometry,new AbortController().signal);geometryOwners.push(sourceResource.release);const raw=sourceResource.parts.geometry;assert(raw);
 for(let index=0;index<4;index++){
  phase=`pending-source-wrapper:${index}`;
  const source=await preparePrint({id:a.id,texture:await textureFor(a.id),geometry:raw,wearGeometry:raw,wear:0},new AbortController().signal);
  try{await print(a.id,source.geometry);}finally{source.release();}
 }

}catch(error){failure=error instanceof Error?error.message:String(error);stages.push({phase,failure,transactions:inspectStickerTransactions()});}
finally{for(const owner of owners)owner.release();for(const release of geometryOwners)release();for(const texture of textures.values())texture.dispose();releaseUnusedStickerTransactions();releaseUnusedPaperPackGeometry();await Bun.sleep(30);}
const result={carryWorkers,workerErrors,phase,failure,preparedPrints:owners.length,stages,finalTransactions:inspectStickerTransactions(),finalPaper:inspectPaperPool(),scope:'Actual preparePrint pending-source wrapper generations retain prior displayed candidates; exact catalogue alpha/packet, no mounted React scheduling claim'};
await Bun.write(new URL('./gl-source-wrapper-workload.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({carryWorkers,workerErrors,phase,failure,prepared:owners.length,finalTransactions:result.finalTransactions}));await GlobalRegistrator.unregister();
