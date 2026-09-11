import assert from 'node:assert/strict';
import {Texture} from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import {prepareStickerWarmup} from '../../../../../../packages/device/src/sticker-warmup-renderer';
import type {NativePackFrame} from '../../../../../../packages/composite/src/native-pack-resources';
let closes = 0;
class Bitmap implements ImageBitmap {constructor(readonly width = 8,readonly height = 8){}close(){closes++;}}
const texture = new Texture();
function frame():NativePackFrame {
 const image = new Bitmap();
 return {key:'guard', recipe:{kind:'group',id:'warmup',children:[]}, geometry:[], damage:[], artworks:[{id:'art',bitmap:{image,colorSpace:texture.colorSpace,wrapS:texture.wrapS,wrapT:texture.wrapT,minFilter:texture.minFilter,magFilter:texture.magFilter,generateMipmaps:texture.generateMipmaps,anisotropy:texture.anisotropy}}], prints:(['earned','locked','placed'] as const).map(appearance=>({id:'a',key:appearance,appearance,geometryKey:'g',damageResource:1,artwork:'art',wear:0,finishEnabled:true,visible:true,renderOrder:4}))};
}
const signal = new AbortController().signal;
let checks=0;
const aborted=new AbortController();aborted.abort();await assert.rejects(prepareStickerWarmup(frame(),texture,aborted.signal),/aborted|abort/i);assert.equal(closes,1);checks++;
await assert.rejects(prepareStickerWarmup(frame(),null,signal),/environment/);assert.equal(closes,2);checks++;
const duplicate=frame();await assert.rejects(prepareStickerWarmup({...duplicate,prints:[...duplicate.prints,...duplicate.prints]},texture,signal),/Duplicate/);assert.equal(closes,3);checks++;
const incomplete=frame();await assert.rejects(prepareStickerWarmup({...incomplete,prints:incomplete.prints.slice(0,2)},texture,signal),/Incomplete/);assert.equal(closes,4);checks++;
const capacity=frame();await assert.rejects(prepareStickerWarmup({...capacity,prints:Array.from({length:11},()=>capacity.prints).flat()},texture,signal),/capacity/);assert.equal(closes,5);checks++;
const dirtyEmpty=frame();await assert.rejects(prepareStickerWarmup({...dirtyEmpty,prints:[]},texture,signal),/empty/);assert.equal(closes,6);checks++;
const empty=await prepareStickerWarmup({key:'empty',recipe:{kind:'group',id:'empty',children:[]},prints:[],geometry:[],damage:[],artworks:[]},null,signal);assert.equal(empty.root.children.length,0);empty.dispose();checks++;
// Valid descriptors with an omitted actual render leaf cannot claim readiness;
// delegated assembler disposal still closes its bitmap on the validation failure.
await assert.rejects(prepareStickerWarmup(frame(),texture,signal),/omitted/);assert.equal(closes,7);checks++;
texture.dispose();const result={method:'Actual worker helper validation/assembler with controlled bitmap; no GPU compile or bitmap-transfer claim.',checks,bitmapCloses:closes};
await Bun.write(new URL('./worker-guards.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);
