import { strict as assert } from 'node:assert';
import { GlobalRegistrator } from '../../../../../../packages/device/node_modules/@happy-dom/global-registrator';
import { act, createElement } from '../../../../../../packages/device/node_modules/react';
import { createRoot } from '../../../../../../packages/device/node_modules/react-dom/client';
import { Ray } from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import { CompositeInputBoundary } from '../../../../../../packages/composite/src/CompositeDevice';
import { createClickWheelEventController } from '../../../../../../packages/device/src/click-wheel-event-controller';
import { ControlPhysicsController } from '../../../../../../packages/device/src/control-physics';
import type { ClickWheelInputSurfaceProps } from '../../../../../../packages/device/src/click-wheel-input-core';
import type { RenderPose } from '../../../../../../packages/device/src/device-render-protocol';
import { deviceStore, resetStackActionAtom } from '../../../../../../packages/state/src';

GlobalRegistrator.register();
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {value: true, configurable: true});
const container = document.createElement('div'); document.body.append(container);
const root = createRoot(container);
const mounted: {callbacks: ClickWheelInputSurfaceProps | null} = {callbacks: null};
let providerCalls = 0, renderCommands = 0;
try {
  deviceStore.set(resetStackActionAtom, [{screenId: 'S13', title: 'Now Playing', route: {kind: 'now-playing'}, rows: [], highlightIndex: -1, windowStart: 0, density: 'medium'}]);
  await act(async () => root.render(createElement(CompositeInputBoundary, {
    onTransportPress() {providerCalls++; return true;},
    children: handlers => {mounted.callbacks = handlers; return createElement('div', {role: 'application', tabIndex: 0}, 'Panel');},
  })));
  const callbacks = mounted.callbacks; assert(callbacks);
  const canvas = document.createElement('canvas'); const captured = new Set<number>();
  canvas.hasPointerCapture = id => captured.has(id); canvas.setPointerCapture = id => {captured.add(id);}; canvas.releasePointerCapture = id => {captured.delete(id);};
  const physics = new ControlPhysicsController({now: () => performance.now(), invalidate() {}, requestFrame: () => 1, cancelFrame() {}});
  const pose: RenderPose = {sequence: 0, motionEpoch: 0, lastAcceptedCommand: 0, sceneRevision: 1, resourceRevision: 1, layoutRevision: 1, nodes: [], orientation: {pitchDeg: 0, yawDeg: 0, rollDeg: 0}, reveal: null};
  let commandSequence = 0;
  const detach = physics.attachMotion({read: () => pose, nextCommandSequence: () => ++commandSequence, sendPose() {}, sendCommand() {renderCommands++;}, subscribe: () => () => {}});
  const controller = createClickWheelEventController({controlPhysics: physics, callbacks: () => callbacks, point: () => ({x: 75, y: 0, z: 0, radius: 75, angleDeg: 0})});
  const pointer = {pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, timeStamp: 100, ray: new Ray(), target: canvas, nativeEvent: {currentTarget: canvas}, stopPropagation() {}};
  // No render acknowledgment is ever delivered. Inspect the provider before
  // returning to any promise/microtask, through the actual product boundary.
  controller.wheel.down(pointer); controller.wheel.up({...pointer, timeStamp: 160});
  assert.equal(providerCalls, 1); assert(renderCommands >= 1); assert.equal(captured.size, 0);
  controller.dispose(); detach(); physics.dispose();
  console.log(JSON.stringify({actualCompositeBoundary: true, sharedNativeController: true, providerCallsInPointerStack: providerCalls,
    renderCommands, renderAcknowledgments: 0, providerBeforeAcknowledgmentOrAwait: true, scope: 'Offline product callback ordering; no real media account or browser autoplay claim.'}, null, 2));
} finally {await act(async () => root.unmount()); container.remove(); GlobalRegistrator.unregister();}
