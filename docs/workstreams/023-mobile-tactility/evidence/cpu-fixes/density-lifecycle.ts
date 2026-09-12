// Deterministic lifecycle experiment of the actual observer and Jotai owner.
// No browser launch, injected app instrumentation, or frame-time claim.
import { mock } from 'bun:test';
import { strict as assert } from 'node:assert';
import { createCanvasPixelDensityStore } from '../../../../../packages/device/src/canvas-pixel-density-store';
import { resolveCanvasPixelRatio } from '../../../../../packages/device/src/pixel-density';
let effect: (() => void | (() => void)) | undefined;
const canvas = { getBoundingClientRect: () => ({ width: 330, height: 552 }) };
let observerCallback: ((entries: readonly object[]) => void) | undefined;
let observed = 0, disconnected = 0;
class Observer {
  constructor(callback: (entries: readonly object[]) => void) { observerCallback = callback; }
  observe() { observed++; }
  disconnect() { disconnected++; }
}
class Entry { devicePixelContentBoxSize = []; }
const listeners = new Set<() => void>();
const viewport = { addEventListener: (_type: string, fn: () => void) => { listeners.add(fn); }, removeEventListener: (_type: string, fn: () => void) => { listeners.delete(fn); } };
const browser = { devicePixelRatio: 1.5, visualViewport: viewport };
Reflect.set(globalThis, 'window', browser);
Reflect.set(globalThis, 'ResizeObserver', Observer);
Reflect.set(globalThis, 'ResizeObserverEntry', Entry);
mock.module('react', () => ({ useEffect: (callback: () => void | (() => void)) => { effect = callback; } }));
mock.module('@react-three/fiber', () => ({ useThree: (selector: (state: { gl: { domElement: typeof canvas } }) => unknown) => selector({ gl: { domElement: canvas } }) }));
const { CanvasPixelDensity } = await import('../../../../../packages/device/src/CanvasPixelDensity');
const owner = createCanvasPixelDensityStore(1.5), isolated = createCanvasPixelDensityStore(2);
let publications = 0, resizeTransitions = 0, configured = 1.5;
const unsubscribe = owner.store.sub(owner.density, () => { publications++; });
const configure = () => { const density = owner.store.get(owner.density); if (density !== configured) { configured = density; resizeTransitions++; } };
CanvasPixelDensity({ enabled: true, onChange: owner.publish });
if (!effect) throw Error('missing effect');
const cleanup = effect(); if (!cleanup) throw Error('missing cleanup');
assert.equal(publications, 0, 'equal initial measurement is suppressed');
function measure(width: number, height: number, physicalWidth: number, physicalHeight: number, fallback: number) {
  browser.devicePixelRatio = fallback;
  if (!observerCallback) throw Error('missing observer');
  observerCallback([{ contentRect: { width, height }, devicePixelContentBoxSize: [{ inlineSize: physicalWidth, blockSize: physicalHeight }] }]);
  const expected = resolveCanvasPixelRatio({ cssWidth: width, cssHeight: height, devicePixelBox: { inlineSize: physicalWidth, blockSize: physicalHeight }, fallbackDevicePixelRatio: fallback });
  assert.equal(owner.store.get(owner.density), expected); configure(); return expected;
}
const fractional = measure(330, 552, 496, 829, 1.5);
assert(fractional > 1.5 && fractional < 3);
const afterMeasurement = publications, afterResize = resizeTransitions;
for (let i = 0; i < 60; i++) configure();
assert.equal(publications, afterMeasurement); assert.equal(resizeTransitions, afterResize, 'orientation configure never restores window DPR');
measure(330, 552, 496, 829, 1.5); assert.equal(publications, afterMeasurement);
measure(440, 888, 440, 888, 3); assert.equal(configured, 3);
measure(440, 888, 1760, 3552, 4); assert.equal(configured, 3);
measure(330, 552, 660, 1104, 1); assert.equal(configured, 2);
browser.devicePixelRatio = 2.5; for (const listener of listeners) listener(); configure(); assert.equal(configured, 2.5);
assert.equal(isolated.store.get(isolated.density), 2);
cleanup(); const beforeStale = owner.store.get(owner.density); if (!observerCallback) throw Error('missing stale observer'); observerCallback([{ contentRect: { width: 1, height: 1 }, devicePixelContentBoxSize: [{ inlineSize: 3, blockSize: 3 }] }]); assert.equal(owner.store.get(owner.density), beforeStale); unsubscribe(); assert.equal(disconnected, 1); assert.equal(listeners.size, 0);
const previousObserved = observed;
CanvasPixelDensity({ enabled: false, onChange: isolated.publish }); if (!effect) throw Error('missing effect'); effect();
assert.equal(observed, previousObserved); assert.equal(isolated.store.get(isolated.density), 2);
const source = await Bun.file(new URL('../../../../../packages/device/src/DeviceCanvas.tsx', import.meta.url)).text();
assert(source.includes('dpr={resolvedDensity}')); assert(source.includes('onChange={densityOwner.publish}'));
console.log(JSON.stringify({ fractionalDensity: fractional, physicalResolverParity: true, sixtyPoseConfigurationsWithoutResize: true, equalMeasurementSuppressed: true, emulatedDprThree: true, clampedDensity: true, resizeAndViewportZoom: true, independentCanvases: true, numericOptOut: true, observerAndViewportCleanup: true, publications, resizeTransitions }, null, 2));
