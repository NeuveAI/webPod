import {createHash} from 'node:crypto';
interface Phase {t:number;phase?:string;renderer?:string}
interface Task {start:number;duration:number}
interface Script {duration:number;executionStart:number;invoker:string;sourceURL:string;sourceFunctionName:string;forcedStyleAndLayoutDuration:number}
interface LongFrame extends Task {blocking:number;scripts:Script[]}
interface InputEvent extends Task {name:string;processingStart:number;processingEnd:number;interactionId:number}
interface Probe {origin:number;start:number;end:number;frames:number[];phases:Phase[];longFrames:LongFrame[];longTasks:Task[];events:InputEvent[];renderer:string;failure:string|null}
const stats=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b);return{count:values.length,median:sorted[Math.ceil(sorted.length*.5)-1]??null,p95:sorted[Math.ceil(sorted.length*.95)-1]??null,max:sorted.at(-1)??null,over33_34:values.filter(v=>v>33.34).length,over50:values.filter(v=>v>50).length};};
const results=[];
for(const [name,path] of [
 ['fixed-rotation','/tmp/webpod-cpu-fixes-production-rotation-frame-probe.json'],
 ['fixed-peel','/tmp/webpod-cpu-fixes-production-peel-frame-probe.json'],
 ['repeat-peel','/tmp/webpod-cpu-fixes-production-repeat-peel-frame-probe.json'],
 ['prior-rotation','/tmp/webpod-native-production-rotation-verified-frame-probe.json'],
 ['prior-peel','/tmp/webpod-production-peel-frame-probe.json'],
] as const){
 const raw=await Bun.file(path).text(),p:Probe=JSON.parse(raw);await Bun.write(new URL(`${name}.input.json`,import.meta.url),raw);
 const first=p.phases[0]?.t;if(first===undefined)throw Error('Missing first RAF anchor');let t=first;
 const intervals=p.frames.map(duration=>{const start=t;t+=duration;return{start,end:t,duration};});
 const events=p.events.filter(e=>e.name==='pointerdown'||e.name==='pointerup').map(e=>({...e,delay:e.processingStart-e.start,handler:e.processingEnd-e.processingStart,presentationRemainder:e.start+e.duration-e.processingEnd}));
 const down=events.find(e=>e.name==='pointerdown');if(!down)throw Error('Missing down');
 results.push({name,sha256:createHash('sha256').update(raw).digest('hex'),duration:p.end-p.start,origin:p.origin,start:p.start,end:p.end,firstRAF:first,lastRAF:t,raf:stats(p.frames),events,
 longTasks:p.longTasks,longFrames:p.longFrames.map(f=>({...f,afterDown:f.start-down.start,afterDownHandler:f.start-down.processingEnd,scripts:f.scripts.map(s=>({...s,afterDown:s.executionStart-down.start}))})),
 intervalsOver33:intervals.filter(i=>i.duration>33.34).map(i=>({...i,afterDown:i.start-down.start})),phase:p.phases,renderer:p.renderer,failure:p.failure});
}
await Bun.write(new URL('summary.json',import.meta.url),JSON.stringify({method:'Stopped main RAF/PerformanceObserver arithmetic; nearest rank, no GPU timing; event remainder quantized and not exact presentation; missing support/drain flags limit absence claims',results},null,2)+'\n');
console.log(JSON.stringify(results.map(({name,duration,raf,events,longTasks,longFrames})=>({name,duration,raf,events,tasks:longTasks.length,longFrames})),null,2));
