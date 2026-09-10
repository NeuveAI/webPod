import { Group, MeshBasicMaterial, PerspectiveCamera, Scene } from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import { createGpuPaperMaterialPreparation } from '../../../../../../packages/device/src/sticker-paper-gpu-support';
class Program {}
Object.defineProperty(globalThis,'WebGLProgram',{value:Program,configurable:true});
const originalTimeout=globalThis.setTimeout, originalClear=globalThis.clearTimeout, originalPerformance=globalThis.performance;
let clock=0,id=0;const timers=new Map<number,()=>void>();
Object.defineProperty(globalThis,'performance',{value:{now:()=>clock},configurable:true});
Object.defineProperty(globalThis,'setTimeout',{value:(callback:()=>void)=>{timers.set(++id,callback);return id;},configurable:true});
Object.defineProperty(globalThis,'clearTimeout',{value:(id:number)=>timers.delete(id),configurable:true});
const tick=()=>{const queued=[...timers.values()];timers.clear();for(const run of queued)run();};
const assert=(value:unknown,message:string)=>{if(!value)throw Error(message);};
const cases:Record<string,boolean>={};
function run(name:string,options:{complete?:boolean;link?:boolean;missing?:boolean;lost?:boolean;timeout?:boolean;dispose?:boolean}){
 clock=0;timers.clear();const material=new MeshBasicMaterial();let complete=options.complete??true,lost=false,publications=0,checks=0;
 const gl={LINK_STATUS:1,isContextLost:()=>lost,getExtension:()=>({COMPLETION_STATUS_KHR:2}),getProgramParameter:(_program:WebGLProgram,parameter:number)=>{checks++;return parameter===2?complete:options.link!==false;}};
 const renderer={getContext:()=>gl,properties:{get:()=>options.missing?{}:{currentProgram:{program:new Program()}}},compile:()=>{}};
 const preparation=createGpuPaperMaterialPreparation(renderer,()=>({root:new Group(),materials:[material]}),new PerspectiveCamera(),new Scene());
 preparation.subscribe(()=>publications++);const cleanup=preparation.mount();const stale=[...timers.values()];
 if(options.dispose){cleanup();stale.forEach(fn=>fn());assert(!preparation.getSnapshot()&&checks===0,'disposed poll queried GPU');}
 else if(options.missing){tick();assert(!preparation.getSnapshot(),'missing program enabled');}
 else if(options.lost){lost=true;tick();assert(!preparation.getSnapshot()&&checks===0,'lost context queried');}
 else if(options.timeout){clock=6000;tick();assert(!preparation.getSnapshot()&&checks===0,'timeout queried');}
 else if(options.complete===false){tick();assert(!preparation.getSnapshot()&&timers.size===1,'incomplete program enabled');complete=true;tick();assert(preparation.getSnapshot()&&publications===1,'completion absent');}
 else{tick();assert(preparation.getSnapshot()===(options.link!==false),'wrong link acceptance');}
 cleanup();assert(timers.size===0,'timer retained');material.dispose();cases[name]=true;
}
try{run('complete',{});run('incompleteThenReady',{complete:false});run('failedLink',{link:false});run('missingHandle',{missing:true});run('contextLost',{lost:true});run('deadline',{timeout:true});run('disposedStalePoll',{dispose:true});}
finally{Object.defineProperty(globalThis,'setTimeout',{value:originalTimeout,configurable:true});Object.defineProperty(globalThis,'clearTimeout',{value:originalClear,configurable:true});Object.defineProperty(globalThis,'performance',{value:originalPerformance,configurable:true});}
await Bun.write(new URL('./material-gate.json',import.meta.url),JSON.stringify(cases,null,2));console.log(cases);
