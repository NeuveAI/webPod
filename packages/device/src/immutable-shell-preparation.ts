import {useLayoutEffect} from 'react';
import type {DeviceFormParams} from './form';
import {borrowedPreparedDeviceData,copyPreparedDeviceSteps,preparedDeviceBuffers,prepareDeviceSteps,restorePreparedDevice,disposePreparedDevice,type PreparedDevice,type DevicePreparationResponse,DEVICE_PREPARATION_VERSION} from './device-preparation-data';
import {yieldSteps} from './sticker-computation-steps';

type Entry={id:number;bytes:number;resident:Worker|null;residencyFailure:string|null;key:string;form:DeviceFormParams;promise:Promise<void>;resolve:()=>void;value:PreparedDevice|null;error:unknown;owners:number;expiry?:ReturnType<typeof setTimeout>};
type RenderLease={id:number;entry:Entry;instance:Worker;pending:boolean;release:()=>void;reject:(error:unknown)=>void;resolve:()=>void;timer:ReturnType<typeof setTimeout>};
type Recovery={phase:'copy'|'sent';failure:string|null;id:number;entry:Entry;instance:Worker|null;controller:AbortController;promise:Promise<void>;resolve:()=>void;reject:(error:unknown)=>void;timer:ReturnType<typeof setTimeout>};
let recovery:Recovery|null=null;let nextRecoveryId=0;let rendererRequests=0;
const cache=new Map<string,Entry>();
const renderLeases=new Map<number,RenderLease>();
let nextId=0,nextLeaseId=0;
const queue:Entry[]=[];
let active:Entry|null=null,worker:Worker|null=null;
let deadline:ReturnType<typeof setTimeout>|undefined;
function finishRecovery(pending:Recovery,error?:unknown){
 if(recovery!==pending)return;
 recovery=null;clearTimeout(pending.timer);pending.entry.owners--;
 pending.entry.expiry=setTimeout(()=>evict(pending.entry),0);
 if(error)pending.reject(error);else pending.resolve();
}
function stop(reason = 'Preparation worker retired'){
 clearTimeout(deadline);deadline=undefined;
 if(recovery){const pending=recovery;pending.failure=reason;pending.controller.abort();if(pending.phase==='sent')finishRecovery(pending,Error(reason));}
 const retired=worker;worker=null;retired?.terminate();
 for(const entry of cache.values())if(entry.resident===retired){entry.resident=null;entry.residencyFailure=reason;}
 for(const lease of [...renderLeases.values()])if(lease.instance===retired&&lease.pending){lease.reject(Error('Preparation worker retired'));lease.release();}
}
function evict(entry:Entry){
 if(entry.owners||cache.get(entry.key)!==entry)return;clearTimeout(entry.expiry);cache.delete(entry.key);
 if(entry.resident&&entry.resident===worker)worker.postMessage({type:'evict',id:entry.id});entry.resident=null;
 if(entry.value)disposePreparedDevice(entry.value);
 if(!active&&!recovery&&queue.length===0&&![...cache.values()].some(item=>item.resident===worker&&worker!==null))stop();
}
function entryBytes(entry:Entry){return entry.bytes*(entry.resident===worker&&worker!==null?2:1);}
function accountedBytes(){return [...cache.values()].reduce((sum,entry)=>sum+entryBytes(entry),0)+[...renderLeases.values()].reduce((sum,lease)=>sum+lease.entry.bytes*(lease.pending?2:1),0)+(recovery?.entry.bytes??0);}
function settle(entry:Entry,value:PreparedDevice|null,error?:unknown){
 entry.value=value;entry.error=error;entry.bytes=value?preparedBytes(value):0;active=null;entry.resolve();
 entry.expiry=setTimeout(()=>evict(entry),30_000);
 // Live owners retain their resources. Unused assemblies are capped by both
 // count and 64 MiB; queued inputs contain only small numeric form recipes.
 const unused=[...cache.values()].filter(item=>item!==entry&&item.owners===0&&item.value);
 while(unused.length>=4 || unused.reduce((sum,item)=>sum+entryBytes(item),entryBytes(entry))>64*1024*1024){const oldest=unused.shift();if(!oldest)break;evict(oldest);}
 pump();
}
function fallback(entry:Entry, reason = 'Preparation recovery'){
 entry.residencyFailure=reason;
 stop(reason);
 // Termination precedes recovery: only one producer can own this entry.
 const controller=new AbortController();
 void yieldSteps(prepareDeviceSteps(entry.form),controller.signal).then(
  data=>{if(active!==entry)return;try{settle(entry,restorePreparedDevice(data));}catch(error){settle(entry,null,error);}},
  error=>{if(active===entry)settle(entry,null,error);},
 );
}
function workerFailure(reason:string){
 if(active)fallback(active,reason);else {stop(reason);pump();}
}
function ensureWorker():Worker {
 if(worker)return worker;
 const instance=new Worker(new URL('./immutable-shell-worker.ts',import.meta.url),{type:'module'});worker=instance;
 instance.onmessage=({data}:MessageEvent<DevicePreparationResponse>)=>{
  if(worker!==instance)return;
  if('type' in data){
   if(data.type==='seeded'){
    const pending=recovery;
    if(!pending||pending.instance!==instance||pending.id!==data.recoveryId||pending.entry.id!==data.id)return;
    pending.entry.resident=instance;pending.entry.residencyFailure=null;
    finishRecovery(pending);pump();return;
   }
   const lease=renderLeases.get(data.leaseId);if(!lease||lease.instance!==instance||lease.entry.id!==data.id||!lease.pending)return;
   clearTimeout(lease.timer);
   if(data.type==='lease-failed'){lease.reject(Error(data.error));lease.release();}
   else{lease.pending=false;lease.resolve();}
   return;
  }
  if(!active||active.id!==data.id)return;const current=active;clearTimeout(deadline);deadline=undefined;
  if(!('result' in data)){fallback(current, `Preparation result failed: ${String(data.error).slice(0, 256)}`);return;}
  try{current.resident=instance;current.residencyFailure=null;settle(current,restorePreparedDevice(data.result));}catch(error){fallback(current, `Preparation adoption failed: ${String(error).slice(0, 256)}`);}
 };
 instance.onerror=event=>{if(worker===instance)workerFailure(`Preparation worker error: ${event.message.slice(0,256)}`);};
 instance.onmessageerror=()=>{if(worker===instance)workerFailure('Preparation worker message decoding failed');};
 return instance;
}
function pump(){
 if(active||recovery)return;
 const entry=queue.shift();if(!entry){if(![...cache.values()].some(item=>item.resident===worker&&worker!==null))stop();return;}active=entry;
 try{
  const instance=ensureWorker();
  deadline=setTimeout(()=>fallback(entry, 'Preparation worker exceeded 15000ms deadline'),15_000);
  instance.postMessage({id:entry.id,form:entry.form});
 }catch(error){fallback(entry, `Preparation worker startup failed: ${String(error).slice(0, 256)}`);}
}
/** Share the normal producer's execution slot. Waiting callers hold only a
 * cache pin; one private copy is reserved before allocation. A cancelled seed
 * retires its worker before releasing the reservation, so retry cannot overlap
 * a late adoption. Other waiters may retry, but the cancelled caller never does. */
async function ensureResident(entry:Entry,signal:AbortSignal):Promise<void>{
 for(;;){
  if(signal.aborted)throw signal.reason??new DOMException('Cancelled','AbortError');
  if(worker&&entry.resident===worker)return;
  const waiting=active?.promise??recovery?.promise;
  if(waiting){await waitForPreparation(waiting.catch(()=>{}),signal);continue;}
  if(!entry.value)throw Error('Prepared query owner unavailable');
  for(const unused of [...cache.values()]){
   if(accountedBytes()+entry.bytes<=128*1024*1024)break;
   if(unused!==entry&&unused.owners===0&&unused.value)evict(unused);
  }
  if(accountedBytes()+entry.bytes>128*1024*1024)throw Error('Preparation recovery capacity exceeded');
  let resolve=()=>{},reject:(error:unknown)=>void=()=>{};
  const promise=new Promise<void>((done,fail)=>{resolve=done;reject=fail;});
  const controller=new AbortController();
  const pending:Recovery={phase:'copy',failure:null,id:++nextRecoveryId,entry,instance:null,controller,promise,resolve,reject,
   timer:setTimeout(()=>{if(recovery===pending)workerFailure('Preparation reseed exceeded 15000ms deadline');},15_000)};
  recovery=pending;clearTimeout(entry.expiry);entry.owners++;
  const cancel=()=>{if(recovery===pending)workerFailure('Preparation reseed cancelled');};
  signal.addEventListener('abort',cancel,{once:true});
  // yieldSteps starts with a macrotask yield. Copying never runs in the caller's
  // input handler; no geometry algorithm participates in canonical recovery.
  const value=entry.value;
  void Promise.resolve().then(()=>yieldSteps(copyPreparedDeviceSteps(borrowedPreparedDeviceData(value)),controller.signal)).then(data=>{
   if(recovery!==pending)return;
   if(pending.failure){finishRecovery(pending,Error(pending.failure));pump();return;}
   try{const instance=ensureWorker();pending.instance=instance;pending.phase='sent';instance.postMessage({type:'seed',id:entry.id,recoveryId:pending.id,result:data},preparedDeviceBuffers(data));}
   catch(error){if(recovery===pending)workerFailure(`Preparation reseed failed: ${String(error).slice(0,256)}`);}
  },error=>{if(recovery===pending){stop(pending.failure??`Preparation copy failed: ${String(error).slice(0,256)}`);finishRecovery(pending,error);pump();}});
  try{await waitForPreparation(promise,signal);}finally{signal.removeEventListener('abort',cancel);}
 }
}
function read(form:DeviceFormParams):Entry {
 const key=`${DEVICE_PREPARATION_VERSION}:${JSON.stringify(form)}`;let entry=cache.get(key);
 if(!entry&&queue.length>=3){const gate=active??queue[0];if(gate)throw gate.promise;}
 if(!entry){
  let resolve=()=>{};const promise=new Promise<void>(done=>{resolve=done;});
  entry={id:++nextId,bytes:0,resident:null,residencyFailure:null,key,form:{...form},promise,resolve,value:null,error:null,owners:0};cache.set(key,entry);queue.push(entry);pump();
 }
 if(entry.error)throw entry.error;if(!entry.value)throw entry.promise;return entry;
}
/** Suspends before publication. Identical forms share one immutable assembly and one
 * preparation; a session-wide worker serializes builds with at most three waiting forms. Geometry is passed as mesh props, not Fiber children; final owner
 * cleanup releases its CPU and renderer buffers.
 * Uncommitted Suspense work has no reliable React cancellation callback: bounded
 * admitted jobs finish, then expire after 30s if never acquired. Failures terminate
 * the worker before single-producer cooperative recovery; stale replies are
 * rejected by worker identity and request id. Queued work has no execution timer. */
export function usePreparedImmutableShells(form:DeviceFormParams):PreparedDevice {
 const entry=read(form);
 useLayoutEffect(()=>{
  clearTimeout(entry.expiry);entry.owners++;
  return()=>{entry.owners--;entry.expiry=setTimeout(()=>evict(entry),0);};
 },[entry]);
 if(!entry.value)throw entry.promise;
 return entry.value;
}

async function waitForPreparation(promise:Promise<void>,signal:AbortSignal):Promise<void>{
 let rejectAbort=()=>{};
 const aborted=new Promise<never>((_,reject)=>{rejectAbort=()=>reject(signal.reason??new DOMException('Cancelled','AbortError'));signal.addEventListener('abort',rejectAbort,{once:true});if(signal.aborted)rejectAbort();});
 try{await Promise.race([promise,aborted]);}finally{signal.removeEventListener('abort',rejectAbort);}
}
/** Non-React lease of the SAME preparation/cache authority as the GL hook.
 * Canonical bytes remain in its worker; it copies/transfers renderer-private
 * arrays through port while main retains immutable query wrappers. The 128MiB
 * renderer admission budget counts canonical+main bytes, transferred leases,
 * and two payloads for an in-flight clone. At most four renderer leases exist.
 * A lost canonical owner is reseeded from exact retained query bytes through
 * one cooperative private copy. Recovery never rebuilds a cached recipe. Its
 * additional payload is reserved before copying; an unavailable worker rejects
 * native admission while GL retains complete resources. New uncached recipes
 * still use the sole normal producer. At most four acquisition callers wait.
 * Caller owns closing the receiving port and disposing adopted renderer data.
 */
export async function acquirePreparedDeviceForRenderer(form:DeviceFormParams,port:MessagePort,signal:AbortSignal):Promise<{
 readonly id:number;readonly leaseId:number;readonly query:PreparedDevice;release():void;
}>{
 let transferred=false,pinned:Entry|undefined;
 if(rendererRequests>=4){port.close();throw Error('Prepared renderer request capacity exceeded');}
 rendererRequests++;
 try{
  let entry:Entry;
  for(;;){
   if(signal.aborted)throw signal.reason??new DOMException('Cancelled','AbortError');
   try{entry=read(form);break;}catch(error){if(!(error instanceof Promise))throw error;await waitForPreparation(error,signal);}
  }
  clearTimeout(entry.expiry);entry.owners++;pinned=entry;
  if(!worker||entry.resident!==worker)await ensureResident(entry,signal);
  if(signal.aborted)throw signal.reason??new DOMException('Cancelled','AbortError');
  const instance=worker,value=entry.value;
  if(!instance||entry.resident!==instance||!value)throw Error(`Native renderer requires a resident prepared recipe: ${entry.residencyFailure ?? 'canonical owner unavailable'}`);
  for(const unused of [...cache.values()]){
   if(accountedBytes()+entry.bytes*2<=128*1024*1024)break;
   if(unused!==entry&&unused.owners===0&&unused.value)evict(unused);
  }
  if(renderLeases.size>=4||accountedBytes()+entry.bytes*2>128*1024*1024)throw Error('Prepared renderer lease capacity exceeded');
  clearTimeout(entry.expiry);entry.owners++;
  const leaseId=++nextLeaseId;
  let retired=false,resolve=()=>{},reject:(error:unknown)=>void=()=>{};
  const prepared=new Promise<void>((done,fail)=>{resolve=done;reject=fail;});
  const release=()=>{
   if(retired)return;retired=true;
   const lease=renderLeases.get(leaseId);if(lease){clearTimeout(lease.timer);renderLeases.delete(leaseId);}
   signal.removeEventListener('abort',onAbort);entry.owners--;entry.expiry=setTimeout(()=>evict(entry),0);
  };
  const onAbort=()=>{
   reject(signal.reason??new DOMException('Cancelled','AbortError'));
   // A copy already queued in the worker keeps its reservation until it ends.
   // Termination is the bounded cancellation boundary; deleting the accounting
   // record alone would let repeated aborts enqueue unlimited private copies.
   if(renderLeases.get(leaseId)?.pending&&worker===instance){if(active)fallback(active, 'Pending renderer lease cancelled');else stop('Pending renderer lease cancelled');}
   release();
  };
  const timer=setTimeout(()=>{
   if(worker!==instance)return;
   // Terminate before any exceptional recovery: the outstanding copy cannot
   // race a second producer or publish through its old MessagePort afterward.
   if(active)fallback(active, 'Renderer private copy exceeded 15000ms deadline');else stop('Renderer private copy exceeded 15000ms deadline');
  },15_000);
  renderLeases.set(leaseId,{id:leaseId,entry,instance,pending:true,release,reject,resolve,timer});
  signal.addEventListener('abort',onAbort,{once:true});
  try{
   instance.postMessage({type:'lease',id:entry.id,leaseId,port},[port]);transferred=true;
   await prepared;
   if(retired||signal.aborted)throw signal.reason??new DOMException('Cancelled','AbortError');
   return {id:entry.id,leaseId,query:value,release};
  }catch(error){release();throw error;}
 }finally{rendererRequests--;if(pinned){const entry=pinned;entry.owners--;entry.expiry=setTimeout(()=>evict(entry),0);}if(!transferred)port.close();}
}

/** Bounded scalar inspection; no geometry traversal or recurring sampler. */
export function inspectDevicePreparation(){return {
 entries:cache.size,queued:queue.length,active:active?.id??null,worker:worker!==null,
 renderLeases:renderLeases.size,rendererRequests,recovering:recovery?.entry.id??null,recoveryBytes:recovery?.entry.bytes??0,accountedBytes:accountedBytes(),
 canonicalBytes:[...cache.values()].reduce((sum,entry)=>sum+(entry.resident===worker&&worker!==null?entry.bytes:0),0),
};}

function preparedBytes(value:PreparedDevice):number {
 const buffers=new Set<ArrayBufferLike>();
 for(const geometry of [value.front,value.back,...Object.values(value.inserts),...value.hardware.map(part=>part.geometry)]) {
  for(const attribute of Object.values(geometry.attributes))buffers.add(attribute.array.buffer);if(geometry.index)buffers.add(geometry.index.array.buffer);
 }
 for(const texture of Object.values(value.textures))if(texture.image.data)buffers.add(texture.image.data.buffer);buffers.add(value.backplatePixels.buffer);
 return [...buffers].reduce((sum,buffer)=>sum+buffer.byteLength,0);
}
