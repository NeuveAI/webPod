import assert from 'node:assert/strict';
import {BufferGeometry,Float32BufferAttribute} from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import {STICKER_CATALOGUE} from '../../../../../../packages/stickers/src/catalogue';
import {createStickerPackRecipe} from '../../../../../../packages/device/src/sticker-pack-recipe';
import {stickerPackLeafSlots} from '../../../../../../packages/device/src/sticker-pack-graph';
import {prepareStickerPackGeometry} from '../../../../../../packages/device/src/sticker-pack-resource-data';
import {restoreShell} from '../../../../../../packages/device/src/immutable-shell-transfer';
import {drainSteps,yieldSteps} from '../../../../../../packages/device/src/sticker-computation-steps';
import {equalStickerDamageInputs,surfaceDamageIsIdentity} from '../../../../../../packages/device/src/sticker-damage-input';
import {createSurfaceStickerDamageSteps} from '../../../../../../packages/device/src/sticker-alpha';
import type {StickerDamageRequest} from '../../../../../../packages/device/src/sticker-transaction-data';
const count=32*32,base={width:32,height:32,alpha:new Uint8Array(count).fill(255),onset:new Uint8Array(count).fill(128),distance:new Uint16Array(count).fill(1),boundaryCandidates:Uint32Array.from({length:count},(_,i)=>i)};
const request=(geometry:BufferGeometry):StickerDamageRequest=>({kind:'damage',artworkKey:'same-owned-texture',stickerId:'proof',mask:{width:32,height:32,pixels:base.alpha},surface:{normals:Float32Array.from(geometry.getAttribute('normal').array),uv:Float32Array.from(geometry.getAttribute('uv').array)}});
const pack={progress:0,peel:0,stickerId:null,placement:null,landing:0,sheet:{reveal:0,ink:'#b7aa86',slots:STICKER_CATALOGUE.slice(0,5).map((art,index)=>({stickerId:art.id,state:index===0?'earned' as const:'locked' as const})),neighbors:[{ink:'#b7aa86',stickerId:'PW-B01'},{ink:'#b7aa86',stickerId:'PW-C01'}]}};
const rows:unknown[]=[];const previous=new Map<string,StickerDamageRequest>();
for(const [width,height,pixel]of [[231.22394283886186,242.78513998080496,.8116761084662326],[130.81970435848044,137.36068957640447,.4088115761202514]]){
 assert(width!==undefined&&height!==undefined&&pixel!==undefined);
 const recipe=createStickerPackRecipe({assets:STICKER_CATALOGUE},pack,{width,height,pixel,x:0,y:0,workspaceLowering:0},true);
 for(const {node}of stickerPackLeafSlots(recipe)){if(node.kind!=='print')continue;const wire=drainSteps(prepareStickerPackGeometry(node.geometry)).parts['geometry'];assert(wire);const geometry=restoreShell(wire),input=request(geometry);
  assert(drainSteps(surfaceDamageIsIdentity(input.surface)));const output=drainSteps(createSurfaceStickerDamageSteps(base,geometry));
  assert.deepEqual(output,base);const prior=previous.get(node.id);if(prior)assert(drainSteps(equalStickerDamageInputs(prior,input)));previous.set(node.id,input);rows.push({id:node.id,width,exactAllFields:true});geometry.dispose();
 }
}
const active=new BufferGeometry();active.setAttribute('normal',new Float32BufferAttribute([0,0,.8,0,0,.8,0,0,.8,0,0,.8],3));active.setAttribute('uv',new Float32BufferAttribute([0,1,1,1,0,0,1,0],2));const activeInput=request(active);assert(!drainSteps(surfaceDamageIsIdentity(activeInput.surface)));assert.notDeepEqual(drainSteps(createSurfaceStickerDamageSteps(base,active)).onset,base.onset);
const flat=previous.values().next().value;assert(flat);assert(!drainSteps(equalStickerDamageInputs(flat,activeInput)));
assert(!drainSteps(equalStickerDamageInputs(flat,{...flat,artworkKey:'different'})));assert(!drainSteps(equalStickerDamageInputs(flat,{...flat,stickerId:'different'})));
const pixels=base.alpha.slice();pixels[0]=0;assert(!drainSteps(equalStickerDamageInputs(flat,{...flat,mask:{...flat.mask,pixels}})));
const invalid={normals:new Float32Array(12).fill(1),uv:new Float32Array(8)};assert(!drainSteps(surfaceDamageIsIdentity(invalid)));
const nonfinite={normals:new Float32Array([0,0,NaN,0,0,1,0,0,1,0,0,1]),uv:Float32Array.from(active.getAttribute('uv').array)};assert(!drainSteps(surfaceDamageIsIdentity(nonfinite)));
const cancelled=new AbortController();cancelled.abort();await assert.rejects(yieldSteps(equalStickerDamageInputs(flat,flat),cancelled.signal),{name:'AbortError'});active.dispose();
await Bun.write(new URL('./damage-equivalence.json',import.meta.url),JSON.stringify({method:'Exact captured resize geometry, actual authored surface-damage generator, every synthetic boundary texel; no browser timing',rows,activeBranchNotAliased:true,changedArtworkStickerMaskRejected:true,invalidIndexingAndNaNNotCertified:true,cancellation:true},null,2)+'\n');
