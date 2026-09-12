import type { PaperPreparationInput, PaperWorkerResponse } from './sticker-paper-transfer';
import { prepareStickerPackGeometry, stickerPackGeometryBuffers, type StickerPackGeometryData, type PackResourceWorkerResponse } from './sticker-pack-resource-data';
import { stickerPackGeometryKey, type StickerPackGeometryInput } from './sticker-pack-recipe';
import { yieldSteps } from './sticker-computation-steps';
interface Input { readonly id:number;readonly input:PaperPreparationInput }
interface Client {
 onmessage:((event:MessageEvent<PaperWorkerResponse>)=>void)|null;onerror:(()=>void)|null;onmessageerror:(()=>void)|null;onstart:(()=>void)|null;
 postMessage(input:Input):void;terminate():void;
}
interface Resource {readonly id:number;readonly key:string;readonly input:StickerPackGeometryInput;readonly promise:Promise<StickerPackGeometryData>;readonly resolve:(value:StickerPackGeometryData)=>void;readonly reject:(error:Error)=>void;refs:number;value:StickerPackGeometryData|null;producer:Worker|null;bytes:number;touched:number}
type Job={readonly kind:'paper';readonly client:Client;readonly input:Input;readonly sequence:number}|{readonly kind:'resource';readonly entry:Resource;readonly sequence:number}|{readonly kind:'copy';readonly entry:Resource;readonly port:MessagePort;readonly sequence:number;readonly resolve:()=>void;readonly reject:(error:Error)=>void};
const clients=new Set<Client>(),queue:Job[]=[],resources=new Map<string,Resource>();
const MAX_JOBS=32,MAX_BYTES=96*1024*1024,WORK_BYTES=4*1024*1024,IDLE_MS=30000;
let worker:Worker|null=null,active:Job|null=null,sequence=0,workerFailed=false;
let deadline:ReturnType<typeof setTimeout>|undefined,idleTimer:ReturnType<typeof setTimeout>|undefined;
let fallback:AbortController|null=null,privateBytes=0,privateOwners=0;
const aborted=()=>new DOMException('Paper resource cancelled','AbortError');
const detachedPaper=()=>active?.kind==='paper'&&!clients.has(active.client)?1:0;
const workOwners=()=>clients.size+resources.size+detachedPaper();
const cost=()=>privateBytes+(clients.size+detachedPaper())*WORK_BYTES+[...resources.values()].reduce((total,entry)=>total+(entry.value?entry.bytes*(entry.producer===worker&&worker!==null?2:1):WORK_BYTES),0);
function retireWorker(){
 const previous=worker;worker=null;clearTimeout(deadline);deadline=undefined;
 if(previous){previous.onmessage=null;previous.onerror=null;previous.onmessageerror=null;previous.terminate();}
 for(const resource of resources.values())if(resource.producer===previous)resource.producer=null;
}
function remove(entry:Resource){if(resources.get(entry.key)!==entry)return;resources.delete(entry.key);if(entry.producer===worker)worker?.postMessage({type:'release-pack',id:entry.id});}
function evict(force=false){
 clearTimeout(idleTimer);idleTimer=undefined;
 for(const entry of resources.values())if(entry.refs===0&&entry.value&&(force||performance.now()-entry.touched>=IDLE_MS))remove(entry);
 if(!active&&queue.length===0&&clients.size===0&&resources.size===0)retireWorker();
 if([...resources.values()].some(entry=>entry.refs===0&&entry.value))idleTimer=setTimeout(()=>evict(),IDLE_MS);
}
function finishResource(job:Extract<Job,{kind:'resource'}>,value?:StickerPackGeometryData,error?:Error){
 const entry=job.entry;
 if(active!==job)return;
 active=null;fallback=null;clearTimeout(deadline);deadline=undefined;
 if(entry.refs===0){remove(entry);entry.reject(aborted());}
 else if(value){entry.value=value;entry.bytes=stickerPackGeometryBuffers(value).reduce((sum,buffer)=>sum+buffer.byteLength,0);entry.resolve(value);}
 else{remove(entry);entry.reject(error??new Error('Pack preparation failed'));}
 dispatch();
}
function fail(){
 const interrupted=active;active=null;retireWorker();workerFailed=true;
 if(interrupted?.kind==='paper')interrupted.client.onerror?.();
 else if(interrupted?.kind==='copy'){interrupted.port.close();interrupted.reject(new Error('Paper producer retired'));}
 else if(interrupted?.kind==='resource'){queue.unshift(interrupted);}
 dispatch();
}
function createWorker():Worker{
 const instance=new Worker(new URL('./sticker-paper-worker.ts',import.meta.url),{type:'module'});worker=instance;
 instance.onerror=instance.onmessageerror=()=>{if(worker===instance)fail();};
 instance.onmessage=({data}:MessageEvent<PaperWorkerResponse|PackResourceWorkerResponse>)=>{
  if(worker!==instance||!active)return;
  const completed=active;
  if(completed.kind==='paper'){
   if('type'in data||completed.sequence!==data.id)return;
   active=null;clearTimeout(deadline);deadline=undefined;
   completed.client.onmessage?.(new MessageEvent<PaperWorkerResponse>('message',{data:{...data,id:completed.input.id}}));dispatch();
  }else if(completed.kind==='resource'){
   if(!('type'in data)||data.type!=='pack'||data.id!==completed.sequence)return;
   finishResource(completed,data.value,data.error?new Error(data.error):undefined);
  }else{
   if(!('type'in data)||data.type!=='pack-delivered'||data.deliveryId!==completed.sequence)return;
   active=null;clearTimeout(deadline);deadline=undefined;
   if(data.error)completed.reject(new Error(data.error));else completed.resolve();dispatch();
  }
 };return instance;
}
function dispatch():void{
 if(active)return;
 if(queue.length===0){evict();return;}
 const next=queue.shift();if(!next)return;
 active=next;
 if(next.kind==='resource'&&next.entry.refs===0){finishResource(next,undefined,aborted());return;}
 if(workerFailed||typeof Worker==='undefined'){
  if(next.kind==='paper'){active=null;next.client.onerror?.();dispatch();return;}
  if(next.kind==='copy'){active=null;next.port.close();next.reject(new Error('Canonical paper producer unavailable'));dispatch();return;}
  const controller=new AbortController();fallback=controller;
  void yieldSteps(prepareStickerPackGeometry(next.entry.input),controller.signal).then(value=>finishResource(next,value),error=>finishResource(next,undefined,error instanceof Error?error:new Error('Pack recovery failed')));return;
 }
 try{
  const instance=worker??createWorker();
  // The one producer executes one queued operation. Queue wait has no deadline.
  deadline=setTimeout(()=>{if(active===next&&worker===instance)fail();},15000);
  if(next.kind==='paper'){next.client.onstart?.();instance.postMessage({...next.input,id:next.sequence});}
  else if(next.kind==='resource'){next.entry.producer=instance;instance.postMessage({type:'prepare-pack',id:next.sequence,input:next.entry.input});}
  else if(next.entry.producer!==instance){active=null;clearTimeout(deadline);next.port.close();next.reject(new Error('Canonical paper producer unavailable'));dispatch();}
  else instance.postMessage({type:'deliver-pack',id:next.entry.id,deliveryId:next.sequence,port:next.port},[next.port]);
 }catch{fail();}
}
/** Existing dynamic paper clients and immutable pack leases share one producer
 * and FIFO. One waiting sample per client; execution starts only after admission. */
export function createPaperWorker():Client{
 if(workOwners()>=MAX_JOBS||cost()+WORK_BYTES>MAX_BYTES)throw Error('Paper worker capacity reached');
 let closed=false;
 const client:Client={onmessage:null,onerror:null,onmessageerror:null,onstart:null,
  postMessage(input){if(closed)throw Error('Paper worker owner was disposed');const prior=queue.findIndex(job=>job.kind==='paper'&&job.client===client);if(prior>=0)queue.splice(prior,1);queue.push({kind:'paper',client,input,sequence:++sequence});dispatch();},
  terminate(){if(closed)return;closed=true;clients.delete(client);for(let i=queue.length-1;i>=0;i--){const job=queue[i];if(job?.kind==='paper'&&job.client===client)queue.splice(i,1);}
   // A detached surface does not destroy cached renderer resources. Its bounded
   // in-flight job finishes; callback ownership is removed immediately.
   client.onmessage=null;client.onerror=null;client.onmessageerror=null;client.onstart=null;evict();dispatch();},
 };clients.add(client);return client;
}
export interface PaperPackLease{readonly key:string;readonly result:Promise<StickerPackGeometryData>;release():void}
/** Borrow immutable pack buffers. The cache owns the canonical producer; callers
 * own lightweight geometry wrappers and must never transfer this storage. */
export function acquirePaperPackGeometry(input:StickerPackGeometryInput):PaperPackLease{
 const key=stickerPackGeometryKey(input);let entry=resources.get(key);
 if(!entry){
  evict(true);
  if(workOwners()>=MAX_JOBS||cost()+WORK_BYTES>MAX_BYTES)return{key,result:Promise.reject(new Error('Paper resource capacity exceeded')),release(){}};
  let resolve:Resource['resolve']=()=>{},reject:Resource['reject']=()=>{};
  const promise=new Promise<StickerPackGeometryData>((accept,decline)=>{resolve=accept;reject=decline;});
  entry={id:++sequence,key,input,promise,resolve,reject,refs:0,value:null,producer:null,bytes:0,touched:performance.now()};resources.set(key,entry);queue.push({kind:'resource',entry,sequence:entry.id});
 }
 const owned=entry;owned.refs++;let released=false;dispatch();
 return{key,result:owned.promise,release(){if(released)return;released=true;owned.refs--;owned.touched=performance.now();if(owned.refs===0&&!owned.value){const index=queue.findIndex(job=>job.kind==='resource'&&job.entry===owned);if(index>=0){queue.splice(index,1);remove(owned);owned.reject(aborted());}else if(active?.kind==='resource'&&active.entry===owned)fallback?.abort();}evict();}};
}
/** Send a private copy from the existing producer directly to the renderer port.
 * At most32 owners and96MiB accounted storage; two copies are reserved until
 * delivery acknowledgement, then one until release. Failure never recomputes a
 * lost canonical result or detaches the displayed main lease. Port is consumed. */
export async function acquirePrivatePaperPackGeometry(input:StickerPackGeometryInput,port:MessagePort,signal:AbortSignal):Promise<{readonly resourceId:number;release():void}>{
 let main:PaperPackLease|null=null,reserved=0,released=false,admitted=false;
 const release=()=>{if(released)return;released=true;privateBytes-=reserved;if(admitted)privateOwners--;main?.release();};
 try{
  signal.throwIfAborted();
  if(privateOwners>=MAX_JOBS)throw Error('Private paper capacity exceeded');
  privateOwners++;admitted=true;
  const lease=acquirePaperPackGeometry(input);main=lease;void lease.result.catch(()=>{});
  const value=await new Promise<StickerPackGeometryData>((resolve,reject)=>{const abort=()=>{lease.release();reject(aborted());};signal.addEventListener('abort',abort,{once:true});void lease.result.then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});});
  signal.throwIfAborted();const entry=resources.get(lease.key);if(!entry?.producer||entry.producer!==worker)throw Error('Canonical paper producer unavailable');
  reserved=stickerPackGeometryBuffers(value).reduce((sum,buffer)=>sum+buffer.byteLength,0)*2;
  if(cost()+reserved>MAX_BYTES){reserved=0;throw Error('Private paper capacity exceeded');}
  privateBytes+=reserved;const resourceId=++sequence;
  await new Promise<void>((resolve,reject)=>{
   const abort=()=>{const index=queue.findIndex(job=>job.kind==='copy'&&job.sequence===resourceId);if(index>=0){queue.splice(index,1);port.close();finish(aborted());}else if(active?.kind==='copy'&&active.sequence===resourceId)fail();};
   const finish=(error?:Error)=>{signal.removeEventListener('abort',abort);if(error)reject(error);else resolve();};
   signal.addEventListener('abort',abort,{once:true});queue.push({kind:'copy',entry,port,sequence:resourceId,resolve:()=>finish(),reject:error=>finish(error)});dispatch();
  });signal.throwIfAborted();privateBytes-=reserved/2;reserved/=2;return{resourceId,release};
 }catch(error){port.close();release();throw error;}
}
/** Explicit idle session cleanup; never removes another live caller's lease. */
export function releaseUnusedPaperPackGeometry(){evict(true);}
export function inspectPaperPool(){return{clients:clients.size,entries:resources.size,queued:queue.length,active:active?.kind??null,worker:worker!==null,privateOwners,privateBytes,accountedBytes:cost()};}
