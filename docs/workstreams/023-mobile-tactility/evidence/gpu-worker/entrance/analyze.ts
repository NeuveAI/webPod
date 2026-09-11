import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
interface Frame {functionName?:string;url?:string;lineNumber?:number;columnNumber?:number}
interface Node {id:number;parent?:number;callFrame:Frame}
interface Event {pid:number;tid:number;ts:number;dur?:number;ph:string;name:string;id?:string;args?:{name?:string;data?:{startTime?:number;workerThreadId?:number;url?:string;cpuProfile?:{nodes?:Node[];samples?:number[]};timeDeltas?:number[]}}}
const path='/private/var/folders/ft/7tsjkpcn20q5fx1q8dwv26x80000gn/T/webpod-native-entrance-interval.json.gz';
const raw=await Bun.file(path).arrayBuffer();const events:Event[]=JSON.parse(gunzipSync(raw).toString()).traceEvents;
const min=259138966067,max=259146301959,pid=39318,main=4511411,renderer=4525946;
// Only target-process metadata and first-party frames are retained. No other
// tabs' URL/content, screenshots or CPU profiles enter this report.
const target=events.filter(e=>e.pid===pid);
const safeFrame=(frame:Frame)=>({name:frame.functionName??'',...(frame.url?.startsWith('http://localhost:3000/')?{source:frame.url.replace('http://localhost:3000/','').split('?')[0],line:(frame.lineNumber??-1)+1,column:(frame.columnNumber??-1)+1}:{})});
const profiles=target.filter(e=>e.name==='Profile').map(start=>{
 const chunks=target.filter(e=>e.name==='ProfileChunk'&&e.id===start.id).sort((a,b)=>a.ts-b.ts);
 const nodes=new Map<number,Node>();for(const chunk of chunks)for(const node of chunk.args?.data?.cpuProfile?.nodes??[])nodes.set(node.id,node);
 let time=start.args?.data?.startTime??start.ts,count=0,total=0;const weights=new Map<number,number>();
 for(const chunk of chunks){const samples=chunk.args?.data?.cpuProfile?.samples??[],deltas=chunk.args?.data?.timeDeltas??[];for(let i=0;i<samples.length;i++){
  const delta=deltas[i]??0,previous=time;time+=delta;const weight=Math.max(0,Math.min(time,max)-Math.max(previous,min));if(weight===0)continue;const id=samples[i];if(id===undefined)continue;count++;total+=weight;weights.set(id,(weights.get(id)??0)+weight);
 }}
 const worker=target.find(e=>e.name==='TracingSessionIdForWorker'&&e.args?.data?.workerThreadId===start.tid)?.args?.data?.url;
 return{thread:start.tid,worker:worker?.startsWith('http://localhost:3000/')?worker.replace('http://localhost:3000/','').split('?')[0]:null,samples:count,sampledDeltaMs:total/1000,lastSampleTimestamp:time,
 top:[...weights].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([id,weight])=>{const node=nodes.get(id);const stack=[];let n=node;for(let depth=0;n&&depth<15;depth++){stack.push(safeFrame(n.callFrame));n=n.parent===undefined?undefined:nodes.get(n.parent);}return{sampleDeltaMs:weight/1000,stack};})};
});
const tracks=[main,renderer].map(tid=>{
 const track=target.filter(e=>e.tid===tid&&e.ts>0),during=track.filter(e=>e.ts>=min&&e.ts<=max);
 const complete=track.filter(e=>e.ph==='X'&&e.name==='RunTask'&&e.ts<max&&e.ts+(e.dur??0)>min);
 const beginEnd=track.filter(e=>e.name==='RunTask'&&(e.ph==='B'||e.ph==='E'));
 const stack:Event[]=[],paired:{start:number;duration:number}[]=[];for(const e of beginEnd.sort((a,b)=>a.ts-b.ts)){if(e.ph==='B')stack.push(e);else{const b=stack.pop();if(b)paired.push({start:b.ts,duration:e.ts-b.ts});}}
 const tasks=[...complete.map(e=>({start:e.ts,duration:e.dur??0})),...paired].filter(e=>e.start<max&&e.start+e.duration>min);
 return{tid,lastEventTimestamp:Math.max(...track.map(e=>e.ts+(e.dur??0))),eventsInInterval:during.length,runTasks:tasks.length,longTasksOver50ms:tasks.filter(t=>t.duration>50000).map(t=>({startMs:(t.start-min)/1000,durationMs:t.duration/1000})),unclosedTaskBegins:stack.length,
 callbackEvents:during.filter(e=>['FireAnimationFrame','FunctionCall','RequestAnimationFrame'].includes(e.name)).length};
});
const lifecycle = {targetFrameProcessSwapEvents: target.filter(e => ['FrameCommittedInBrowser', 'FrameDeletedInBrowser', 'CommitLoad', 'ProcessReadyInBrowser'].includes(e.name)).length, explicitPauseHiddenBfcacheEvents: target.filter(e => /DebuggerPaused|PageHidden|BFCache/.test(e.name)).length, mainLastUnclosedTaskStart: 259138682915, note: 'No explicit matching lifecycle marker is proof of neither absence nor cause; incomplete main RunTask cannot be assigned a completed duration.'};
const output={lifecycle,sourceCommit:'22437fc',traceSha256:createHash('sha256').update(new Uint8Array(raw)).digest('hex'),traceBytes:raw.byteLength,interval:{min,max,durationMs:(max-min)/1000},target:{pid,main,renderer},tracks,profiles,
 limitations:['No target main-thread events or CPU profile in the authoritative interval; absence is not zero CPU cost.','Profile time-delta attribution is sampling weight, not exact function duration or GPU time.','No reveal phase/logical elapsed markers in this capture; cannot establish start/end or pose cadence.','Chrome DEV source coordinates refer to transformed modules; primary source function names checked at pinned commit.','Global trace contains other processes; analysis intentionally excludes them.']};
await Bun.write(new URL('./summary.json',import.meta.url),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output,null,2));
