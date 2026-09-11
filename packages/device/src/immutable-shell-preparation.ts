import {useLayoutEffect} from 'react';
import type {DeviceFormParams} from './form';
import {prepareDeviceSteps,restorePreparedDevice,disposePreparedDevice,type PreparedDevice,type DevicePreparationResponse,DEVICE_PREPARATION_VERSION} from './device-preparation-data';
import {yieldSteps} from './sticker-computation-steps';

type Entry={id:number;bytes:number;key:string;form:DeviceFormParams;promise:Promise<void>;resolve:()=>void;value:PreparedDevice|null;error:unknown;owners:number;expiry?:ReturnType<typeof setTimeout>};
const cache=new Map<string,Entry>();
let nextId=0;
const queue:Entry[]=[];
let active:Entry|null=null,worker:Worker|null=null;
let deadline:ReturnType<typeof setTimeout>|undefined;
function stop(){clearTimeout(deadline);deadline=undefined;worker?.terminate();worker=null;}
function evict(entry:Entry){if(entry.owners||cache.get(entry.key)!==entry)return;clearTimeout(entry.expiry);cache.delete(entry.key);if(entry.value)disposePreparedDevice(entry.value);}
function settle(entry:Entry,value:PreparedDevice|null,error?:unknown){
 entry.value=value;entry.error=error;entry.bytes=value?preparedBytes(value):0;active=null;entry.resolve();
 entry.expiry=setTimeout(()=>evict(entry),30_000);
 // Live owners retain their resources. Unused assemblies are capped by both
 // count and 64 MiB; queued inputs contain only small numeric form recipes.
 const unused=[...cache.values()].filter(item=>item!==entry&&item.owners===0&&item.value);
 while(unused.length>=4 || unused.reduce((sum,item)=>sum+item.bytes,entry.bytes)>64*1024*1024){const oldest=unused.shift();if(!oldest)break;evict(oldest);}
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
 const entry=queue.shift();if(!entry){stop();return;}active=entry;
 try{
  if(!worker){
   worker=new Worker(new URL('./immutable-shell-worker.ts',import.meta.url),{type:'module'});
   const instance=worker;
   worker.onmessage=({data}:MessageEvent<DevicePreparationResponse>)=>{
    if(worker!==instance||!active||active.id!==data.id)return;const current=active;clearTimeout(deadline);deadline=undefined;
    if(!('result' in data)){fallback(current);return;}
    try{settle(current,restorePreparedDevice(data.result));}catch{fallback(current);}
   };
   const fail=()=>{if(worker===instance&&active)fallback(active);};worker.onerror=fail;worker.onmessageerror=fail;
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
  entry={id:++nextId,bytes:0,key,form:{...form},promise,resolve,value:null,error:null,owners:0};cache.set(key,entry);queue.push(entry);pump();
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

function preparedBytes(value:PreparedDevice):number {
 const buffers=new Set<ArrayBufferLike>();
 for(const geometry of [value.front,value.back,...Object.values(value.inserts),...value.hardware.map(part=>part.geometry)]) {
  for(const attribute of Object.values(geometry.attributes))buffers.add(attribute.array.buffer);if(geometry.index)buffers.add(geometry.index.array.buffer);
 }
 for(const texture of Object.values(value.textures))if(texture.image.data)buffers.add(texture.image.data.buffer);buffers.add(value.backplatePixels.buffer);
 return [...buffers].reduce((sum,buffer)=>sum+buffer.byteLength,0);
}
