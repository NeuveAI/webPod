import { createPaperWorker } from '../../../../../packages/device/src/sticker-paper-pool';
import type { PaperWorkerResponse, PaperPreparationInput } from '../../../../../packages/device/src/sticker-paper-transfer';
interface Input { id: number; input: PaperPreparationInput }
const assert=(value:unknown,message:string)=>{if(!value)throw Error(message);};
const documentMock=Object.assign(new EventTarget(),{hidden:false});Object.defineProperty(globalThis,'document',{value:documentMock,configurable:true});
const native=globalThis.Worker;
class MockWorker { static instances:MockWorker[]=[]; onmessage:((event:MessageEvent<PaperWorkerResponse>)=>void)|null=null;onerror:(()=>void)|null=null;onmessageerror:(()=>void)|null=null; messages:Input[]=[];ended=false;constructor(){MockWorker.instances.push(this);}postMessage(input:Input){this.messages.push(input);}terminate(){this.ended=true;} }
Object.defineProperty(globalThis,'Worker',{value:MockWorker,configurable:true});
const input={width:300,height:500,pixel:1,liner:false,curl:1},clients=Array.from({length:32},createPaperWorker), received:number[]=[];
clients.forEach((client,i)=>{client.onmessage=()=>received.push(i);client.postMessage({id:i,input});});
assert(MockWorker.instances.length===1,'pool created multiple workers');assert(MockWorker.instances[0]?.messages.length===1,'pool concurrent jobs');
let capacity=false;try{createPaperWorker();}catch{capacity=true;}assert(capacity,'pool unbounded owners');
const worker=MockWorker.instances[0];if(!worker)throw Error('missing worker');
for(let i=0;i<32;i++){const job=worker.messages[i];if(!job)throw Error('missing dispatch');worker.onmessage?.(new MessageEvent('message',{data:{id:job.id}}));}
assert(received.every((value,i)=>value===i)&&received.length===32,'FIFO violated');clients.forEach(client=>client.terminate());assert(worker.ended,'idle worker retained');
const active=createPaperWorker(),next=createPaperWorker();active.postMessage({id:1,input});next.postMessage({id:2,input});const old=MockWorker.instances.at(-1);active.terminate();const replacement=MockWorker.instances.at(-1);assert(old!==replacement&&old?.ended,'active cancellation did not free queue');old?.onerror?.();assert(!replacement?.ended,'old error killed replacement');next.terminate();assert(replacement?.ended,'final worker retained');
Object.defineProperty(globalThis,'Worker',{value:native,configurable:true});const result={sharedWorkerMaximum:1,ownerBound:32,queuedPerOwner:1,FIFOAcross32Owners:true,capacityOverflowRejected:true,activeCancellationContinuesNext:true,staleErrorIgnored:true,lastOwnerTerminates:true};await Bun.write(new URL('./paper-pool.json',import.meta.url),JSON.stringify(result,null,2));console.log(result);
