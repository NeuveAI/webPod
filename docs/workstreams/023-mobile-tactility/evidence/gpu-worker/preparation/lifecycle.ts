import {mock} from 'bun:test';
import {writeFileSync} from 'node:fs';
import {prepareDeviceSteps,preparedDeviceBuffers,type PreparedDeviceData} from '../../../../../../packages/device/src/device-preparation-data';
import {drainSteps} from '../../../../../../packages/device/src/sticker-computation-steps';
import {DEFAULT_DEVICE_FORM} from '../../../../../../packages/device/src/form';
const cleanups:(()=>void)[]=[],workers:FakeWorker[]=[];
mock.module('react',()=>({useLayoutEffect:(effect:()=>()=>void)=>{cleanups.push(effect());}}));
const originalWorker=globalThis.Worker;
class FakeWorker {
 onmessage:((event:{data:{id:number;result:PreparedDeviceData}})=>void)|null=null;
 onerror:(()=>void)|null=null;onmessageerror:(()=>void)|null=null;
 terminated=false;sent=0;id=0;
 constructor(){workers.push(this);}
 postMessage(data:{id:number}){this.sent++;this.id=data.id;}
 terminate(){this.terminated=true;}
 deliver(data:PreparedDeviceData){const own=structuredClone(data);this.onmessage?.({data:{id:this.id,result:structuredClone(own,{transfer:preparedDeviceBuffers(own)})}});}
}
Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:FakeWorker});
const {usePreparedImmutableShells:read}=await import('../../../../../../packages/device/src/immutable-shell-preparation');
const check=(value:boolean,label:string)=>{if(!value)throw Error(label);checks.push(label);},checks:string[]=[];
const wait=()=>new Promise<void>(resolve=>setTimeout(resolve,10));
const pending=(form=DEFAULT_DEVICE_FORM):Promise<void>=>{try{read(form);}catch(error){if(error instanceof Promise)return error;throw error;}throw Error('Expected suspension');};
const newest=()=>{const worker=workers.at(-1);if(!worker)throw Error('Missing worker');return worker;};
try {
 const data=drainSteps(prepareDeviceSteps(DEFAULT_DEVICE_FORM));
 const first=pending(),same=pending();check(first===same,'same-form suspended renders share one promise');check(workers.length===1&&newest().sent===1,'one producer for duplicate cold requests');
 const retired=newest();retired.deliver(data);await first;
 const a=read(DEFAULT_DEVICE_FORM),b=read(DEFAULT_DEVICE_FORM);check(a===b,'two devices share the entire immutable assembly');
 let disposed=0;a.front.addEventListener('dispose',()=>disposed++);
 const unmountA=cleanups.shift(),unmountB=cleanups.shift();if(!unmountA||!unmountB)throw Error('Missing owners');
 unmountA();await wait();check(disposed===0,'first device unmount does not dispose second device buffers');
 unmountB();const strict=read(DEFAULT_DEVICE_FORM);check(strict===a,'StrictMode cleanup/reacquire preserves prepared identity');
 await wait();check(disposed===0,'StrictMode reacquisition cancels pending disposal');
 const unmountStrict=cleanups.shift();if(!unmountStrict)throw Error('Missing strict owner');unmountStrict();await wait();check(disposed===1,'last owner disposes assembly once');
 const replacement=pending();const current=newest();retired.deliver(data);let settled=false;void replacement.then(()=>{settled=true;});await wait();check(!settled,'late retired worker cannot publish into replacement entry');
 current.onmessageerror?.();await replacement;check(current.terminated,'worker failure terminates producer before cooperative recovery');
 const recovered=read(DEFAULT_DEVICE_FORM);check(recovered.front.getAttribute('position').count===a.front.getAttribute('position').count,'exact recovery remains usable');
 const cleanup=cleanups.shift();if(!cleanup)throw Error('Missing recovery owner');cleanup();await wait();
 const forms=Array.from({length:5},(_,index)=>({...DEFAULT_DEVICE_FORM,bodyCrown:DEFAULT_DEVICE_FORM.bodyCrown+index*.01}));
 const promises=forms.map(form=>pending(form));check(workers.filter(worker=>!worker.terminated).length===1,'multiple forms keep one global active producer');check(promises[4]===promises[0],'fifth cold form waits behind bounded four-entry admission');
 // The queued jobs are deliberately completed, then briefly acquired/released so this probe leaves no timers/cache owners.
 for(let index=0;index<4;index++){newest().deliver(data);await promises[index];const form=forms[index];if(!form)throw Error('Missing form');read(form);const release=cleanups.shift();if(!release)throw Error('Missing queue owner');release();}
 await wait();
 writeFileSync('docs/workstreams/023-mobile-tactility/evidence/gpu-worker/preparation/lifecycle.json',JSON.stringify({checks,passed:checks.length,method:'Actual preparation hook/cache with deterministic React commit callbacks and Worker transport; real cooperative fallback and disposal timers'},null,2)+'\n');console.log({passed:checks.length,checks});
}finally{Object.defineProperty(globalThis,'Worker',{configurable:true,writable:true,value:originalWorker});}
