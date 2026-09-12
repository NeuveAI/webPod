import assert from 'node:assert/strict';
import {createPaperWorker,inspectPaperPool,releaseUnusedPaperPackGeometry,acquirePaperPackGeometry} from '../../../../../../packages/device/src/sticker-paper-pool';
const wait=()=>new Promise<void>(resolve=>setTimeout(resolve,5));
async function idle(){for(let i=0;i<1000;i++){if(inspectPaperPool().active===null)return;await wait();}throw Error('deadline');}
const client=createPaperWorker();client.postMessage({id:1,input:{width:300,height:420,pixel:1,liner:true,curl:.4}});client.terminate();
const pending=inspectPaperPool();await idle();const dynamic=inspectPaperPool();releaseUnusedPaperPackGeometry();
const resource=acquirePaperPackGeometry({kind:'gpu-paper',width:300,height:420,pixel:1,liner:true});const rejected=assert.rejects(resource.result);resource.release();await rejected;await idle();const immutable=inspectPaperPool();releaseUnusedPaperPackGeometry();
const result={method:'Actual Bun module worker, last owner cancels during work; no manual idle cleanup until after each observed result. No browser/timing claim.',pending,dynamic,immutable};
await Bun.write(new URL('./reviewer-cancel.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);
