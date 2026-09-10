import {useLayoutEffect} from 'react';
import type {DeviceFormParams} from './form';
import {createImmutableShells} from './immutable-shells';
import {restoreShell,type ShellPair,type ShellPairTransfer} from './immutable-shell-transfer';

type Entry={key:string;form:DeviceFormParams;promise:Promise<void>;resolve:()=>void;value:ShellPair|null;error:unknown;owners:number;expiry?:ReturnType<typeof setTimeout>};
const cache=new Map<string,Entry>();
const queue:Entry[]=[];
let active:Entry|null=null,worker:Worker|null=null;
let deadline:ReturnType<typeof setTimeout>|undefined;
function stop(){clearTimeout(deadline);deadline=undefined;worker?.terminate();worker=null;}
function evict(entry:Entry){if(entry.owners||cache.get(entry.key)!==entry)return;clearTimeout(entry.expiry);cache.delete(entry.key);entry.value?.front.dispose();entry.value?.back.dispose();}
function settle(entry:Entry,value:ShellPair|null,error?:unknown){
 entry.value=value;entry.error=error;active=null;entry.resolve();
 entry.expiry=setTimeout(()=>evict(entry),30_000);
 // Live device owners are retained; at most four unused completed pairs remain.
 const unused=[...cache.values()].filter(item=>item!==entry&&item.owners===0&&item.value);
 while(unused.length>=4){const oldest=unused.shift();if(oldest)evict(oldest);}
 pump();
}
function fallback(entry:Entry){
 stop();
 // Exceptional unsupported/failed-worker recovery retains the former CPU
 // constructor, without adding a synchronous indexing pass to first entry.
 setTimeout(()=>{try{settle(entry,createImmutableShells(entry.form,false));}catch(error){settle(entry,null,error);}},0);
}
function pump(){
 if(active)return;
 const entry=queue.shift();if(!entry){stop();return;}active=entry;
 try{
  if(!worker){
   worker=new Worker(new URL('./immutable-shell-worker.ts',import.meta.url),{type:'module'});
   const instance=worker;
   worker.onmessage=({data}:MessageEvent<{result?:ShellPairTransfer;error?:string}>)=>{
    if(worker!==instance||!active)return;const current=active;clearTimeout(deadline);deadline=undefined;
    if(!data.result){fallback(current);return;}
    let front:ShellPair['front']|undefined;
    try{front=restoreShell(data.result.front);const back=restoreShell(data.result.back);settle(current,{front,back});}catch{front?.dispose();fallback(current);}
   };
   const fail=()=>{if(worker===instance&&active)fallback(active);};worker.onerror=fail;worker.onmessageerror=fail;
  }
  deadline=setTimeout(()=>fallback(entry),5000);
  worker.postMessage(entry.form);
 }catch{fallback(entry);}
}
function read(form:DeviceFormParams):Entry {
 const key=JSON.stringify(form);let entry=cache.get(key);
 if(!entry&&queue.length>=3){const gate=active??queue[0];if(gate)throw gate.promise;}
 if(!entry){
  let resolve=()=>{};const promise=new Promise<void>(done=>{resolve=done;});
  entry={key,form:{...form},promise,resolve,value:null,error:null,owners:0};cache.set(key,entry);queue.push(entry);pump();
 }
 if(entry.error)throw entry.error;if(!entry.value)throw entry.promise;return entry;
}
/** Suspends before publication. Identical forms share one immutable pair and one
 * preparation; a session-wide worker serializes builds with at most three waiting forms. Meshes opt out of Fiber
 * auto-disposal; final owner cleanup releases both CPU and renderer buffers. */
export function usePreparedImmutableShells(form:DeviceFormParams):ShellPair {
 const entry=read(form);
 useLayoutEffect(()=>{
  clearTimeout(entry.expiry);entry.owners++;
  return()=>{entry.owners--;entry.expiry=setTimeout(()=>evict(entry),0);};
 },[entry]);
 if(!entry.value)throw entry.promise;
 return entry.value;
}
