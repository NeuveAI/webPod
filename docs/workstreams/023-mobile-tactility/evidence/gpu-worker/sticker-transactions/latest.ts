import assert from 'node:assert/strict';
import { createLatestStickerPreparation } from '../../../../../../packages/device/src/sticker-latest-preparation';
interface Value { readonly id: number; release(): void }
const started: number[]=[],published:number[]=[],released:number[]=[],failed:number[]=[];
const pending=new Map<number,{resolve:(value:Value)=>void;signal:AbortSignal}>();
const runtime=createLatestStickerPreparation<number,Value>((id,signal)=>{started.push(id);return new Promise(resolve=>pending.set(id,{resolve,signal}));},value=>published.push(value.id),id=>failed.push(id));
const finish=async(id:number)=>{const job=pending.get(id);assert(job);pending.delete(id);job.resolve({id,release:()=>released.push(id)});for(let i=0;i<4;i++)await Promise.resolve();};
runtime.request(1,'gesture-a');runtime.request(2,'gesture-a');await finish(1);
assert.deepEqual(started,[1,2]);assert.deepEqual(published,[1]);
runtime.request(3,'gesture-a');runtime.request(4,'gesture-a');runtime.request(5,'gesture-b');
assert(pending.get(2)?.signal.aborted);await finish(2);await finish(5);
assert.deepEqual(started,[1,2,5]);assert.deepEqual(published,[1,5]);assert.deepEqual(released,[2]);
runtime.request(6,'gesture-b');runtime.dispose();await finish(6);assert.deepEqual(released,[2,6]);assert.deepEqual(failed,[]);
const evidence={method:'Actual latest preparation runtime with deliberately late completions that ignore cancellation.',checks:{compatibleProgressNotStarved:true,onlyOneLatestWaiting:true,epochChangeRejectsOldReply:true,finalLatestPublishes:true,disposedReplyReleased:true,noSpuriousError:true},started,published,released};
await Bun.write(new URL('./latest.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');console.log(evidence);
