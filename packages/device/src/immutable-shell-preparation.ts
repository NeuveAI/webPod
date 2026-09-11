import {useLayoutEffect} from 'react';
import type {DeviceFormParams} from './form';
import {prepareDeviceSteps,restorePreparedDevice,disposePreparedDevice,type PreparedDevice,type DevicePreparationResponse,DEVICE_PREPARATION_VERSION} from './device-preparation-data';
import {yieldSteps} from './sticker-computation-steps';

type Entry={id:number;bytes:number;resident:Worker|null;key:string;form:DeviceFormParams;promise:Promise<void>;resolve:()=>void;value:PreparedDevice|null;error:unknown;owners:number;expiry?:ReturnType<typeof setTimeout>};
type RenderLease={id:number;entry:Entry;instance:Worker;pending:boolean;release:()=>void;reject:(error:unknown)=>void;resolve:()=>void;timer:ReturnType<typeof setTimeout>};
const cache=new Map<string,Entry>();
const renderLeases=new Map<number,RenderLease>();
let nextId=0,nextLeaseId=0;
const queue:Entry[]=[];
let active:Entry|null=null,worker:Worker|null=null;
let deadline:ReturnType<typeof setTimeout>|undefined;
function stop(){
 clearTimeout(deadline);deadline=undefined;const retired=worker;worker=null;retired?.terminate();
 for(const entry of cache.values())if(entry.resident===retired)entry.resident=null;
 for(const lease of [...renderLeases.values()])if(lease.instance===retired&&lease.pending){lease.reject(Error('Preparation worker retired'));lease.release();}
}
function evict(entry:Entry){
 if(entry.owners||cache.get(entry.key)!==entry)return;clearTimeout(entry.expiry);cache.delete(entry.key);
 if(entry.resident&&entry.resident===worker)worker.postMessage({type:'evict',id:entry.id});entry.resident=null;
 if(entry.value)disposePreparedDevice(entry.value);
 if(!active&&queue.length===0&&![...cache.values()].some(item=>item.resident===worker&&worker!==null))stop();
}
function entryBytes(entry:Entry){return entry.bytes*(entry.resident===worker&&worker!==null?2:1);}
function accountedBytes(){return [...cache.values()].reduce((sum,entry)=>sum+entryBytes(entry),0)+[...renderLeases.values()].reduce((sum,lease)=>sum+lease.entry.bytes*(lease.pending?2:1),0);}
function settle(entry:Entry,value:PreparedDevice|null,error?:unknown){
 entry.value=value;entry.error=error;entry.bytes=value?preparedBytes(value):0;active=null;entry.resolve();
 entry.expiry=setTimeout(()=>evict(entry),30_000);
 // Live owners retain their resources. Unused assemblies are capped by both
 // count and 64 MiB; queued inputs contain only small numeric form recipes.
 const unused=[...cache.values()].filter(item=>item!==entry&&item.owners===0&&item.value);
 while(unused.length>=4 || unused.reduce((sum,item)=>sum+entryBytes(item),entryBytes(entry))>64*1024*1024){const oldest=unused.shift();if(!oldest)break;evict(oldest);}
 pump();
}
function fallback(entry:Entry){
 stop();
 // Termination precedes recovery: only one producer can own this entry.
 const controller=new AbortController();
 void yieldSteps(prepareDeviceSteps(entry.form),controller.signal).then(
  data=>{if(active!==entry)return;try{settle(entry,restorePreparedDevice(data));}catch(error){settle(entry,null,error);}},
  error=>{if(active===entry)settle(entry,null,error);},
 );
}
function pump(){
 if(active)return;
 const entry=queue.shift();if(!entry){if(![...cache.values()].some(item=>item.resident===worker&&worker!==null))stop();return;}active=entry;
 try{
  if(!worker){
   worker=new Worker(new URL('./immutable-shell-worker.ts',import.meta.url),{type:'module'});
   const instance=worker;
   worker.onmessage=({data}:MessageEvent<DevicePreparationResponse>)=>{
    if(worker!==instance)return;
    if('type' in data){
     const lease=renderLeases.get(data.leaseId);if(!lease||lease.instance!==instance||lease.entry.id!==data.id||!lease.pending)return;
     clearTimeout(lease.timer);
     if(data.type==='lease-failed'){lease.reject(Error(data.error));lease.release();}
     else{lease.pending=false;lease.resolve();}
     return;
    }
    if(!active||active.id!==data.id)return;const current=active;clearTimeout(deadline);deadline=undefined;
    if(!('result' in data)){fallback(current);return;}
    try{current.resident=instance;settle(current,restorePreparedDevice(data.result));}catch{fallback(current);}
   };
   const fail=()=>{if(worker!==instance)return;if(active)fallback(active);else stop();};worker.onerror=fail;worker.onmessageerror=fail;
  }
  deadline=setTimeout(()=>fallback(entry),15_000);
  worker.postMessage({id:entry.id,form:entry.form});
 }catch{fallback(entry);}
}
function read(form:DeviceFormParams):Entry {
 const key=`${DEVICE_PREPARATION_VERSION}:${JSON.stringify(form)}`;let entry=cache.get(key);
 if(!entry&&queue.length>=3){const gate=active??queue[0];if(gate)throw gate.promise;}
 if(!entry){
  let resolve=()=>{};const promise=new Promise<void>(done=>{resolve=done;});
  entry={id:++nextId,bytes:0,resident:null,key,form:{...form},promise,resolve,value:null,error:null,owners:0};cache.set(key,entry);queue.push(entry);pump();
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
 * A failed/unavailable worker does not silently rebuild a cached recipe: native
 * admission fails, and the existing complete GL path can borrow main's exact
 * recovered resources. New uncached recipes still use the sole normal producer.
 * Caller owns closing the receiving port and disposing adopted renderer data.
 */
export async function acquirePreparedDeviceForRenderer(form:DeviceFormParams,port:MessagePort,signal:AbortSignal):Promise<{
 readonly id:number;readonly leaseId:number;readonly query:PreparedDevice;release():void;
}>{
 let transferred=false;
 try{
  let entry:Entry;
  for(;;){
   if(signal.aborted)throw signal.reason??new DOMException('Cancelled','AbortError');
   try{entry=read(form);break;}catch(error){if(!(error instanceof Promise))throw error;await waitForPreparation(error,signal);}
  }
  const instance=worker,value=entry.value;
  if(!instance||entry.resident!==instance||!value)throw Error('Native renderer requires a resident prepared recipe');
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
   if(renderLeases.get(leaseId)?.pending&&worker===instance){if(active)fallback(active);else stop();}
   release();
  };
  const timer=setTimeout(()=>{
   if(worker!==instance)return;
   // Terminate before any exceptional recovery: the outstanding copy cannot
   // race a second producer or publish through its old MessagePort afterward.
   if(active)fallback(active);else stop();
  },15_000);
  renderLeases.set(leaseId,{id:leaseId,entry,instance,pending:true,release,reject,resolve,timer});
  signal.addEventListener('abort',onAbort,{once:true});
  try{
   instance.postMessage({type:'lease',id:entry.id,leaseId,port},[port]);transferred=true;
   await prepared;
   if(retired||signal.aborted)throw signal.reason??new DOMException('Cancelled','AbortError');
   return {id:entry.id,leaseId,query:value,release};
  }catch(error){release();throw error;}
 }finally{if(!transferred)port.close();}
}

/** Bounded scalar inspection; no geometry traversal or recurring sampler. */
export function inspectDevicePreparation(){return {
 entries:cache.size,queued:queue.length,active:active?.id??null,worker:worker!==null,
 renderLeases:renderLeases.size,accountedBytes:accountedBytes(),
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
