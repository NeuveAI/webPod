import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Group,Matrix4} from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import {createDeviceMotionDriver} from '../../../../../../packages/device/src/device-motion-driver';
import {ControlPhysicsController} from '../../../../../../packages/device/src/control-physics';
import type {RenderPose} from '../../../../../../packages/device/src/device-render-protocol';
let next=0,requests=0,cancellations=0;
const frames=new Map<number,(timestamp:number)=>void>();
const realm={requestAnimationFrame(this:unknown,callback:(timestamp:number)=>void){assert.equal(this,realm,'requestAnimationFrame native receiver');requests++;frames.set(++next,callback);return next;},cancelAnimationFrame(this:unknown,handle:number){assert.equal(this,realm,'cancelAnimationFrame native receiver');cancellations++;frames.delete(handle);}};
const old={requestFrame:realm.requestAnimationFrame,cancelFrame:realm.cancelAnimationFrame};
assert.throws(()=>old.requestFrame(()=>{}),/native receiver/);assert.throws(()=>old.cancelFrame(1),/native receiver/);
function callbacks(path:string){const source=readFileSync(path,'utf8');const request=source.match(/requestFrame: (callback => globalThis.requestAnimationFrame\([^\n]+?\)), cancelFrame:/)?.[1]??source.match(/requestFrame: (callback => globalThis.requestAnimationFrame\([^\n]+\)),\n/)?.[1];const cancel=source.match(/cancelFrame: (handle => globalThis.cancelAnimationFrame\(handle\))/)?.[1];assert(request&&cancel);return new Function('globalThis','performance',`return {requestFrame:${request},cancelFrame:${cancel}}`)(realm,{timeOrigin:1000});}
const identity=new Matrix4().toArray();const pose:RenderPose={sequence:0,motionEpoch:1,lastAcceptedCommand:0,layoutRevision:1,sceneRevision:1,resourceRevision:1,nodes:[{id:'device-model',matrix:identity}],orientation:{pitchDeg:0,yawDeg:0,rollDeg:0},reveal:null};
const driver=createDeviceMotionDriver(pose,{...callbacks('packages/device/src/device-render-worker.ts'),now:()=>1000,rendererEpoch:1,orientationNodeId:'device-model',publish(){},settled(){}});
assert(driver.command({kind:'motion-start',commandSequence:1,motionEpoch:1,pose,program:{kind:'orientation-release',origin:{commandSequence:1,motionEpoch:1},previousStepTimestampMs:1000,state:{kind:'coast',orientation:pose.orientation,velocity:{pitchDegPerSecond:0,yawDegPerSecond:200,rollDegPerSecond:0},targetYawDeg:200/7.5,flickDirection:0}}}));
assert.equal(frames.size,1);driver.pause(true);assert.equal(frames.size,0);driver.pause(false);assert.equal(frames.size,1);driver.dispose();assert.equal(frames.size,0);
const controller=new ControlPhysicsController({...callbacks('packages/device/src/device-native-input.ts'),now:()=>1000,invalidate(){}});const wheel=new Group();controller.attachWheel(wheel);controller.pressWheel(40);controller.releaseWheel();assert.equal(frames.size,1);controller.dispose();assert.equal(frames.size,0);
await Bun.write(new URL('./native-frame-receiver.json',import.meta.url),JSON.stringify({method:'Actual driver/control owner with exact extracted host callbacks and strict branded platform boundary; observed Chrome error attribution still requires stack',oldUnboundRequestRejected:true,oldUnboundCancelRejected:true,workerPauseResumeDispose:true,mainControlDispose:true,requests,cancellations,remainingFrames:frames.size},null,2)+'\n');
