import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source = readFileSync('packages/composite/src/device-render-host.ts', 'utf8');
const start = source.indexOf('  worker.onmessage = ({ data }'), end = source.indexOf('\n  const start = async', start);
const adoptStart = source.indexOf('  const adoptPose = '), adoptEnd = source.indexOf('\n  const dispose = ', adoptStart);
assert(start > 0 && end > start && adoptStart > 0 && adoptEnd > adoptStart);
const script = new Bun.Transpiler({loader: 'ts'}).transformSync(`function exercise(){
 const worker={};const disposed=false,epoch=1;let pose={sequence:1,motionEpoch:1,lastAcceptedCommand:1,sceneRevision:1,resourceRevision:1,layoutRevision:1,nodes:[],orientation:{yawDeg:0,pitchDeg:0,rollDeg:0},reveal:null};
 let seen=0,querySequence=0,seenQuery=0,notifications=0;const layout={revision:1};
 const query={applyPose(next){querySequence=next.sequence;},nodes:new Map()};let stickers=null,carry=null;
 const listeners=new Set([()=>{seen=pose.sequence;seenQuery=querySequence;notifications++;}]);const fail=(error)=>{throw error;};
 ${source.slice(adoptStart, adoptEnd)}
 ${source.slice(start, end)}
 worker.onmessage({data:{type:'command-settled',version:1,epoch:1,commandSequence:1,motionEpoch:1,outcome:'settled',pose:{...pose,sequence:2}}});
 const settlement={poseSequence:pose.sequence,seenByListener:seen,seenQuery};
 worker.onmessage({data:{type:'motion-checkpoint',version:1,epoch:1,checkpoint:{pose:{...pose,sequence:3},programs:[],reducedMotion:false}}});
 const checkpoint={poseSequence:pose.sequence,seenByListener:seen,seenQuery};
 worker.onmessage({data:{type:'command-settled',version:1,epoch:1,commandSequence:1,motionEpoch:1,outcome:'settled',pose:{...pose,sequence:2}}});
 worker.onmessage({data:{type:'command-settled',version:1,epoch:1,commandSequence:1,motionEpoch:0,outcome:'settled',pose:{...pose,motionEpoch:0,sequence:4}}});
 return {settlement,checkpoint,notifications,finalSequence:pose.sequence};
}`);
const run = new Function(`${script};return exercise;`)();
const result = run();
assert.deepEqual(result.settlement, {poseSequence: 2, seenByListener: 2, seenQuery: 2});
assert.deepEqual(result.checkpoint, {poseSequence: 3, seenByListener: 3, seenQuery: 3});
assert.equal(result.notifications, 2); assert.equal(result.finalSequence, 3);
await Bun.write(new URL('./reviewer-terminal-pose.json', import.meta.url), JSON.stringify({method: 'Actual extracted host message handler and adoption guard; controlled query/listener boundary without a screen node. No GPU/Panel image claim.', ...result}, null, 2) + '\n');
