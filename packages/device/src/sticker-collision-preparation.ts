import { reserveStickerCollisionBytes, type StickerCollisionReservation } from './sticker-collision-budget';
import { BufferAttribute } from 'three';
import { prepareCollisionCooperatively } from './sticker-collision-cooperative';
import { drainSteps,yieldSteps } from './sticker-computation-steps';
import type { StickerCollisionFace, StickerCollisionSnapshot } from './sticker-collision';

export interface CollisionWorkerFace {
 readonly positions:Float32Array|Float64Array;readonly indices:Uint32Array|null;
 readonly transform:number[];readonly source:string;readonly kind:'surface'|'bridge';readonly adhesiveSupport:boolean;
}
/** Copies only collision inputs. Rendering storage never leaves its owner.
 * Plain Float32 vertices retain native storage; nonplain attributes use exact
 * getters in bounded batches rather than converting the whole scene on input. */
export function* collisionWorkerFacesSteps(faces:readonly StickerCollisionFace[]):Generator<void,CollisionWorkerFace[],void> {
 const result:CollisionWorkerFace[]=[];
 for(const face of faces){
  const attribute=face.geometry.getAttribute('position'),index=face.geometry.index;
  let positions:Float32Array|Float64Array;
  if(attribute instanceof BufferAttribute&&!attribute.normalized&&attribute.itemSize===3&&attribute.array instanceof Float32Array)positions=attribute.array.slice();
  else {positions=new Float64Array(attribute.count*3);for(let i=0;i<attribute.count;i++){positions[i*3]=attribute.getX(i);positions[i*3+1]=attribute.getY(i);positions[i*3+2]=attribute.getZ(i);if(i%128===0)yield;}}
  result.push({positions,indices:index?Uint32Array.from(index.array):null,transform:face.transform?.toArray()??[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],source:face.source,kind:face.kind,adhesiveSupport:face.adhesiveSupport===true});
  yield;
 }
 return result;
}
export function collisionWorkerFaces(faces:readonly StickerCollisionFace[]):CollisionWorkerFace[]{return drainSteps(collisionWorkerFacesSteps(faces));}
interface Job {id:number;faces:readonly StickerCollisionFace[];signal:AbortSignal;reservation:StickerCollisionReservation;pendingWork:number;retired:boolean;resolve:(snapshot:StickerCollisionSnapshot)=>void;reject:(error:unknown)=>void;abort:()=>void;}
const queue:Job[]=[];let active:Job|null=null,worker:Worker|null=null,nextId=0;
let deadline:ReturnType<typeof setTimeout>|undefined;
const cancelled=()=>new DOMException('Cancelled','AbortError');
function stopWorker(){clearTimeout(deadline);deadline=undefined;worker?.terminate();worker=null;}
function releaseRetired(job:Job){if(job.retired&&job.pendingWork===0)job.reservation.release();}
function finish(job:Job,error:unknown,snapshot?:StickerCollisionSnapshot){
 if(active!==job)return;stopWorker();active=null;job.signal.removeEventListener('abort',job.abort);job.retired=true;releaseRetired(job);
 if(snapshot)job.resolve(snapshot);else job.reject(error);pump();
}
function recover(job:Job){
 if(active!==job)return;stopWorker();
 // Recovery retains the global producer slot. Overloaded owners cannot each
 // start an independent main-thread fallback or silently retry a worker.
 job.pendingWork++;
 void prepareCollisionCooperatively(job.faces,job.signal).then(snapshot=>finish(job,null,snapshot),error=>finish(job,error)).finally(()=>{job.pendingWork--;releaseRetired(job);});
}
function pump(){
 if(active)return;const job=queue.shift();if(!job)return;active=job;
 job.pendingWork++;
 void yieldSteps(collisionWorkerFacesSteps(job.faces),job.signal).then(input=>{
  if(active!==job||job.signal.aborted)return;
  try {
   worker=new Worker(new URL('./sticker-collision-worker.ts',import.meta.url),{type:'module'});const instance=worker;
   worker.onmessage=({data}:MessageEvent<{id:number;snapshot?:StickerCollisionSnapshot;error?:string}>)=>{
    if(active!==job||worker!==instance||data.id!==job.id)return;
    if(data.snapshot)finish(job,null,data.snapshot);else recover(job);
   };
   const failed=()=>{if(active===job&&worker===instance)recover(job);};worker.onerror=failed;worker.onmessageerror=failed;
   // Queue/copy wait cannot consume the worker's execution deadline.
   deadline=setTimeout(failed,15_000);
   const buffers=input.flatMap(face=>face.indices?[face.positions.buffer,face.indices.buffer]:[face.positions.buffer]);
   worker.postMessage({id:job.id,faces:input},buffers);
  }catch{recover(job);}
 },error=>finish(job,error)).finally(()=>{job.pendingWork--;releaseRetired(job);});
}
/** Session-wide one producer plus at most three waiting owners and 128 MiB of
 * estimated private input plus packed output storage. Admission overflow rejects explicitly; only admitted
 * execution errors recover cooperatively. Abort retires generation and producer;
 * late callbacks cannot publish into its replacement. No borrowed buffers detach. */
export function prepareCollisionInWorker(faces:readonly StickerCollisionFace[],signal:AbortSignal):Promise<StickerCollisionSnapshot>{
 return new Promise((resolve,reject)=>{
  const bytes=faces.reduce((sum,face)=>{const count=face.geometry.getAttribute('position').count,indexCount=face.geometry.index?.count;return sum+count*24+(indexCount??0)*4+Math.ceil((indexCount??count)/3)*112;},0);
  if(signal.aborted){reject(cancelled());return;}
  if(queue.length>=3){reject(new Error('Collision preparation capacity exceeded'));return;}
  const reservation=reserveStickerCollisionBytes(bytes);
  const job:Job={id:++nextId,faces,signal,reservation,pendingWork:0,retired:false,resolve,reject,abort:()=>{
   if(active===job)finish(job,cancelled());else{const index=queue.indexOf(job);if(index>=0)queue.splice(index,1);signal.removeEventListener('abort',job.abort);job.retired=true;releaseRetired(job);reject(cancelled());}
  }};
  signal.addEventListener('abort',job.abort,{once:true});queue.push(job);pump();
 });
}
