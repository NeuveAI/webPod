import { strict as assert } from 'node:assert';
import { Ray } from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import { createClickWheelEventController } from '../../../../../../packages/device/src/click-wheel-event-controller';
import type { ClickWheelPointerEvent, ClickWheelInputSurfaceProps } from '../../../../../../packages/device/src/click-wheel-input-core';

class CaptureHost extends EventTarget {
  readonly captured = new Set<number>();
  hasPointerCapture(id: number) {return this.captured.has(id);}
  setPointerCapture(id: number) {this.captured.add(id);}
  releasePointerCapture(id: number) {this.captured.delete(id); this.dispatchEvent(Object.assign(new Event('lostpointercapture'), {pointerId: id}));}
}
const host = new CaptureHost(), log: string[] = [];
let point = {x: 0, y: 75, z: 0, radius: 75, angleDeg: 270};
const callbacks: ClickWheelInputSurfaceProps = {
  onArcStart: sample => log.push(`arc-start:${sample.angleDeg}`), onArcMove: sample => log.push(`arc-move:${sample.angleDeg}`), onArcEnd: end => log.push(`arc-end:${end.reason}`),
  onCardinalStart: start => log.push(`cardinal-start:${start.button}`), onCardinalEnd: end => log.push(`cardinal-end:${end.accepted}:${end.reason}`), onCardinalPress: press => log.push(`press:${press.button}`),
  onSelectStart: () => log.push('select-start'), onSelectEnd: end => log.push(`select-end:${end.reason}`),
};
const controller = createClickWheelEventController({controlPhysics: null, callbacks: () => callbacks, point: () => point});
const event = (id: number, timeStamp: number): ClickWheelPointerEvent => ({pointerId: id, pointerType: 'touch', isPrimary: true, button: 0, timeStamp, ray: new Ray(), target: host, nativeEvent: {currentTarget: host}, stopPropagation() {}});
controller.wheel.down(event(1, 1)); assert(host.hasPointerCapture(1)); controller.wheel.up(event(1, 2));
assert.deepEqual(log, ['cardinal-start:menu', 'cardinal-end:true:release', 'press:menu']);
assert.equal(host.captured.size, 0);
log.length = 0;
controller.wheel.down(event(2, 3)); point = {x: 75, y: 0, z: 0, radius: 75, angleDeg: 0}; controller.wheel.move(event(2, 4)); controller.wheel.up(event(2, 5));
assert.deepEqual(log, ['cardinal-start:menu', 'arc-start:270', 'arc-move:0', 'arc-end:release', 'cardinal-end:false:release']);
log.length = 0;
controller.select.down(event(3, 6)); host.dispatchEvent(Object.assign(new Event('pointercancel'), {pointerId: 3})); controller.select.up(event(3, 7));
assert.deepEqual(log, ['select-start', 'select-end:cancel']);
// Native cancellation owns release; no late up produces another semantic event.
host.captured.clear(); log.length = 0;
controller.select.down(event(4, 8)); controller.dispose(); controller.dispose();
assert.deepEqual(log, ['select-start', 'select-end:cancel']); assert.equal(host.captured.size, 0);
const failing = createClickWheelEventController({controlPhysics: null, point: () => point, callbacks: () => ({...callbacks, onSelectStart() {throw Error('planted callback');}})});
assert.throws(() => failing.select.down(event(5, 9)), /planted callback/); assert.equal(host.captured.size, 0); failing.dispose();
console.log(JSON.stringify({sharedControllerNativeDispatch: true, acceptedCardinalExactlyOnce: true, cardinalToArcOriginalSample: true,
  cancelAndLostCaptureIdempotent: true, disposalReleasesCapture: true, callbackFailureCleansCapture: true,
  scope: 'Exact shared native event controller; geometric admission and browser media activation remain host/integration checks.'}, null, 2));
