import type { ShellPickingIndex } from '../../../../../packages/device/src/shell-picking-index';
import { prepareShellPickingIndex } from '../../../../../packages/device/src/shell-picking-preparation';
const workers: FakeWorker[]=[];
class FakeWorker {
 onmessage: ((event: { data: { index?: ShellPickingIndex; error?: string } })=>void)|null=null; onerror: (()=>void)|null=null; onmessageerror: (()=>void)|null=null; terminated=false; posts=0;
 constructor(){workers.push(this)} postMessage(){this.posts++} terminate(){this.terminated=true}
}
Object.assign(globalThis,{Worker:FakeWorker});
const input=()=>({positions:new Float32Array(9),indices:null});
const index={root:{bounds:[0,0,0,1,1,1],start:0,count:3},indices:new Uint32Array([0,1,2]),faces:new Uint32Array([0])};
const a=new AbortController(),b=new AbortController();
const pa=prepareShellPickingIndex(input(),a.signal).then(()=>false,()=>true);
const pb=prepareShellPickingIndex(input(),b.signal);
const old=workers[0];
if(workers.length!==1||!old||old.posts!==1)throw Error('not serialized');
a.abort();
if(!old.terminated||workers.length!==2)throw Error('cancel active');
old.onmessage?.({data:{index}});old.onerror?.();
const current=workers[1];if(!current)throw Error('missing replacement');
if(current.terminated)throw Error('stale callback affected new worker');
current.onmessage?.({data:{index}});
if(!(await pa)||(await pb)!==index||!current.terminated)throw Error('settlement or idle cleanup');
const controllers=Array.from({length:6},()=>new AbortController());
const jobs=controllers.map(c=>prepareShellPickingIndex(input(),c.signal).then(()=>false,()=>true));
controllers.forEach(c=>c.abort());
if(!(await Promise.all(jobs)).every(Boolean))throw Error('abort/overflow');
console.log(JSON.stringify({serialized:true,activeCancellation:true,staleCallbacksIgnored:true,idleTermination:true,queueOverflowExactFallback:true,queuedCancellation:true}));
