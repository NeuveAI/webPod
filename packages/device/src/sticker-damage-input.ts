import {STICKER_SURFACE_DAMAGE_EXPOSURE_THRESHOLD} from './sticker-alpha';
import type {StickerDamageRequest} from './sticker-transaction-data';
/** Exact consumed-input/output equivalence, with bounded cooperative checkpoints.
 * Positions are deliberately absent: damage consumes mask, normals and UV;
 * each geometry still owns its independently prepared position-based contour. */
export function* equalStickerDamageInputs(a:StickerDamageRequest,b:StickerDamageRequest):Generator<void,boolean,void>{
 if(a.artworkKey!==b.artworkKey||a.stickerId!==b.stickerId||a.mask.width!==b.mask.width||a.mask.height!==b.mask.height)return false;
 const equal=function*(left:Uint8Array|Float32Array,right:Uint8Array|Float32Array):Generator<void,boolean,void>{
  if(left===right)return true;if(left.byteLength!==right.byteLength)return false;
  const x=new Uint8Array(left.buffer,left.byteOffset,left.byteLength),y=new Uint8Array(right.buffer,right.byteOffset,right.byteLength);
  for(let index=0;index<x.length;index++){if(x[index]!==y[index])return false;if((index&4095)===4095)yield;}
  return true;
 };
 if(!(yield*equal(a.mask.pixels,b.mask.pixels)))return false;
 if((yield*surfaceDamageIsIdentity(a.surface))&&(yield*surfaceDamageIsIdentity(b.surface)))return true;
 if(a.surface===null||b.surface===null)return a.surface===b.surface;
 return (yield*equal(a.surface.normals,b.surface.normals))&&(yield*equal(a.surface.uv,b.surface.uv));
}

/** Conservative certificate for the existing sampled exposure branch. Valid
 * finite UV endpoints guarantee its rounded/clamped lookup stays in this grid;
 * every grid normal skips the branch, so every boundary candidate must skip it.
 * No rounded normal, epsilon comparison or changed damage formula is used. */
export function* surfaceDamageIsIdentity(surface:StickerDamageRequest['surface']):Generator<void,boolean,void>{
 if(surface===null)return true;
 const {normals,uv}=surface,count=normals.length/3,n=Math.round(Math.sqrt(count))-1;
 if((n+1)**2!==count)return true; // Exact early-return condition in authored math.
 if(n<1||uv.length<count*2)return false;
 const minU=uv[0],maxU=uv[n*2],maxV=uv[1],minV=uv[n*(n+1)*2+1];
 if(minU===undefined||maxU===undefined||maxV===undefined||minV===undefined||![minU,maxU,maxV,minV].every(Number.isFinite)||maxU<=minU||maxV<=minV)return false;
 for(let i=2;i<normals.length;i+=3){const z=normals[i];if(z===undefined||!Number.isFinite(z)||Math.min(1,Math.max(0,1-Math.abs(z)))>=STICKER_SURFACE_DAMAGE_EXPOSURE_THRESHOLD)return false;if(i%768===2)yield;}
 return true;
}
