import assert from 'node:assert/strict';
import { DEFAULT_DEVICE_FORM } from '../../../../../../packages/device/src/form';
import { copyPreparedDeviceSteps, prepareDeviceSteps, preparedDeviceBuffers, type PreparedDeviceData } from '../../../../../../packages/device/src/device-preparation-data';
import { drainSteps, yieldSteps } from '../../../../../../packages/device/src/sticker-computation-steps';
const original = drainSteps(prepareDeviceSteps(DEFAULT_DEVICE_FORM));
const position = original.front.attributes['position']; assert(position);
const normal = original.front.attributes['normal']; assert(normal);
const shared = new ArrayBuffer(256); new Uint8Array(shared).forEach((_, index, array) => {array[index] = index % 127;});
const source: PreparedDeviceData = {...original, front: {...original.front,
  attributes: {...original.front.attributes, position: {...position, array: new Float32Array(shared, 16, 6)}, normal: {...normal, array: new Float32Array(shared, 40, 6)}},
  index: new Uint16Array(shared, 128, 3)}, textures: {...original.textures, noise: {...original.textures.noise, data: new Uint8Array(shared, 136, 4)}},
  backplatePixels: new Uint8ClampedArray(shared, 140, 4)};
const copy = drainSteps(copyPreparedDeviceSteps(source));
assert.deepEqual(copy, source);
const copiedPosition = copy.front.attributes['position'], copiedNormal = copy.front.attributes['normal']; assert(copiedPosition && copiedNormal && copy.front.index);
assert.notEqual(copiedPosition.array.buffer, shared); assert.equal(copiedPosition.array.byteOffset, 16);
assert.equal(copiedNormal.array.buffer, copiedPosition.array.buffer); assert.equal(copy.front.index.buffer, copiedPosition.array.buffer);
assert.equal(copy.textures.noise.data.buffer, copiedPosition.array.buffer); assert.equal(copy.backplatePixels.buffer, copiedPosition.array.buffer);
assert.equal(copy.front.index.byteOffset, 128); assert.equal(copy.textures.noise.data.byteOffset, 136); assert.equal(copy.backplatePixels.byteOffset, 140);
const bytes = preparedDeviceBuffers(source).map(buffer => buffer.byteLength);
const abort = new AbortController(); abort.abort(); await assert.rejects(yieldSteps(copyPreparedDeviceSteps(source), abort.signal));
assert.deepEqual(preparedDeviceBuffers(source).map(buffer => buffer.byteLength), bytes);
await Bun.write(new URL('./reviewer-copy.json', import.meta.url), JSON.stringify({exactMetadataAndBytes: true, sharedBufferIdentity: true,
  typedOffsetsAndLengths: true, privateBufferOwnership: true, initialCancellationPreservesSource: true, browserTimingClaim: false}, null, 2) + '\n');
console.log('Exact offset/shared-buffer copy checks passed');
