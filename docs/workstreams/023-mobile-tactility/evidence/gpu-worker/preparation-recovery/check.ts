import assert from 'node:assert/strict';
import {mock} from 'bun:test';
import {DEFAULT_DEVICE_FORM} from '../../../../../../packages/device/src/form';
import {borrowedPreparedDeviceData,preparedDeviceBuffers,type DevicePreparationRequest,type DevicePreparationResponse,type PreparedDeviceRenderLease} from '../../../../../../packages/device/src/device-preparation-data';
const cleanups:(()=>void)[]=[];
mock.module('react',()=>({useLayoutEffect:(effect:()=>()=>void)=>{cleanups.push(effect());}}));
const NativeWorker=globalThis.Worker;
const workers:ObservedWorker[]=[];
let holdLeases=false,holdSeeds=false,failSeed=false,preparations=0,seeds=0,peakWorkers=0;
class ObservedWorker {
 readonly actual:Worker;
 onmessage:((event:MessageEvent<DevicePreparationResponse>)=>void)|null=null;
 onerror:((event:ErrorEvent)=>void)|null=null;
 onmessageerror:(()=>void)|null=null;
 readonly held:DevicePreparationResponse[]=[];
 terminated=false;
 constructor(url:URL,options:WorkerOptions){
  this.actual=new NativeWorker(url,options);workers.push(this);
  peakWorkers=Math.max(peakWorkers,workers.filter(worker=>!worker.terminated).length);
  this.actual.onmessage=(event:MessageEvent<DevicePreparationResponse>)=>{
   const data=event.data;
   if('type' in data&&((data.type==='leased'&&holdLeases)||(data.type==='seeded'&&holdSeeds))){this.held.push(data);return;}
   this.onmessage?.(new MessageEvent('message',{data}));
  };
  this.actual.onerror=event=>this.onerror?.(event);
  this.actual.onmessageerror=()=>this.onmessageerror?.();
 }
 postMessage(data:DevicePreparationRequest,transfer:Transferable[]=[]){
  if(data.type==='seed'){seeds++;if(failSeed)throw Error('Injected seed transfer failure');}
  if(!data.type||data.type==='prepare')preparations++;
  this.actual.postMessage(data,transfer);
 }
 terminate(){this.terminated=true;return this.actual.terminate();}
}
Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:ObservedWorker});
const {acquirePreparedDeviceForRenderer:acquire,usePreparedImmutableShells:mount,inspectDevicePreparation:inspect}=await import('../../../../../../packages/device/src/immutable-shell-preparation');
const wait=()=>new Promise<void>(resolve=>setTimeout(resolve,5));
async function until(predicate:()=>boolean){for(let index=0;index<1000;index++){if(predicate())return;await wait();}throw Error('Probe condition deadline');}
function request(){
 const channel=new MessageChannel(),controller=new AbortController();
 const delivered=new Promise<PreparedDeviceRenderLease>(resolve=>{channel.port2.onmessage=(event:MessageEvent<PreparedDeviceRenderLease>)=>resolve(event.data);});
 const result=acquire(DEFAULT_DEVICE_FORM,channel.port1,controller.signal);
 // Attach rejection immediately, while retaining the actual result for assertions.
 void result.catch(()=>{});
 return {channel,controller,delivered,result};
}
const checks:string[]=[];
const check=(condition:unknown,label:string)=>{assert(condition,label);checks.push(label);};
try{
 const first=request(),lease=await first.result,firstData=await first.delivered;
 const query=mount(DEFAULT_DEVICE_FORM),borrowed=borrowedPreparedDeviceData(query);
 const originals=preparedDeviceBuffers(borrowed),bytes=originals.reduce((sum,buffer)=>sum+buffer.byteLength,0);
 assert.equal(lease.query,query);assert.deepEqual(firstData.result,borrowed);
 check(inspect().accountedBytes===bytes*3,'initial canonical, main and private bytes accounted');
 lease.release();first.channel.port2.close();
 async function loseCanonical(){
  holdLeases=true;const pending=request();await pending.delivered;
  await until(()=>workers.some(worker=>worker.held.some(data=>'type' in data&&data.type==='leased')));
  const retired=workers.at(-1);assert(retired);
  pending.controller.abort();await assert.rejects(pending.result);pending.channel.port2.close();holdLeases=false;
  assert.equal(retired.terminated,true);assert.equal(inspect().canonicalBytes,0);assert.equal(inspect().renderLeases,0);
  return retired;
 }
 const old=await loseCanonical();
 check(originals.every(buffer=>buffer.byteLength>0),'genuine private-port copy cancellation retains mounted buffers');
 const retry=request(),recovered=await retry.result,recoveredData=await retry.delivered;
 assert.equal(recovered.query,query);assert.deepEqual(recoveredData.result,borrowed);
 check(preparations===1&&seeds===1,'cancel then retry reseeds exact query bytes without geometry recomputation');
 const beforeLate=inspect();for(const data of old.held)old.onmessage?.(new MessageEvent('message',{data}));
 assert.deepEqual(inspect(),beforeLate);check(true,'retired worker acknowledgements cannot mutate current authority');
 const privateCopy=structuredClone(recoveredData.result,{transfer:preparedDeviceBuffers(recoveredData.result)});
 assert.deepEqual(privateCopy,borrowed);check(originals.every(buffer=>buffer.byteLength>0),'recovered private payload can transfer without detaching mounted query arrays');
 recovered.release();retry.channel.port2.close();
 await loseCanonical();
 const cancelled=request();check(inspect().recoveryBytes===bytes,'reseed copy reserves full payload before allocation');
 cancelled.controller.abort();await assert.rejects(cancelled.result);cancelled.channel.port2.close();
 await until(()=>inspect().recoveryBytes===0);
 check(inspect().recoveryBytes===0&&inspect().worker===false,'copy cancellation releases reservation with no surviving producer');
 holdSeeds=true;
 const a=request(),b=request();await until(()=>workers.some(worker=>!worker.terminated&&worker.held.some(data=>'type' in data&&data.type==='seeded')));
 const seeded=workers.at(-1);assert(seeded);const seedAck=seeded.held.find(data=>'type' in data&&data.type==='seeded');assert(seedAck);
 const seedCount=seeds;check(inspect().recoveryBytes===bytes&&inspect().rendererRequests===2,'concurrent recovery callers share one reserved seed');
 seeded.onmessage?.(new MessageEvent('message',{data:seedAck}));holdSeeds=false;
 const results=await Promise.allSettled([a.result,b.result]);
 check(results.some(result=>result.status==='fulfilled')&&seeds===seedCount,'concurrent callers make one adoption with bounded renderer capacity');
 for(const [index,result] of results.entries()){
  if(result.status==='fulfilled')result.value.release();else assert.match(String(result.reason),/capacity exceeded/);
  (index===0?a:b).channel.port2.close();
 }
 await loseCanonical();holdSeeds=true;
 const cancelAdoption=request();await until(()=>workers.some(worker=>!worker.terminated&&worker.held.some(data=>'type' in data&&data.type==='seeded')));
 const oldSeed=workers.at(-1);assert(oldSeed);
 cancelAdoption.controller.abort();await assert.rejects(cancelAdoption.result);cancelAdoption.channel.port2.close();holdSeeds=false;
 check(oldSeed.terminated&&inspect().recoveryBytes===0&&inspect().canonicalBytes===0,'cancellation after worker adoption retires canonical bytes before retry');
 const afterSeedCancel=request(),afterSeedLease=await afterSeedCancel.result;await afterSeedCancel.delivered;
 const beforeStaleSeed=inspect();for(const data of oldSeed.held)oldSeed.onmessage?.(new MessageEvent('message',{data}));
 assert.deepEqual(inspect(),beforeStaleSeed);check(true,'late retired seed acknowledgement cannot mark replacement resident');
 afterSeedLease.release();afterSeedCancel.channel.port2.close();
 await loseCanonical();failSeed=true;
 const failed=request();await assert.rejects(failed.result,/reseed failed/);failed.channel.port2.close();failSeed=false;
 check(inspect().recoveryBytes===0&&inspect().worker===false&&originals.every(buffer=>buffer.byteLength>0),'seed transfer failure retires producer and preserves query ownership');
 const last=request(),finalLease=await last.result,finalData=await last.delivered;
 assert.deepEqual(finalData.result,borrowed);finalLease.release();last.channel.port2.close();
 check(preparations===1&&peakWorkers===1,'all recovery attempts use one producer and no repeated geometry build');
 // Unmounting an unrelated form must not retire a live canonical recovery.
 const otherForm={...DEFAULT_DEVICE_FORM,bodyCrown:DEFAULT_DEVICE_FORM.bodyCrown+.01};
 for(;;){try{mount(otherForm);break;}catch(error){if(!(error instanceof Promise))throw error;await error;}}
 const previous=workers.at(-1);assert(previous);previous.onmessageerror?.();
 const unrelated=request();const releaseOther=cleanups.pop();assert(releaseOther);releaseOther();
 const unrelatedLease=await unrelated.result,unrelatedData=await unrelated.delivered;
 assert.deepEqual(unrelatedData.result,borrowed);assert.equal(unrelatedLease.query,query);
 check(!unrelated.controller.signal.aborted&&preparations===2,'unrelated form eviction preserves active recovery without recomputation');
 unrelatedLease.release();unrelated.channel.port2.close();
 let disposed=0;query.front.addEventListener('dispose',()=>disposed++);
 const release=cleanups.pop();assert(release);release();await until(()=>inspect().entries===0);
 check(disposed===1&&inspect().accountedBytes===0&&!inspect().worker,'final mounted owner releases resources, reservations and worker once');
 const result={method:'Actual Bun preparation module workers and native MessagePorts; controlled ack delivery and injected seed transfer failure. React commit shim, no browser/GPU or phone timing claim.',checks,passed:checks.length,bytes,preparations,seeds,peakWorkers,final:inspect()};
 await Bun.write(new URL('./check.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);
}finally{for(const worker of workers)worker.terminate();Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:NativeWorker});}
