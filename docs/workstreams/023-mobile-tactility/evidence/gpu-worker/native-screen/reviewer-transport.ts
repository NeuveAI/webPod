import assert from 'node:assert/strict';
import { GlobalRegistrator } from '../../../../../../packages/device/node_modules/@happy-dom/global-registrator';
import { createNativeScreenTransport } from '../../../../../../packages/composite/src/native-screen-transport';
import type { NativeElementImage } from '../../../../../../packages/device/src/native-element-image';
import type { NativePaintStamp } from '../../../../../../packages/device/src/device-render-protocol';
GlobalRegistrator.register();
const generation = {epoch: 1, rasterRevision: 1, layoutRevision: 1, visibilityRevision: 1, width: 960, height: 720};
function fixture(send: (stamp: NativePaintStamp, image: NativeElementImage) => void) {
  const canvas = document.createElement('canvas'), panel = document.createElement('div'); canvas.append(panel);
  let requests = 0, captured = 0, closed = 0, failures = 0;
  Object.defineProperties(canvas, {
    transferControlToOffscreen: {value() {throw Error('Not used by transport fixture');}},
    requestPaint: {value() {requests++;}},
    captureElementImage: {value() {captured++; return {width: 640, height: 480, close() {closed++;}};}},
  });
  const transport = createNativeScreenTransport({canvas, panel, generation, send, fail() {failures++;}});
  return {canvas, panel, transport, read: () => ({requests,captured,closed,failures}), paint: () => canvas.dispatchEvent(new Event('paint'))};
}
try {
  const sent: {stamp: NativePaintStamp; image: NativeElementImage}[] = [];
  const first = fixture((stamp,image) => sent.push({stamp,image}));
  await Promise.resolve(); assert.equal(first.read().requests, 1);
  first.paint(); assert.equal(sent.length,1); assert.equal(first.read().closed,0);
  for(let i=0;i<10000;i++) first.paint(); assert.equal(first.read().captured,1);
  const oldest=sent[0]; assert(oldest);
  first.transport.update({...generation,rasterRevision:2},true);
  assert.equal(first.transport.acknowledge({...oldest.stamp,captureId:99}),false);
  assert.equal(first.read().captured,1);
  oldest.image.close(); assert(first.transport.acknowledge(oldest.stamp)); await Promise.resolve();
  first.paint(); assert.equal(sent.length,2);
  const current=sent[1]; assert(current); assert.equal(current.stamp.rasterRevision,2);
  first.transport.update({...generation,visibilityRevision:2},false);
  first.paint(); assert.equal(first.read().captured,2);
  current.image.close(); first.transport.acknowledge(current.stamp);
  first.transport.dispose(); first.paint(); first.transport.requestPaint(); await Promise.resolve(); assert.equal(first.read().captured,2);
  const failed=fixture(()=>{throw Error('Synchronous transfer failure');}); await Promise.resolve(); failed.paint();
  assert.deepEqual(failed.read(),{requests:1,captured:1,closed:1,failures:1}); assert.equal(failed.transport.inspect().disposed,true);
  const detached=fixture(()=>{throw Error('Detached panel must not send');}); await Promise.resolve(); detached.panel.remove(); detached.paint(); assert.equal(detached.read().captured,0); detached.transport.dispose();
  console.log(JSON.stringify({actualTransport:true,paintCreditsBounded:10000,exactAck:true,resizeWaitsForOwnedImage:true,hiddenDoesNotCapture:true,disposedDoesNotCapture:true,synchronousTransferFailureClosesOnce:true,panelAssociationAdmission:true,scope:'Actual transport with controlled DOM/capture callbacks; native transfer and GPU execution are separate Chrome evidence.'},null,2));
} finally {GlobalRegistrator.unregister();}
