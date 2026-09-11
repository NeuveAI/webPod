import assert from 'node:assert/strict';
import {acquireStickerTransaction,inspectStickerTransactions,releaseUnusedStickerTransactions} from '../../../../../../packages/device/src/sticker-transaction-broker';
import {stickerTransactionBuffers,type StickerDamageRequest,type StickerContourRequest} from '../../../../../../packages/device/src/sticker-transaction-data';
async function pair(shared:boolean) {
 const backing=new ArrayBuffer(8192),first=new Uint8Array(backing,1024,1024),second=new Uint8Array(shared?backing:new ArrayBuffer(8192),2048,1024);first.fill(255);second.fill(255);
 const request=(pixels:Uint8Array):StickerDamageRequest=>({kind:'damage',artworkKey:'alias',stickerId:'alias',mask:{width:32,height:32,pixels},surface:null});
 const a=acquireStickerTransaction('alias-a',request(first)),b=acquireStickerTransaction('alias-b',request(second));
 const values=await Promise.all([a.result,b.result]),resultBytes=values.reduce((sum,value)=>sum+stickerTransactionBuffers(value).reduce((total,buffer)=>total+buffer.byteLength,0),0);
 const actual=inspectStickerTransactions().accountedBytes,expected=(shared?8192:16384)+resultBytes*2;
 assert.equal(actual,expected,'actual full backing buffers once on main; independent worker results separately');
 a.release();b.release();releaseUnusedStickerTransactions();assert.equal(inspectStickerTransactions().accountedBytes,0);return{actual,expected,resultBytes};
}
const shared=await pair(true),independent=await pair(false);assert.equal(independent.actual-shared.actual,8192);
const RealWorker=globalThis.Worker;let sentKind:string|null=null,onContour:(()=>void)|null=null,producer:Worker|null=null;
Object.defineProperty(globalThis,'Worker',{value:class {constructor(url:string|URL,options?:WorkerOptions){const worker=new RealWorker(url,options);producer=worker;const send=worker.postMessage.bind(worker);Object.defineProperty(worker,'postMessage',{value(message:unknown,transfer?:Transferable[]){send(message,transfer??[]);if(typeof message==='object'&&message!==null&&'input'in message&&typeof message.input==='object'&&message.input!==null&&'kind'in message.input&&typeof message.input.kind==='string'&&message.input.kind.startsWith('contour')){sentKind=message.input.kind;onContour?.();}}});return worker;}}});
const damageInput:StickerDamageRequest={kind:'damage',artworkKey:'reference',stickerId:'reference',mask:{width:32,height:32,pixels:new Uint8Array(1024).fill(255)},surface:null};
async function contourFixture(cloned:boolean){
 const damage=acquireStickerTransaction('reference',damageInput),value=await damage.result;assert.equal(value.kind,'damage');if(value.kind!=='damage')throw Error('wrong result');
 const input:StickerContourRequest={kind:'contour',damageKey:'reference',field:cloned?structuredClone(value.field):value.field,wear:0,positions:new Float32Array([0,0,0,1,0,0,0,1,0]),uv:new Float32Array([0,0,1,0,0,1])};
 return{damage,input};
}
try{
 const reference=await contourFixture(false);let activeObserved=false;
 onContour=()=>{reference.damage.release();releaseUnusedStickerTransactions();assert.equal(inspectStickerTransactions().entries,2,'canonical field pinned while worker uses it');activeObserved=true;};
 const cancelled=acquireStickerTransaction('cancelled-contour',reference.input);void cancelled.result.catch(()=>{});assert.equal(sentKind,'contour-reference');assert(activeObserved);
 cancelled.release();assert.notEqual(inspectStickerTransactions().active,null,'cancelled native execution remains charged');assert(inspectStickerTransactions().accountedBytes>0);
 await assert.rejects(cancelled.result);onContour=null;releaseUnusedStickerTransactions();assert.equal(inspectStickerTransactions().accountedBytes,0);
 const unmatched=await contourFixture(true);const full=acquireStickerTransaction('full-contour',unmatched.input);await full.result;assert.equal(sentKind,'contour','equal values with independent field buffers cannot borrow canonical reference');full.release();unmatched.damage.release();releaseUnusedStickerTransactions();
 const loss=await contourFixture(false);
 onContour=()=>{const current=producer;assert(current);current.onerror?.(new ErrorEvent('error'));};
 const recovered=acquireStickerTransaction('recover-contour',loss.input);const output=await recovered.result;assert.equal(output.kind,'contour');assert.equal(inspectStickerTransactions().worker,false);onContour=null;
 recovered.release();loss.damage.release();releaseUnusedStickerTransactions();assert.equal(inspectStickerTransactions().accountedBytes,0);
}finally{Object.defineProperty(globalThis,'Worker',{value:RealWorker});}
const result={method:'Actual broker/producer arrays and contour reference dispatch; observed cancellation and forced producer failure recover exact contour through existing fallback.',checks:7,shared,independent,final:inspectStickerTransactions()};await Bun.write(new URL('./accounting.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);
