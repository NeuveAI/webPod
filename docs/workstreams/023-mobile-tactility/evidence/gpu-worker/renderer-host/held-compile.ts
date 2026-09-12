import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('packages/device/src/device-render-worker.ts','utf8');
const start=source.indexOf('  const publish = (next: RenderPose)'),end=source.indexOf('  const motion = ',start);
const warmStart=source.indexOf('  const adoptWarmup=async('),warmEnd=source.indexOf('  const adoptCarry=',warmStart);
assert(start>0&&end>start&&warmStart>0&&warmEnd>warmStart);
const script=new Bun.Transpiler({loader:'ts'}).transformSync(`async function exercise(cancel,rejectCompile=false){
 let pose={nodes:[],sequence:0},visible=true,painted=true,compiled=true,retired=false,ready=true,pendingPackPoseAck=null,warmup=null;
 let renders=0,projections=0,disposed=0,completed=0,failures=0,release,rejectHeld;
 const held=new Promise((resolve,reject)=>{release=resolve;rejectHeld=reject;}),scene={updateMatrixWorld(){}},camera={matrixWorld:{toArray:()=>[]},projectionMatrix:{toArray:()=>[]}},graph={objects:new Map()},screenMesh={matrixWorld:{toArray:()=>[]}};
 const renderer={render(actual){if(actual!==scene)throw Error('Candidate became visible');renders++;}};
 const backend={isInitialized:()=>true,isReady:()=>false,compile:()=>held};
 const projection={offer(){projections++;}},epoch=1,sceneRevision=1,resourceRevision=1,layout={revision:1},DEVICE_LAYOUT={screen:{width:320,height:240}},studio={texture:null},abort=new AbortController();
 const send=message=>{if(message.type==='warmup-complete')completed++;},fail=()=>{failures++;};
 const prepareStickerWarmup=async()=>({root:{candidate:true},dispose(){disposed++;}});
 ${source.slice(start,end)}
 ${source.slice(warmStart,warmEnd)}
 const work=adoptWarmup({prints:[{}]},1);await Promise.resolve();await Promise.resolve();
 publish({nodes:[],sequence:1});publish({nodes:[],sequence:2});
 const during={renders,projections,completed,displayReady:compiled};
 if(cancel)retired=true;if(rejectCompile)rejectHeld(new Error("compile rejected"));else release();await work;
 return {during,renders,projections,completed,disposed,failures,adopted:!!warmup};
}`);
const run=new Function(`${script};return exercise;`)();
const completed=await run(false),cancelled=await run(true),rejected=await run(false,true);
assert.deepEqual(completed.during,{renders:2,projections:2,completed:0,displayReady:true});
assert.equal(completed.completed,1);assert.equal(completed.adopted,true);
assert.deepEqual(cancelled.during,completed.during);assert.equal(cancelled.completed,0);assert.equal(cancelled.adopted,false);assert.equal(cancelled.disposed,1);
assert.equal(rejected.failures,1);assert.equal(rejected.completed,0);assert.equal(rejected.adopted,false);assert.equal(rejected.disposed,1);assert.deepEqual(rejected.during,completed.during);
await Bun.write(new URL('./held-compile.json',import.meta.url),JSON.stringify({method:'Exact extracted worker publish and warmup orchestration; held backend compile and render boundary, no real GPU timing',completed,cancelled,rejected},null,2)+'\n');
