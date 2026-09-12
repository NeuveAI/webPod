import assert from 'node:assert/strict';
import {Matrix4} from '../../../../../../packages/device/node_modules/three';
import {createDeviceMotionDriver} from '../../../../../../packages/device/src/device-motion-driver';
import type {RenderPose} from '../../../../../../packages/device/src/device-render-protocol';
let now=1000,id=0;const frames=new Map<number,(time:number)=>void>();
const initial:RenderPose={sequence:0,motionEpoch:1,lastAcceptedCommand:0,layoutRevision:1,sceneRevision:1,resourceRevision:1,nodes:[{id:'device-model',matrix:new Matrix4().identity().toArray()}],orientation:{yawDeg:0,pitchDeg:0,rollDeg:0},reveal:null};
const driver=createDeviceMotionDriver(initial,{now:()=>now,requestFrame:callback=>{frames.set(++id,callback);return id;},cancelFrame:handle=>{frames.delete(handle);},rendererEpoch:1,orientationNodeId:'device-model',publish(){},settled(){}});
assert(driver.command({kind:'motion-start',commandSequence:1,motionEpoch:1,pose:initial,program:{kind:'orientation-release',origin:{commandSequence:1,motionEpoch:1},previousStepTimestampMs:now,state:{kind:'coast',orientation:initial.orientation,velocity:{pitchDegPerSecond:0,yawDegPerSecond:200,rollDegPerSecond:0},targetYawDeg:200/7.5,flickDirection:0}}}));
const staleMainPose=driver.read();
const tick=()=>{now+=16;const callbacks=[...frames.values()];frames.clear();for(const callback of callbacks)callback(now);};
tick();tick();const before=driver.read().orientation.yawDeg;
// A reliable wheel-contact command arrives before the coalesced projection is
// acknowledged. Its orientation belongs to the older main sample.
assert(driver.command({kind:'control-contact',commandSequence:2,motionEpoch:1,pose:staleMainPose,contactAngleDeg:44,timestampMs:now}));
const afterCommand=driver.read().orientation.yawDeg;tick();const afterNextTick=driver.read().orientation.yawDeg;
for(let step=0;step<2000&&frames.size;step++)tick();assert.equal(frames.size,0);const settledYaw=driver.read().orientation.yawDeg;
assert(driver.command({kind:'control-contact',commandSequence:3,motionEpoch:1,pose:staleMainPose,contactAngleDeg:55,timestampMs:now}));const afterSettledCommand=driver.read().orientation.yawDeg;
driver.dispose();
const down=new Matrix4().makeTranslation(0,0,-.12).toArray(),rest=new Matrix4().identity().toArray();
const controlsInitial:RenderPose={...initial,nodes:[...initial.nodes,{id:'wheel-assembly',matrix:down},{id:'select',matrix:down}]};
const controls=createDeviceMotionDriver(controlsInitial,{now:()=>now,requestFrame:callback=>{frames.set(++id,callback);return id;},cancelFrame:handle=>{frames.delete(handle);},rendererEpoch:2,orientationNodeId:'device-model',publish(){},settled(){}});
let command=0;
for(const channel of ['wheel','select'] as const){assert(controls.command({kind:'motion-start',commandSequence:++command,motionEpoch:1,pose:controlsInitial,program:{kind:'control-release',channel,nodeId:channel==='wheel'?'wheel-assembly':'select',origin:{commandSequence:command,motionEpoch:1},restMatrix:rest,restPosition:[0,0,0],restQuaternion:[0,0,0,1],restScale:[1,1,1],contactAngleDeg:30,initialDepth:.12,durationMs:120,startedAtTimestampMs:now,lastTimestampMs:now,stalledFrames:0}}));}
for(let step=0;step<20&&frames.size;step++)tick();assert.equal(frames.size,0);
const matrix=(nodeId:string)=>{const value=controls.read().nodes.find(node=>node.id===nodeId);assert(value);return value.matrix;};
assert.deepEqual(matrix('select'),rest);assert.deepEqual(matrix('wheel-assembly'),rest);
assert(controls.adoptPose({...controlsInitial,motionEpoch:2,orientation:{yawDeg:70,pitchDeg:0,rollDeg:0}}));
assert.deepEqual(matrix('select'),rest);assert.deepEqual(matrix('wheel-assembly'),rest);
assert(controls.command({kind:'control-down',button:'center',timestampMs:now,commandSequence:++command,motionEpoch:2,pose:{...controlsInitial,motionEpoch:2}}));
assert.deepEqual(matrix('select'),down);assert.deepEqual(matrix('wheel-assembly'),rest);assert.equal(controls.read().orientation.yawDeg,70);
assert(controls.command({kind:'control-down',button:'menu',timestampMs:now,commandSequence:++command,motionEpoch:2,pose:{...controlsInitial,motionEpoch:2,nodes:controlsInitial.nodes.map(node=>node.id==='select'?{...node,matrix:rest}:node)}}));
assert.deepEqual(matrix('select'),down);assert.deepEqual(matrix('wheel-assembly'),down);assert.equal(controls.read().lastAcceptedCommand,command);controls.dispose();assert.equal(frames.size,0);
const result={completedControlsRetainRestAcrossNewOrientation:true,explicitPressAdmitsTargetPreservesHeldPeer:true,settledYaw,afterSettledCommand,completedChannelRegresses:afterSettledCommand!==settledYaw,before,afterCommand,afterNextTick,unrelatedCommandRegressesOrientation:afterCommand<before,scope:'Actual motion driver with delayed main projection receipt; controlled clock/RAF, no browser or latency measurement.'};
await Bun.write(new URL('./reviewer-motion-channels.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);assert.equal(result.unrelatedCommandRegressesOrientation,false);assert.equal(result.completedChannelRegresses,false);
