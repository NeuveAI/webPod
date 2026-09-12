import type { RenderMatrix } from './device-render-protocol';
import type { StickerCollisionSnapshot } from './sticker-collision';
import { reserveStickerCollisionBytes, type StickerCollisionReservation } from './sticker-collision-budget';
import { yieldSteps } from './sticker-computation-steps';
import { acquirePrivateStickerTransaction } from './sticker-transaction-broker';
import type { PreparedStickerContour, PreparedStickerContourDescriptor } from './sticker-contour-preparation-data';
import type { StickerContourLineage, StickerContourPoseStamp, StickerContourProjection, StickerContourQueryRequest, StickerContourQueryResponse } from './sticker-contour-query-data';

type Result = Extract<StickerContourQueryResponse, {type:'result'}>;
export interface StickerContourDemand {
  readonly lineage: StickerContourLineage; readonly pose: StickerContourPoseStamp; readonly visibilityRevision: number;
  readonly projection: StickerContourProjection; readonly contentWorld: RenderMatrix; readonly cameraWorld: RenderMatrix;
  readonly collider: {readonly snapshot: StickerCollisionSnapshot; readonly revision: number};
  /** Caller selects one actually adopted, validated geometry/contour revision.
   * Identity is the geometry owner, never the requested placement object. */
  readonly print: {readonly identity: object; readonly revision: number; readonly descriptor: PreparedStickerContourDescriptor;
    readonly contour: PreparedStickerContour; readonly quad: Float64Array};
}
export interface StickerContourQueryState { readonly result: Result | null; readonly error: string | null; readonly pending: boolean }
interface Captured { readonly value: StickerContourDemand; readonly at: number; readonly key: string }
interface Unit {
  readonly kind:'collider'|'print'; readonly id:number; readonly revision:number; readonly generation:number;
  readonly reservation:StickerCollisionReservation; refs:number; installed:boolean; sent:boolean; released:boolean;
  lease:Awaited<ReturnType<typeof acquirePrivateStickerTransaction>>|null; readonly snapshot?:StickerCollisionSnapshot;
}
interface Pair { readonly collider:Unit; readonly print:Unit; captured:Captured|null; readonly resourceKey:string; readonly controller:AbortController; setupDone:boolean; cancelled:boolean }
const now=()=>performance.timeOrigin+performance.now();
let nextGeneration=0;
const bytes=(s:StickerCollisionSnapshot)=>s.coordinates.byteLength+s.provenance.byteLength+s.root.bounds.byteLength+s.root.links.byteLength+s.root.triangles.byteLength
  +s.metadata.reduce((sum,item)=>sum+128+item.source.length*2+item.kind.length*2,0);
/** Structural peak estimate covers split paths, point objects, temporary projection
 * lists and current/worker/incoming cloned results. Not an engine heap-size claim. */
export function stickerContourOutputAllowance(contour:PreparedStickerContour):number {
  const points=contour.paths.reduce((sum,path)=>sum+Math.max(path.points.length,path.visiblePoints.length)/3,0);
  const paths=contour.paths.length+points; // at most one split per sample, deliberately conservative
  const size=(points+9)*256*4+(paths+1)*128*4+216;
  if(!Number.isSafeInteger(size)||size<0)throw Error('Invalid contour output capacity');return size;
}
function* copy64(source:Float64Array):Generator<void,Float64Array,void>{const out=new Float64Array(source.length);for(let i=0;i<source.length;i+=2048){out.set(source.subarray(i,i+2048),i);yield;}return out;}
function* copy32(source:Uint32Array):Generator<void,Uint32Array,void>{const out=new Uint32Array(source.length);for(let i=0;i<source.length;i+=2048){out.set(source.subarray(i,i+2048),i);yield;}return out;}
function* copySnapshot(s:StickerCollisionSnapshot):Generator<void,StickerCollisionSnapshot,void>{
 const coordinates=yield*copy64(s.coordinates),provenance=yield*copy32(s.provenance),bounds=yield*copy64(s.root.bounds),links=yield*copy32(s.root.links),triangles=yield*copy32(s.root.triangles);
 return {coordinates,provenance,root:{bounds,links,triangles},metadata:s.metadata.map(item=>({...item})),nodeCount:s.nodeCount};
}
const sameLineage=(a:StickerContourLineage,b:StickerContourLineage)=>a.session===b.session&&a.stickerId===b.stickerId&&a.source===b.source;
const hardCompatible=(a:StickerContourDemand,b:StickerContourDemand)=>sameLineage(a.lineage,b.lineage)&&a.pose.backend===b.pose.backend&&a.visibilityRevision===b.visibilityRevision
 &&a.pose.layoutRevision===b.pose.layoutRevision&&a.collider.snapshot===b.collider.snapshot&&a.collider.revision===b.collider.revision
 &&a.projection.canvas.left===b.projection.canvas.left&&a.projection.canvas.top===b.projection.canvas.top&&a.projection.canvas.width===b.projection.canvas.width&&a.projection.canvas.height===b.projection.canvas.height;

/** Dedicated exact-query consumer. One executing sample, one latest demand and
 * one result credit; no synchronous sweep fallback. clear() is a hard lifetime
 * barrier, not an effect cleanup for ordinary pose updates. */
export function createStickerContourQuery(options:{readonly onError?:(error:Error)=>void;
  readonly createWorker?:()=>Worker; readonly requestFrame?:(callback:FrameRequestCallback)=>number;
  readonly cancelFrame?:(id:number)=>void; readonly timeoutMs?:number}={}) {
 const requestFrame=options.requestFrame??(callback=>globalThis.requestAnimationFrame(callback));
 const cancelFrame=options.cancelFrame??(id=>globalThis.cancelAnimationFrame(id));
 const timeoutMs=options.timeoutMs??15000;
 let generation=0,worker:Worker|null=null,disposed=false,state:StickerContourQueryState={result:null,error:null,pending:false};
 let latest:Captured|null=null,lastDemand:StickerContourDemand|null=null,lastKey='',sequence=0,nextId=0;
 let current:Pair|null=null,candidate:Pair|null=null,active:{pair:Pair;stamp:Result['stamp']}|null=null;
 let pumpFrame:number|null=null,publishFrame:number|null=null,deadline:ReturnType<typeof setTimeout>|null=null;
 const units=new Map<number,Unit>(),pairs=new Set<Pair>(),releasing=new Set<number>(),listeners=new Set<()=>void>();
 const identities=new WeakMap<object,number>();let nextIdentity=0;
 const identity=(value:object)=>{let id=identities.get(value);if(id===undefined){id=++nextIdentity;identities.set(value,id);}return id;};
 const finalUnit=(unit:Unit)=>{if(unit.released)return;unit.released=true;unit.lease?.release();unit.lease=null;unit.reservation.release();units.delete(unit.id);releasing.delete(unit.id);};
 const send=(message:StickerContourQueryRequest,transfer:Transferable[]=[])=>{if(!worker)throw Error('Contour query worker unavailable');worker.postMessage(message,transfer);};
 const dropUnit=(unit:Unit)=>{
  if(unit.released||--unit.refs>0)return;
  if(worker&&unit.sent&&unit.generation===generation){releasing.add(unit.id);send({type:'release-resource',version:1,generation,kind:unit.kind,id:unit.id});arm();}
  else finalUnit(unit);
 };
 const dropPair=(pair:Pair)=>{if(!pairs.has(pair))return;pairs.delete(pair);dropUnit(pair.print);dropUnit(pair.collider);};
 const disarm=()=>{if(deadline!==null)clearTimeout(deadline);deadline=null;};
 const retire=()=>{
  disarm();if(pumpFrame!==null)cancelFrame(pumpFrame);if(publishFrame!==null)cancelFrame(publishFrame);pumpFrame=null;publishFrame=null;
  worker?.terminate();worker=null;generation=++nextGeneration;latest=null;active=null;current=null;candidate=null;lastKey='';lastDemand=null;
  for(const pair of [...pairs]){pair.cancelled=true;pair.controller.abort();if(pair.setupDone)dropPair(pair);}
  for(const unit of [...units.values()])if(![...pairs].some(pair=>pair.collider===unit||pair.print===unit))finalUnit(unit);
  releasing.clear();
 };
 const fail=(error:unknown)=>{if(disposed)return;const value=error instanceof Error?error:new Error(String(error));retire();state={result:null,error:value.message,pending:false};
  for(const listener of listeners){try{listener();}catch{/* Cleanup already completed; observer failure cannot strand credit. */}}
  try{options.onError?.(value);}catch{/* Error observer does not own query resources. */}
 };
 function arm(){disarm();deadline=setTimeout(()=>fail(new Error('Contour query acknowledgement timed out')),timeoutMs);}
 const notify=()=>{for(const listener of listeners){try{listener();}catch(error){fail(error);return false;}}return true;};
 const setPending=(pending:boolean)=>{if(state.pending!==pending){state={...state,pending};notify();}};
 const schedule=()=>{if(disposed||state.error||pumpFrame!==null)return;pumpFrame=requestFrame(()=>{pumpFrame=null;void pump();});};
 const printKey=(demand:StickerContourDemand)=>JSON.stringify([identity(demand.print.identity),demand.print.revision,demand.print.descriptor.key,[...demand.print.quad]]);
 const matches=(pair:Pair,demand:StickerContourDemand)=>pair.collider.snapshot===demand.collider.snapshot&&pair.collider.revision===demand.collider.revision&&pair.resourceKey===printKey(demand);
 function startWorker(){
  if(worker)return;generation=++nextGeneration;const instance=options.createWorker?.()??new Worker(new URL('./sticker-contour-query-worker.ts',import.meta.url),{type:'module'});worker=instance;
  const failed=()=>{if(worker===instance)fail(new Error('Contour query worker failed'));};instance.onerror=failed;instance.onmessageerror=failed;
  instance.onmessage=({data}:MessageEvent<StickerContourQueryResponse>)=>{
   if(worker!==instance)return;
   const received=data.type==='result'?data.stamp.generation:data.generation;
   if(data.version!==1||received!==generation)return;
   if(data.type==='failed'){fail(new Error(data.message));return;}
   if(data.type==='installed'){
    const unit=units.get(data.id);if(!unit||unit.kind!==data.kind||unit.revision!==data.revision){fail(new Error('Contour install acknowledgement mismatch'));return;}unit.installed=true;
    if(candidate?.setupDone&&candidate.collider.installed&&candidate.print.installed){disarm();schedule();}
   }else if(data.type==='released'){
    const unit=units.get(data.id);if(!unit||unit.kind!==data.kind||!releasing.has(data.id)){fail(new Error('Contour release acknowledgement mismatch'));return;}finalUnit(unit);
    if(releasing.size===0){disarm();schedule();}
   }else if(data.type==='result'){
    if(!active||data.stamp.sequence!==active.stamp.sequence||data.stamp.colliderId!==active.stamp.colliderId||data.stamp.printId!==active.stamp.printId
      ||JSON.stringify(data.stamp)!==JSON.stringify(active.stamp)){fail(new Error('Contour result stamp mismatch'));return;}
    disarm();const pair=active.pair;
    publishFrame=requestFrame(()=>{
     publishFrame=null;if(worker!==instance||!active)return;
     try {
     const previous=current;current=pair;if(candidate===pair)candidate=null;active=null;
     state={result:data,error:null,pending:latest!==null};
     if(!notify()||worker!==instance)return;
     send({type:'result-ack',version:1,generation,sequence:data.stamp.sequence});
     if(previous&&previous!==pair)dropPair(previous);
     if(releasing.size===0)schedule();
     }catch(error){fail(error);}
    });
   }
  };
 }
 async function prepare(captured:Captured){
  const demand=captured.value,controller=new AbortController();let collider:Unit|null=null,print:Unit|null=null,pair:Pair|null=null;
  try{
   if(current&&current.collider.snapshot===demand.collider.snapshot&&current.collider.revision===demand.collider.revision){collider=current.collider;collider.refs++;}
   else {collider={kind:'collider',id:++nextId,revision:demand.collider.revision,generation,reservation:reserveStickerCollisionBytes(bytes(demand.collider.snapshot)*2),refs:1,installed:false,sent:false,released:false,lease:null,snapshot:demand.collider.snapshot};units.set(collider.id,collider);}
   print={kind:'print',id:++nextId,revision:demand.print.revision,generation,reservation:reserveStickerCollisionBytes(stickerContourOutputAllowance(demand.print.contour)),refs:1,installed:false,sent:false,released:false,lease:null};units.set(print.id,print);
   pair={collider,print,captured,resourceKey:printKey(demand),controller,setupDone:false,cancelled:false};pairs.add(pair);candidate=pair;arm();
   if(!collider.installed){
    const copy=await yieldSteps(copySnapshot(demand.collider.snapshot),controller.signal);controller.signal.throwIfAborted();
    const arrays=[copy.coordinates,copy.provenance,copy.root.bounds,copy.root.links,copy.root.triangles];
    send({type:'install-collider',version:1,generation,id:collider.id,revision:collider.revision,snapshot:copy},arrays.map(array=>array.buffer));collider.sent=true;
   }
   const channel=new MessageChannel();
   try{
    const descriptor=demand.print.descriptor;
    print.lease=await acquirePrivateStickerTransaction(descriptor.key,descriptor.input,channel.port1,controller.signal);
    controller.signal.throwIfAborted();
    const quad=demand.print.quad.slice();
    send({type:'install-print',version:1,generation,id:print.id,revision:print.revision,resourceId:print.lease.resourceId,port:channel.port2,quad},[channel.port2,quad.buffer]);print.sent=true;
   }catch(error){channel.port1.close();channel.port2.close();throw error;}
   pair.setupDone=true;arm();if(collider.installed&&print.installed){disarm();schedule();}
  }catch(error){
   if(pair){pair.setupDone=true;if(pair.cancelled||disposed){dropPair(pair);return;}}
   else {if(print)dropUnit(print);if(collider)dropUnit(collider);}
   const capacity=error instanceof Error && /^(Collision preparation|Sticker computation byte|Sticker transaction(?: byte)?|Private sticker (?:owner|byte)) capacity exceeded$/.test(error.message);
   if(capacity&&current&&state.result){
    // Admission failure owns only the candidate. Keep the usable current query
    // and its leases until explicit retry/clear; never spin on the same demand.
    if(pair){candidate=null;dropPair(pair);}
    latest=null;disarm();state={...state,error:error.message,pending:false};notify();
    try{options.onError?.(error);}catch{/* Observer does not own retained resources. */}
    return;
   }
   fail(error);
  }
 }
 async function pump(){
  if(disposed||state.error||active||releasing.size)return;
  if(candidate){
   if(!candidate.setupDone||!candidate.collider.installed||!candidate.print.installed||!candidate.captured)return;
   try{dispatch(candidate,candidate.captured);}catch(error){fail(error);}return;
  }
  const wanted=latest;if(!wanted){setPending(false);return;}latest=null;
  try{startWorker();if(current&&matches(current,wanted.value))dispatch(current,wanted);else await prepare(wanted);}catch(error){fail(error);}
 }
 function dispatch(pair:Pair,captured:Captured){
  const demand=captured.value;
  const stamp:Result['stamp']={generation,sequence:++sequence,lineage:demand.lineage,colliderId:pair.collider.id,printId:pair.print.id,visibilityRevision:demand.visibilityRevision,pose:demand.pose,submittedAt:captured.at};
  active={pair,stamp};pair.captured=null;send({type:'query',version:1,stamp,projection:demand.projection,contentWorld:demand.contentWorld,cameraWorld:demand.cameraWorld});arm();
 }
 return {
  request(demand:StickerContourDemand){
   if(disposed)return;
   if(lastDemand&&!hardCompatible(lastDemand,demand)){retire();state={result:null,error:null,pending:false};notify();}
   if(state.error)return;
   const key=JSON.stringify([identity(demand.collider.snapshot),demand.collider.revision,identity(demand.print.identity),demand.print.revision,demand.print.descriptor.key,[...demand.print.quad],demand.lineage,demand.pose.layoutRevision,demand.visibilityRevision,demand.projection,demand.contentWorld,demand.cameraWorld]);
   if(key===lastKey){lastDemand=demand;if(latest?.key===key)latest={...latest,value:{...latest.value,pose:{...demand.pose}}};return;}lastKey=key;
   const value:StickerContourDemand={...demand,lineage:{...demand.lineage},pose:{...demand.pose},projection:{...demand.projection,world:[...demand.projection.world],cameraInverse:[...demand.projection.cameraInverse],cameraProjection:[...demand.projection.cameraProjection],canvas:{...demand.projection.canvas}},contentWorld:[...demand.contentWorld],cameraWorld:[...demand.cameraWorld],print:{...demand.print,quad:demand.print.quad.slice()}};
   lastDemand=value;latest={value,at:now(),key};setPending(true);schedule();
  },
  clear(){if(disposed)return;retire();state={result:null,error:null,pending:false};notify();},
  subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
  getSnapshot:()=>state,
  dispose(){if(disposed)return;disposed=true;retire();state={result:null,error:null,pending:false};listeners.clear();},
 };
}
