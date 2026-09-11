import assert from 'node:assert/strict';
import {acquireStickerTransaction, acquirePrivateStickerTransaction, inspectStickerTransactions, releaseUnusedStickerTransactions} from '../../../../../../packages/device/src/sticker-transaction-broker';
import {stickerTransactionBuffers, type StickerDamageRequest, type StickerPrivateTransactionResult} from '../../../../../../packages/device/src/sticker-transaction-data';
const input:StickerDamageRequest={kind:'damage',artworkKey:'private-proof',stickerId:'private-proof',mask:{width:64,height:64,pixels:new Uint8Array(64*64).fill(255)},surface:null};
async function receive(port:MessagePort){return await new Promise<StickerPrivateTransactionResult>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('delivery timeout')),3000);port.onmessage=({data}:MessageEvent<{version:number;id:number;result:StickerPrivateTransactionResult}>)=>{clearTimeout(timer);resolve(data.result);};port.start();});}
const main=acquireStickerTransaction('private-proof',input),source=await main.result;assert.equal(source.kind,'damage');if(source.kind!=='damage')throw Error('wrong source');
const fullPorts=new MessageChannel(),gpuPorts=new MessageChannel(),fullResult=receive(fullPorts.port2),gpuResult=receive(gpuPorts.port2);
const full=await acquirePrivateStickerTransaction('private-proof',input,fullPorts.port1,new AbortController().signal);
const gpuAbort=new AbortController();
const gpu=await acquirePrivateStickerTransaction('private-proof',input,gpuPorts.port1,gpuAbort.signal,{purpose:'render-damage'});
const [fullValue,gpuValue]=await Promise.all([fullResult,gpuResult]);assert.equal(fullValue.kind,'damage');assert.equal(gpuValue.kind,'render-damage');if(gpuValue.kind!=='render-damage')throw Error('wrong private variant');
assert.deepEqual(gpuValue.gpu,source.gpu);assert.equal(gpuValue.width,source.field.width);assert.equal(gpuValue.height,source.field.height);assert.equal(gpuValue.stickerId,source.stickerId);assert.notEqual(gpuValue.gpu.buffer,source.gpu.buffer);
const fullBytes=stickerTransactionBuffers(fullValue).reduce((sum,buffer)=>sum+buffer.byteLength,0),gpuBytes=gpuValue.gpu.byteLength;
assert.equal(inspectStickerTransactions().privateBytes,fullBytes+gpuBytes);
main.release();releaseUnusedStickerTransactions();assert.equal(inspectStickerTransactions().entries,0);assert.equal(inspectStickerTransactions().worker,false);assert.equal(inspectStickerTransactions().privateOwners,2);assert.deepEqual(gpuValue.gpu,source.gpu);
gpuAbort.abort();assert.equal(inspectStickerTransactions().privateBytes,fullBytes+gpuBytes,'delivered ownership outlives request signal');
full.release();gpu.release();full.release();gpu.release();fullPorts.port2.close();gpuPorts.port2.close();assert.equal(inspectStickerTransactions().accountedBytes,0);
const preAbort=new AbortController();preAbort.abort();const cancelled=new MessageChannel();await assert.rejects(acquirePrivateStickerTransaction('private-proof',input,cancelled.port1,preAbort.signal,{purpose:'render-damage'}));cancelled.port2.close();await Bun.sleep(30);releaseUnusedStickerTransactions();
// Abort immediately after the actual producer receives a private-delivery
// message. This exercises worker retirement, pending reservation cleanup and
// inability of any late old response to revive the delivery.
const RealWorker=globalThis.Worker;let abortDelivery:(()=>void)|null=null;
Object.defineProperty(globalThis,'Worker',{value:class {constructor(url:string|URL,options?:WorkerOptions){const worker=new RealWorker(url,options),send=worker.postMessage.bind(worker);Object.defineProperty(worker,'postMessage',{value(message:unknown,transfer?:Transferable[]){send(message,transfer??[]);if(typeof message==='object'&&message!==null&&'type'in message&&message.type==='deliver')abortDelivery?.();}});return worker;}}});
try{
 const pinned=acquireStickerTransaction('during-copy',input);await pinned.result;
 const during=new AbortController(),ports=new MessageChannel();abortDelivery=()=>during.abort();
 await assert.rejects(acquirePrivateStickerTransaction('during-copy',input,ports.port1,during.signal,{purpose:'render-damage'}));
 pinned.release();ports.port2.close();abortDelivery=null;await Bun.sleep(30);releaseUnusedStickerTransactions();assert.equal(inspectStickerTransactions().privateOwners,0);assert.equal(inspectStickerTransactions().privateBytes,0);assert.equal(inspectStickerTransactions().accountedBytes,0);
}finally{Object.defineProperty(globalThis,'Worker',{value:RealWorker});}
const result={method:'Actual canonical and private producer workers; exact full/default and GPU-only byte comparison, canonical eviction with retained private bytes, pre-abort and abort immediately after real delivery dispatch.',checks:9,fullBytes,gpuBytes,final:inspectStickerTransactions()};await Bun.write(new URL('./private-damage.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);
