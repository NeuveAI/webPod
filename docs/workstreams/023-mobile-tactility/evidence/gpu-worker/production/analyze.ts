import {createHash} from 'node:crypto';
interface Phase {t:number;phase?:string;renderer?:string}
interface Task {start:number;duration:number}
interface Script {duration:number;executionStart:number;invoker:string;sourceURL:string;sourceFunctionName:string;forcedStyleAndLayoutDuration:number}
interface LongFrame extends Task {blocking:number;scripts:Script[]}
interface InputEvent extends Task {name:string;processingStart:number;processingEnd:number;interactionId:number}
interface Probe {origin:number;start:number;end:number;frames:number[];phases:Phase[];longFrames:LongFrame[];longTasks:Task[];events:InputEvent[];renderer:string;failure:string|null}
const outputDirectory=new URL('./',import.meta.url);
const stats=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b);return{count:values.length,median:sorted[Math.ceil(sorted.length*.5)-1]??null,p95:sorted[Math.ceil(sorted.length*.95)-1]??null,max:sorted.at(-1)??null,over33_34:values.filter(v=>v>33.34).length,over50:values.filter(v=>v>50).length};};
const results=[];
for(const [name,path,build]of [
 ['entry','/tmp/webpod-production-same-origin-entry-probe.json','production f89be7f index-DuyC5bju.js'],
 ['peel','/tmp/webpod-production-peel-frame-probe.json','production same navigation as entry'],
 ['rotation','/tmp/webpod-rotation-frame-probe.json','DEV separate navigation/run'],
 ['baseline-entry','/tmp/webpod-baseline-entry-probe.json','production 4cc7f4a index-B26XPa1g.js'],
 ['baseline-peel','/tmp/webpod-baseline-peel-frame-probe.json','production 4cc7f4a same baseline navigation'],
 ['baseline-rotation-verified','/tmp/webpod-baseline-rotation-verified-frame-probe.json','production 4cc7f4a verified front-to-rear rotation'],
 ['native-production-rotation-verified','/tmp/webpod-native-production-rotation-verified-frame-probe.json','production f89be7f verified front-to-rear rotation'],
]as const){
 const raw=await Bun.file(path).text(),probe:Probe=JSON.parse(raw);await Bun.write(new URL(`${name}.input.json`,outputDirectory),raw);
 const anchor=probe.phases[0]?.t;if(anchor===undefined)throw Error('No first-frame phase anchor');
 let t=anchor;const intervals=probe.frames.map(duration=>{const start=t;t+=duration;return{start,end:t,duration};});
 const phaseMatches=probe.phases.map(phase=>({phase:phase.phase??'no-stage',time:phase.t,distanceToReconstructedRAF:Math.min(Math.abs(anchor-phase.t),...intervals.map(i=>Math.abs(i.end-phase.t)))}));
 if(phaseMatches.some(p=>p.distanceToReconstructedRAF>1e-5))throw Error('Phase anchors do not match reconstructed RAF sequence');
 const phaseTime=(name:string)=>{const phase=probe.phases.find(p=>p.phase===name);if(!phase)throw Error('Missing entry phase');return phase.t;};
 const windows=name.endsWith('entry')?[['before-stage',probe.start,phaseTime('warming')],['warming-observed',phaseTime('warming'),phaseTime('entering')],['entering-observed',phaseTime('entering'),phaseTime('complete')],['after-DOM-complete',phaseTime('complete'),probe.end]]as const:[['observed',probe.start,probe.end]]as const;
 results.push({name,build,inputSha256:createHash('sha256').update(raw).digest('hex'),origin:probe.origin,observerStart:probe.start,observerEnd:probe.end,observerDuration:probe.end-probe.start,
 firstRAF:anchor,lastRAF:t,phaseMatches,renderer:probe.renderer,failure:probe.failure,raf:stats(probe.frames),
 windows:windows.map(([label,start,end])=>({label,start,end,duration:end-start,rafFullyContained:stats(intervals.filter(i=>i.start>=start&&i.end<=end).map(i=>i.duration)),crossingRAFIntervals:intervals.filter(i=>i.start<end&&i.end>start&&!(i.start>=start&&i.end<=end)),
 longTasks:probe.longTasks.filter(task=>task.start<end&&task.start+task.duration>start),longTaskTotalMs:probe.longTasks.filter(task=>task.start<end&&task.start+task.duration>start).reduce((sum,task)=>sum+Math.max(0,Math.min(end,task.start+task.duration)-Math.max(start,task.start)),0),longFrames:probe.longFrames.filter(task=>task.start<end&&task.start+task.duration>start)})),
 events:probe.events.filter(e=>e.name==='pointerdown'||e.name==='pointerup').map(e=>({...e,inputDelay:e.processingStart-e.start,processingDuration:e.processingEnd-e.processingStart,roundedPresentationRemainder:e.start+e.duration-e.processingEnd})),
 coverage:{rafCapReached:probe.frames.length>=2000,longFrameCapReached:probe.longFrames.length>=300,longTaskCapReached:probe.longTasks.length>=300,eventCapReached:probe.events.length>=300,observerSupportNotRecorded:true,undeliveredEntriesAtDisconnectNotDrained:true}});
}
await Bun.write(new URL('summary.json',outputDirectory),JSON.stringify({method:'Offline arithmetic over stopped main-window RAF and PerformanceObserver inputs. Nearest-rank quantiles; phase times are first RAF observation, not exact transition. RAF reconstruction anchored only because original probe records its first RAF phase and every successive delta.',results},null,2)+'\n');
console.log(JSON.stringify(results.map(r=>({name:r.name,duration:r.observerDuration,raf:r.raf,windows:r.windows.map(w=>({label:w.label,raf:w.rafFullyContained,tasks:w.longTasks.length,total:w.longTaskTotalMs,longFrames:w.longFrames.length})),events:r.events})),null,2));
