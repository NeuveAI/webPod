// Actual reveal owner with deterministic browser scheduling; no timing benchmark.
import { GlobalRegistrator } from '../../../../../../packages/composite/node_modules/@happy-dom/global-registrator';
import { strict as assert } from 'node:assert';
import { mountDeviceReveal, deviceRevealFrame } from '../../../../../../apps/web/src/device-reveal';
import { clampDeviceOrientation } from '../../../../../../packages/device/src/orientation';
import { createDevicePreviewStore } from '../../../../../../apps/web/src/device-preview-orientation';
GlobalRegistrator.register();
let sequence=0;const timers=new Map<number,()=>void>(),frames=new Map<number,FrameRequestCallback>();
const schedule=(callback:()=>void)=>{timers.set(++sequence,callback);return sequence;};
Reflect.set(window,'setTimeout',schedule);Reflect.set(globalThis,'clearTimeout',(id:number)=>timers.delete(id));Reflect.set(window,'clearTimeout',(id:number)=>timers.delete(id));
Reflect.set(globalThis,'requestAnimationFrame',(callback:FrameRequestCallback)=>{frames.set(++sequence,callback);return sequence;});Reflect.set(globalThis,'cancelAnimationFrame',(id:number)=>frames.delete(id));
let observe=()=>{};class Observer {constructor(callback:()=>void){observe=callback;}observe(){}disconnect(){}}
Reflect.set(globalThis,'MutationObserver',Observer);
const runTimer=()=>{const item=timers.entries().next().value;if(!item)throw Error('missing timer');timers.delete(item[0]);item[1]();};
const setup=(canvasState?:string)=>{const room=document.createElement('div'),stage=document.createElement('div');room.append(stage);document.body.append(room);if(canvasState!==undefined){const canvas=document.createElement('canvas');canvas.dataset.wpRenderWarm=canvasState;stage.append(canvas);}return stage;};
const stage=setup('pending'),store=createDevicePreviewStore(),dispose=mountDeviceReveal(stage,store);
runTimer();assert.equal(stage.dataset.deviceReveal,'warming','10s safety timer must not finish pending geometry');assert.equal(frames.size,0);
const canvas=stage.querySelector('canvas');if(!canvas)throw Error('missing canvas');canvas.dataset.wpRenderWarm='ready';observe();runTimer();assert.equal(stage.dataset.deviceReveal,'entering');
let timestamp=0,logical=0;
for(let i=0;i<180 && frames.size;i++) {const callbacks=[...frames.values()];frames.clear();for(const callback of callbacks)callback(timestamp);if(i>0)logical+=20;if(logical<3460)assert.deepEqual(store.getSnapshot().orientation,clampDeviceOrientation(deviceRevealFrame(logical).orientation));timestamp+=20;}
assert.equal(stage.dataset.deviceReveal,'complete');assert(Object.values(store.getSnapshot().orientation).every(value=>value===0),'rest uses exact zero axes under existing signed-zero equality');assert.equal(frames.size,0);dispose();
for(const state of [undefined,'failed']){const fallback=setup(state),stop=mountDeviceReveal(fallback,createDevicePreviewStore());runTimer();assert.equal(fallback.dataset.deviceReveal,'complete');stop();}
const lateFailure=setup('pending'),stop=mountDeviceReveal(lateFailure,createDevicePreviewStore());runTimer();const failed=lateFailure.querySelector('canvas');if(!failed)throw Error('missing pending canvas');failed.dataset.wpRenderWarm='failed';observe();assert.equal(lateFailure.dataset.deviceReveal,'complete');stop();
console.log(JSON.stringify({pendingBeyondSafetyTimerWaits:true,realReadinessStartsEntry:true,originalFrameCurveAndFinalPose:true,noCanvasFallback:true,failedGraphicsFallback:true,lateFailureFallback:true,noResidualFrames:true},null,2));
await GlobalRegistrator.unregister();
