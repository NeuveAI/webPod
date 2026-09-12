import {preparedStickerResources,registerPreparedStickerResources} from '../../../../../../packages/device/src/sticker-transaction-client';
import {getPreparedStickerContour} from '../../../../../../packages/device/src/sticker-contour-preparation-data';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {GlobalRegistrator} from '../../../../../../packages/composite/node_modules/@happy-dom/global-registrator';
import {Texture, BufferGeometry} from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import {STICKER_CATALOGUE} from '../../../../../../packages/stickers/src/catalogue';
import {createStickerPeelGeometry,STICKER_SURFACE} from '../../../../../../packages/device/src/sticker-surface';
import {preparePrint,type PreparedPrint} from '../../../../../../packages/device/src/sticker-prepared-damage';
import {inspectStickerTransactions,releaseUnusedStickerTransactions} from '../../../../../../packages/device/src/sticker-transaction-broker';
import {releaseUnusedPaperPackGeometry} from '../../../../../../packages/device/src/sticker-paper-pool';
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

const art=STICKER_CATALOGUE[0];assert(art);
const decoded=await rgba(`assets${art.url}`),image=document.createElement('img');pixels.set(image,decoded.output);
for(const [key,value]of Object.entries({complete:true,naturalWidth:decoded.width,naturalHeight:decoded.height}))Object.defineProperty(image,key,{value});
const texture=new Texture(image),geometry=createStickerPeelGeometry(art,1,.75,STICKER_SURFACE.segments);
const normals=geometry.getAttribute('normal');for(let i=2;i<normals.array.length;i+=3)normals.array[i]=.6;
const owners:PreparedPrint[]=[],geometries:BufferGeometry[]=[geometry];let checks=0;
const prepare=async(g:BufferGeometry,id=art.id,signal=new AbortController().signal)=>{const value=await preparePrint({id,texture,geometry:g,wearGeometry:g,wear:.4},signal);owners.push(value);return value;};
const key=(p:PreparedPrint)=>preparedStickerResources(p.geometry).filter(d=>d.input.kind==='damage').at(-1)?.key;
const clone=(source:BufferGeometry)=>{const g=source.clone();geometries.push(g);return g;};
const contour=(p:PreparedPrint)=>{const found=getPreparedStickerContour(p.geometry,p.damage.field,p.wear);assert(found);return found.value;};
try{
 const source=await prepare(geometry),first=await prepare(source.geometry),second=await prepare(first.geometry);
 assert.equal(first.damage.field,source.damage.field);assert.equal(second.damage.field,source.damage.field);assert.equal(key(first),key(source));checks++;
 const baseline=await prepare(clone(geometry));assert.notEqual(key(baseline),key(source));assert.deepEqual(first.damage.field,baseline.damage.field);assert.deepEqual(first.damage.texture.image.data,baseline.damage.texture.image.data);assert.deepEqual(contour(first),contour(baseline));assert(contour(first).paths.length>0);checks++;
 for(const kind of ['normal','uv','art'] as const){
  const changed=clone(source.geometry);registerPreparedStickerResources(changed,preparedStickerResources(source.geometry));
  if(kind==='normal')changed.getAttribute('normal').array[2]=.5;
  if(kind==='uv')changed.getAttribute('uv').array[0]=.125;
  const candidate=await prepare(changed,kind==='art'?'PW-A02':art.id);assert.notEqual(key(candidate),key(source),kind);checks++;
  candidate.release();
 }
 const before=inspectStickerTransactions();const abort=new AbortController();const pending=prepare(source.geometry,art.id,abort.signal);abort.abort();await assert.rejects(pending,{name:'AbortError'});assert.deepEqual(inspectStickerTransactions(),before);checks++;
 const borrowed=source.geometry.getAttribute('position').array;const bytes=new Uint8Array(borrowed.buffer).slice();
 source.release();first.release();releaseUnusedStickerTransactions();assert.deepEqual(new Uint8Array(borrowed.buffer),bytes);assert.equal(second.damage.field.alpha.length,decoded.width*decoded.height);assert(contour(second));checks++;
 const alteredPosition=clone(second.geometry);alteredPosition.getAttribute('position').array[0]+=1;registerPreparedStickerResources(alteredPosition,preparedStickerResources(second.geometry));const positioned=await prepare(alteredPosition);assert.equal(key(positioned),key(second));assert.notEqual(positioned.geometry,second.geometry);assert.equal(positioned.geometry.getAttribute('position').array[0],alteredPosition.getAttribute('position').array[0]);checks++;
 // Pending/current acquisition cancellation leaves the previously admitted owners intact.
 const hidden=new AbortController();hidden.abort();await assert.rejects(prepare(second.geometry,art.id,hidden.signal),{name:'AbortError'});assert(contour(second));checks++;
}finally{for(const owner of owners)owner.release();for(const g of geometries)g.dispose();texture.dispose();releaseUnusedStickerTransactions();releaseUnusedPaperPackGeometry();await Bun.sleep(30);}
assert.equal(inspectStickerTransactions().accountedBytes,0);assert.equal(inspectStickerTransactions().entries,0);checks++;
await Bun.write(new URL('./gl-source-wrapper-exact.json',import.meta.url),JSON.stringify({checks,final:inspectStickerTransactions(),scope:'Actual preparation and worker outputs; exact fields/GPU/contour, negative consumed inputs, cancellation and borrowed current retention. No mounted React/browser claim.'},null,2)+'\n');
console.log(JSON.stringify({checks,final:inspectStickerTransactions()}));await GlobalRegistrator.unregister();
