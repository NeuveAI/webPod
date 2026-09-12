import assert from 'node:assert/strict';
import {createStickerDamageField} from '../../../../../../packages/device/src/sticker-alpha';
import {createStickerPeelGeometry,STICKER_SURFACE} from '../../../../../../packages/device/src/sticker-surface';
import {prepareStickerContourSteps} from '../../../../../../packages/device/src/sticker-contour-computation';
import {drainSteps} from '../../../../../../packages/device/src/sticker-computation-steps';
import {acquireStickerTransaction,inspectStickerTransactions,releaseUnusedStickerTransactions} from '../../../../../../packages/device/src/sticker-transaction-broker';
import type {StickerContourRequest} from '../../../../../../packages/device/src/sticker-transaction-data';
import {STICKER_CATALOGUE} from '../../../../../../packages/stickers/src/catalogue';
const source=await Bun.file(new URL('../../../../../../packages/device/src/sticker-transaction-broker.ts',import.meta.url)).text();
const extracted=source.slice(source.indexOf('function contourWorkBytes('),source.indexOf('function inputBytes('));
const js=new Bun.Transpiler({loader:'ts'}).transformSync(extracted);
const extractedEstimate:unknown=new Function('STICKER_SURFACE',js+';return contourWorkBytes;')(STICKER_SURFACE);
assert.equal(typeof extractedEstimate,'function');
const estimate=(input:StickerContourRequest):number=>{assert(typeof extractedEstimate==='function');const result:unknown=extractedEstimate(input);assert(typeof result==='number'&&Number.isFinite(result));return result;};
const pixels=new Uint8Array(32*32);for(let y=4;y<28;y++)for(let x=4;x<28;x++)pixels[y*32+x]=255;
const field=createStickerDamageField({width:32,height:32,pixels},'contour-admission');
const art=STICKER_CATALOGUE[0];assert(art);const full=createStickerPeelGeometry(art,1,0,STICKER_SURFACE.segments),small=createStickerPeelGeometry(art,1,0,24);
const input=(wear:number,positions=full.getAttribute('position').array,uv=full.getAttribute('uv').array):StickerContourRequest=>{assert(positions instanceof Float32Array&&uv instanceof Float32Array);return {kind:'contour',damageKey:'unavailable-reference',field,wear,positions,uv};};
let checks=0;const values:unknown[]=[];
for(const wear of [0,.4,1,NaN]){
 const request=input(wear);assert.equal(estimate(request),field.boundaryCandidates.length*512);
 const result=drainSteps(prepareStickerContourSteps(field,wear,request.positions,request.uv));assert(result.paths.length>0);checks++;
 for(const [positions,uv]of [[small.getAttribute('position').array,small.getAttribute('uv').array],[request.positions,request.uv.subarray(2)],[request.positions.subarray(3),request.uv]] as const){
  const mismatch=input(wear,positions,uv);assert.equal(estimate(mismatch),0);const actual=drainSteps(prepareStickerContourSteps(field,wear,mismatch.positions,mismatch.uv));assert.deepEqual(actual,{paths:[],anchors:new Float64Array()});checks++;
 }
 values.push({wear:Number.isNaN(wear)?'NaN':wear,fullAllowance:estimate(request),paths:result.paths.length});
}
const current=acquireStickerTransaction('contour-current',input(0));const currentResult=await current.result;assert.equal(currentResult.kind,'contour');
const cancelled=acquireStickerTransaction('contour-cancelled',input(.4));const cancelledResult=cancelled.result.catch(error=>error);cancelled.release();await cancelledResult;
assert.equal((await current.result),currentResult);checks++;
const oversized={...input(0),field:{...field,boundaryCandidates:new Uint32Array(210000)}};
await assert.rejects(acquireStickerTransaction('fullgrid-over-cap',oversized).result,/capacity exceeded/);assert.equal((await current.result),currentResult);checks++;
current.release();releaseUnusedStickerTransactions();await Bun.sleep(30);releaseUnusedStickerTransactions();assert.equal(inspectStickerTransactions().accountedBytes,0);assert.equal(inspectStickerTransactions().entries,0);checks++;
full.dispose();small.dispose();
await Bun.write(new URL('./gl-contour-admission-exact.json',import.meta.url),JSON.stringify({checks,values,final:inspectStickerTransactions(),scope:'Actual contour generator, extracted installed broker estimate, actual worker cancellation/current retention and unchanged over-cap full-grid rejection.'},null,2)+'\n');console.log(JSON.stringify({checks,final:inspectStickerTransactions()}));
