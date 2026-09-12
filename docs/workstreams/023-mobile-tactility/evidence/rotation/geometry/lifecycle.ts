import {mock} from 'bun:test';
import type {DeviceFormParams} from '../../../../../../packages/device/src/form';
import type {ShellPairTransfer} from '../../../../../../packages/device/src/immutable-shell-transfer';
const effects:(()=>void)[]=[];
mock.module('react',()=>({useLayoutEffect:(effect:()=>()=>void)=>{effects.push(effect())}}));
class WorkerMock {
 static instances:WorkerMock[]=[]; onmessage:((e:MessageEvent<{result?:ShellPairTransfer}>)=>void)|null=null;onerror:(()=>void)|null=null;onmessageerror:(()=>void)|null=null;forms:DeviceFormParams[]=[];terminated=false;
 constructor(){WorkerMock.instances.push(this)}postMessage(form:DeviceFormParams){this.forms.push(form)}terminate(){this.terminated=true}
}
Object.assign(globalThis,{Worker:WorkerMock});
const {usePreparedImmutableShells}=await import('../../../../../../packages/device/src/immutable-shell-preparation');
const {createImmutableShells}=await import('../../../../../../packages/device/src/immutable-shells');
const {transferShell}=await import('../../../../../../packages/device/src/immutable-shell-transfer');
const {DEFAULT_DEVICE_FORM:form}=await import('../../../../../../packages/device/src/form');
function suspended(f:DeviceFormParams){try{usePreparedImmutableShells(f);throw Error('did not suspend')}catch(value){if(!(value instanceof Promise))throw value;return value}}
const first=suspended(form),same=suspended({...form});if(first!==same||WorkerMock.instances.length!==1)throw Error('not shared');
const worker=WorkerMock.instances[0];if(!worker)throw Error('missing worker');
const built=createImmutableShells(form);worker.onmessage?.({data:{result:{front:transferShell(built.front),back:transferShell(built.back)}}} as MessageEvent<{result:ShellPairTransfer}>);await first;
const a=usePreparedImmutableShells(form),b=usePreparedImmutableShells({...form});if(a!==b||!worker.terminated)throw Error('pair sharing or idle worker');
let disposed=0;a.front.addEventListener('dispose',()=>disposed++);a.back.addEventListener('dispose',()=>disposed++);
effects.shift()?.();await new Promise(r=>setTimeout(r,2));if(disposed)throw Error('first owner disposed shared pair');effects.shift()?.();await new Promise(r=>setTimeout(r,2));if(disposed!==2)throw Error('lastowner not disposed');
const retry=suspended(form),next=WorkerMock.instances.at(-1);if(!next||next===worker)throw Error('disposed cache reused');worker.onerror?.();if(next.terminated)throw Error('stale error killed replacement');next.onmessage?.({data:{result:{front:transferShell(built.front),back:transferShell(built.back)}}} as MessageEvent<{result:ShellPairTransfer}>);await retry;usePreparedImmutableShells(form);effects.shift()?.();await new Promise(r=>setTimeout(r,2));
Object.assign(globalThis,{Worker:class{constructor(){throw Error('unsupported')}}});const fallback=suspended({...form,bodyCrown:form.bodyCrown+.01});await fallback;const recovered=usePreparedImmutableShells({...form,bodyCrown:form.bodyCrown+.01});if(recovered.front.index!==null)throw Error('fallback added indexing CPU');effects.shift()?.();await new Promise(r=>setTimeout(r,2));
const {bindStickerWrapSurface,stickerWrapSurface,createStickerWrapSurface}=await import('../../../../../../packages/device/src/sticker-wrap');
const one=createStickerWrapSurface(form,[]),two=createStickerWrapSurface({...form,bodyCrown:form.bodyCrown+.1},[]);
const offOne=bindStickerWrapSurface(built.back,one),offTwo=bindStickerWrapSurface(built.back,two);offTwo();if(stickerWrapSurface(built.back)!==one)throw Error('shared binding lost');offOne();if(stickerWrapSurface(built.back)!==undefined)throw Error('binding leaked');
built.front.dispose();built.back.dispose();console.log(JSON.stringify({suspenseBeforePublication:true,sameFormShared:true,oneWorker:true,idleWorkerTerminated:true,lastOwnerDisposes:true,disposedEntryRebuilt:true,staleWorkerErrorIgnored:true,workerUnavailableOriginalCpuRecovery:true,sharedWrapBindingRestored:true}));
