// Exercise the actual warmup component with deterministic hooks/driver scheduling.
// This is a retained lifecycle experiment, not a browser timing measurement.
import { mock } from 'bun:test';
import { strict as assert } from 'node:assert';
let effect: (() => void | (() => void)) | undefined;
let frame: (() => void) | undefined;
let resolveCompile = () => {};
let rejectCompile: (error: Error) => void = () => {};
const dataset: Record<string, string> = {};
const timers = new Map<number, () => void>(), rafs = new Map<number, () => void>();
let sequence = 0, uploads = 0;
const canvas = { dataset, closest: () => true, setAttribute: (_name: string, value: string) => { dataset.wpRenderWarm = value; } };
const renderer = { domElement: canvas, compileAsync: () => new Promise<void>((resolve, reject) => { resolveCompile = resolve; rejectCompile = reject; }), initTexture: () => { uploads++; } };
mock.module('@react-three/fiber', () => ({ useFrame: (callback: () => void) => { frame = callback; }, useThree: () => ({ gl: renderer, scene: { traverse: () => {} }, camera: {}, invalidate: () => {} }) }));
mock.module('react', () => ({ useRef: (current: number) => ({ current }), useEffect: (callback: () => void | (() => void)) => { effect = callback; } }));
Reflect.set(globalThis, 'setTimeout', (callback: () => void) => { timers.set(++sequence, callback); return sequence; });
Reflect.set(globalThis, 'clearTimeout', (id: number) => timers.delete(id));
Reflect.set(globalThis, 'requestAnimationFrame', (callback: () => void) => { rafs.set(++sequence, callback); return sequence; });
Reflect.set(globalThis, 'cancelAnimationFrame', (id: number) => rafs.delete(id));
const { DeviceRenderWarmup } = await import('../../../../../../packages/device/src/DeviceRenderWarmup');
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function start() { delete dataset.wpRenderWarm; DeviceRenderWarmup(); if (!effect) throw Error('missing effect'); const cleanup = effect(); if (!cleanup) throw Error('missing cleanup'); for (const callback of rafs.values()) callback(); rafs.clear(); return cleanup; }
let cleanup = start();
for (const callback of timers.values()) callback(); timers.clear();
assert.equal(dataset.wpRenderWarm, 'failed'); resolveCompile(); await flush(); assert.equal(dataset.wpRenderWarm, 'failed'); assert.equal(uploads, 0); cleanup();
cleanup = start(); cleanup(); resolveCompile(); await flush(); assert.equal(dataset.wpRenderWarm, undefined); assert.equal(timers.size, 0);
cleanup = start(); resolveCompile(); await flush(); assert.equal(timers.size, 0); if (!frame) throw Error('missing frame'); frame(); frame(); assert.equal(dataset.wpRenderWarm, undefined); frame(); assert.equal(dataset.wpRenderWarm, 'ready'); cleanup();
cleanup = start(); rejectCompile(Error('driver failure')); await flush(); assert.equal(dataset.wpRenderWarm, 'failed'); assert.equal(timers.size, 0); cleanup();
assert.equal(rafs.size, 0); assert.equal(timers.size, 0);
console.log(JSON.stringify({ deadlineReportsFailure: true, lateResolveIgnored: true, unmountCancelsDeadlineAndPublication: true, successRetainsThreeWarmFrames: true, rejectionReportsFailure: true, noResidualScheduling: true }, null, 2));
