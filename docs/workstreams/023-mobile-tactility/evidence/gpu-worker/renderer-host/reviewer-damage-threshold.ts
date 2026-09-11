import assert from 'node:assert/strict';
import {BufferGeometry,Float32BufferAttribute} from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import {drainSteps} from '../../../../../../packages/device/src/sticker-computation-steps';
import {surfaceDamageIsIdentity} from '../../../../../../packages/device/src/sticker-damage-input';
import {createSurfaceStickerDamageSteps,STICKER_SURFACE_DAMAGE_EXPOSURE_THRESHOLD} from '../../../../../../packages/device/src/sticker-alpha';
const base={width:2,height:2,alpha:new Uint8Array(4).fill(255),onset:new Uint8Array(4).fill(128),distance:new Uint16Array(4).fill(1),boundaryCandidates:new Uint32Array([0,1,2,3])};
const rows=[];
for(const value of [.9499999,.95,.9500001,-.9499999,-.9500001,1,1.01]){
 const normals=Float32Array.from({length:12},(_,i)=>i%3===2?value:0),uv=new Float32Array([0,1,1,1,0,0,1,0]);
 const geometry=new BufferGeometry().setAttribute('normal',new Float32BufferAttribute(normals,3)).setAttribute('uv',new Float32BufferAttribute(uv,2));
 const z=normals[2];assert(z!==undefined);const exposure=Math.min(1,Math.max(0,1-Math.abs(z)));
 const certified=drainSteps(surfaceDamageIsIdentity({normals,uv}));assert.equal(certified,exposure<STICKER_SURFACE_DAMAGE_EXPOSURE_THRESHOLD);
 const output=drainSteps(createSurfaceStickerDamageSteps(base,geometry));if(certified)assert.deepEqual(output,base);
 rows.push({z,exposure,certified});geometry.dispose();
}
await Bun.write(new URL('./reviewer-damage-threshold.json',import.meta.url),JSON.stringify({method:'Independent exact Float32 boundary inputs versus unchanged authored surface generator',rows},null,2)+'\n');
