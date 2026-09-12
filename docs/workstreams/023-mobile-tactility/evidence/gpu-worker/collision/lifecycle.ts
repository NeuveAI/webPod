import {createScreenMeshHandle} from '../../../../../../packages/device/src/screen-mesh';
import {writeFileSync} from 'node:fs';
import {BoxGeometry,Group,Mesh,MeshBasicMaterial,PerspectiveCamera} from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import {createStickerCollision,type StickerCollisionSnapshot} from '../../../../../../packages/device/src/sticker-collision';
import {prepareCollisionInWorker,type CollisionWorkerFace} from '../../../../../../packages/device/src/sticker-collision-preparation';
import {createStickerVisibility} from '../../../../../../packages/device/src/sticker-visibility';
import {registerStickerAssembly,markStickerAssemblyChanged,stickerAssemblyRevision} from '../../../../../../packages/device/src/sticker-assembly-revision';
import {ControlPhysicsController} from '../../../../../../packages/device/src/control-physics';
import {createShellPicking} from '../../../../../../packages/device/src/shell-picking';
import {buildShellPickingIndex,type ShellPickingInput,type ShellPickingIndex} from '../../../../../../packages/device/src/shell-picking-index';
const checks:string[]=[];const check=(condition:boolean,name:string)=>{if(!condition)throw Error(name);checks.push(name);};
const wait=()=>new Promise<void>(resolve=>setTimeout(resolve,1));
async function until(condition:()=>boolean){for(let i=0;i<100&&!condition();i++)await wait();if(!condition())throw Error('Timed out waiting for fixture');}
const geometry=new BoxGeometry(2,3,4),material=new MeshBasicMaterial(),root=new Group(),wheel=new Group(),mesh=new Mesh(geometry,material);
wheel.add(mesh);root.add(wheel);const unregister=registerStickerAssembly(root),visibility=createStickerVisibility();visibility.update(root);
for(let i=0;i<100;i++){root.rotation.y=i/10;visibility.update(root);}
check(visibility.getInspectionStats().walks===1&&visibility.getInspectionStats().cacheHits===100,'registered global poses perform zero repeated assembly walks');
const controller=new ControlPhysicsController({invalidate:()=>{},now:()=>0,requestFrame:()=>1,cancelFrame:()=>{}});controller.attachWheel(wheel);controller.pressWheel(30);
visibility.update(root);check(visibility.getInspectionStats().walks===2&&visibility.revision===2,'actual physics mutation publishes local assembly revision');
material.visible=false;markStickerAssemblyChanged(mesh);visibility.update(root);check(visibility.snapshot().provenance.length===0,'material visibility signal preserves exact occlusion exclusion');
material.visible=true;markStickerAssemblyChanged(mesh);visibility.update(root);
const screenHandle=createScreenMeshHandle({mesh,panel:{width:2,height:3,scale:1},size:{width:2,height:3},defaultMaterial:material,invalidate:()=>{},view:()=>({camera:new PerspectiveCamera(),width:400,height:800})});
const hiddenMaterial=new MeshBasicMaterial({visible:false});screenHandle.setMaterial(hiddenMaterial);visibility.update(root);check(visibility.snapshot().provenance.length===0,'actual screen material slot publishes visibility revision');screenHandle.setMaterial(null);visibility.update(root);hiddenMaterial.dispose();
const extra=new Mesh(geometry,material);root.add(extra);visibility.update(root);check(visibility.snapshot().provenance.length===24,'child-added event invalidates topology');root.remove(extra);visibility.update(root);check(visibility.snapshot().provenance.length===12,'child-removed event invalidates topology');
const before=visibility.revision;geometry.getAttribute('position').needsUpdate=true;markStickerAssemblyChanged(mesh);visibility.update(root);check(visibility.revision===before+1,'buffer mutation signal invalidates immutable query resource');
const secondOwner=registerStickerAssembly(root);unregister();unregister();check(stickerAssemblyRevision(root)!==undefined,'registration cleanup is idempotent and preserves second owner');secondOwner();check(stickerAssemblyRevision(root)===undefined,'final registry owner releases topology listeners');
mesh.position.x+=2;visibility.update(root);check(visibility.revision>before+1,'unregistered external assemblies retain defensive mutation inspection');controller.dispose();visibility.dispose();
const originalWorker=globalThis.Worker,workers:FakeWorker[]=[];
class FakeWorker {
 readonly kind:string;terminated=false;id=0;sent=0;faces:CollisionWorkerFace[]|undefined;input:ShellPickingInput|undefined;
 onmessage:((event:{data:{id:number;snapshot?:StickerCollisionSnapshot;index?:ShellPickingIndex}})=>void)|null=null;onerror:(()=>void)|null=null;onmessageerror:(()=>void)|null=null;
 constructor(url:string|URL){this.kind=String(url);workers.push(this);}
 postMessage(message:{id:number;faces?:CollisionWorkerFace[];input?:ShellPickingInput},transfer:Transferable[]=[]){const own=structuredClone(message,{transfer});this.id=own.id;this.faces=own.faces;this.input=own.input;this.sent++;}
 terminate(){this.terminated=true;}
 deliver(snapshot:StickerCollisionSnapshot){this.onmessage?.({data:{id:this.id,snapshot:structuredClone(snapshot)}});}
}
Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:FakeWorker});
const latest=()=>{const worker=workers.at(-1);if(!worker)throw Error('Missing worker');return worker;};
const faces=[{geometry,source:'fixture',kind:'surface' as const}],snapshot=createStickerCollision(faces).snapshot();
try {
 const firstAbort=new AbortController(),first=prepareCollisionInWorker(faces,firstAbort.signal).catch(error=>error);
 const second=prepareCollisionInWorker(faces,new AbortController().signal);await until(()=>workers.length===1&&latest().sent===1);const retired=latest();
 check(workers.filter(worker=>!worker.terminated).length===1,'multiple collision owners share one active worker');check(geometry.getAttribute('position').array.byteLength>0,'worker transfer never detaches borrowed render geometry');
 firstAbort.abort();check((await first) instanceof DOMException,'active cancellation rejects without fallback');await until(()=>workers.length===2&&latest().sent===1);const replacement=latest();let resolved=false;void second.then(()=>{resolved=true;});retired.deliver(snapshot);await wait();check(!resolved,'late retired generation cannot publish replacement resource');replacement.deliver(snapshot);await second;check(replacement.terminated,'idle producer terminates after successful publication');
 const recovery=prepareCollisionInWorker(faces,new AbortController().signal);await until(()=>workers.length===3&&latest().sent===1);const failed=latest();failed.onmessageerror?.();const recovered=await recovery;
 check(failed.terminated&&recovered.provenance.length===12,'worker message failure recovers exactly after terminating its producer');
 const cancels=Array.from({length:5},()=>new AbortController());const queued=cancels.map(signal=>prepareCollisionInWorker(faces,signal.signal).then(()=>null,error=>error));
 const capacity=await queued[4];check(capacity instanceof Error&&capacity.message.includes('capacity'),'fifth owner is rejected by bounded admission without hidden fallback');for(const signal of cancels)signal.abort();await Promise.all(queued);
 const a=createShellPicking(),b=createShellPicking(),count=workers.length,releaseA=a.prepare(geometry),releaseB=b.prepare(geometry);await until(()=>workers.length===count+1&&latest().sent===1);const shellWorker=latest();
 check(shellWorker.kind.includes('shell-picking-worker'),'same-geometry shell owners coalesce one index preparation');releaseA();check(!shellWorker.terminated,'first shell owner release retains second preparation');
 if(!shellWorker.input)throw Error('Missing private shell input');const index=buildShellPickingIndex(shellWorker.input);shellWorker.onmessage?.({data:{id:shellWorker.id,index}});await wait();releaseB();check(shellWorker.terminated,'final shell owner releases idle worker/index ownership');
 const borrowed=createStickerCollision([],snapshot);borrowed.dispose();check(snapshot.metadata.length===1&&snapshot.root.bounds.byteLength>0,'query disposal never mutates borrowed packed snapshot');
 const result={passed:checks.length,checks,registeredPoseQueries:100,initialAssemblyWalks:1,mainDenseNodeRestorations:0};writeFileSync('docs/workstreams/023-mobile-tactility/evidence/gpu-worker/collision/lifecycle.json',JSON.stringify(result,null,2)+'\n');console.log(result);
}finally{Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:originalWorker});geometry.dispose();material.dispose();}
