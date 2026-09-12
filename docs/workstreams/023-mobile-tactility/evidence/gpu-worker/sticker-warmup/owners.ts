import assert from 'node:assert/strict';
import { mock } from 'bun:test';
import { GlobalRegistrator } from '../../../../../../packages/composite/node_modules/@happy-dom/global-registrator';
import { Mesh, Texture } from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import type { DeviceStickerScene, StickerArtwork } from '../../../../../../packages/device/src/sticker-contract';
import type { DeviceFontBitmap } from '../../../../../../packages/device/src/device-font-assets';
import type { NativePackFrame } from '../../../../../../packages/composite/src/native-pack-resources';
GlobalRegistrator.register();
// Only browser decode/raster/bitmap are controlled. Geometry, damage, canonical
// workers, private MessagePorts and actual node-material assembly are real.
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {value: () => ({drawImage() {}, getImageData() {return {data: new Uint8ClampedArray(8 * 8 * 4).fill(255)};}})});
let textureOwners = 0, bitmapCloses = 0, prepares = 0;
class Bitmap implements ImageBitmap {readonly width = 8; readonly height = 8; close() {bitmapCloses++;}}
mock.module('../../../../../../packages/composite/src/native-sticker-resources', () => ({
  async acquireArtwork(_art: StickerArtwork, signal: AbortSignal) {
    signal.throwIfAborted(); prepares++; textureOwners++;
    const image = document.createElement('img');
    for (const [key, value] of Object.entries({complete: true, naturalWidth: 8, naturalHeight: 8})) Object.defineProperty(image, key, {value});
    const texture = new Texture(image); let live = true;
    return {texture, release() {if (live) {live = false; textureOwners--; texture.dispose();}}};
  },
  async snapshotArtwork(texture: Texture, signal: AbortSignal): Promise<DeviceFontBitmap> {
    signal.throwIfAborted();
    return {image: new Bitmap(), colorSpace: texture.colorSpace, wrapS: texture.wrapS, wrapT: texture.wrapT, minFilter: texture.minFilter, magFilter: texture.magFilter, generateMipmaps: texture.generateMipmaps, anisotropy: texture.anisotropy};
  },
}));
const {createNativeStickerWarmup} = await import('../../../../../../packages/composite/src/native-sticker-warmup');
const {prepareStickerWarmup} = await import('../../../../../../packages/device/src/sticker-warmup-renderer');
const {inspectPaperPool, releaseUnusedPaperPackGeometry} = await import('../../../../../../packages/device/src/sticker-paper-pool');
const {inspectStickerTransactions, releaseUnusedStickerTransactions} = await import('../../../../../../packages/device/src/sticker-transaction-broker');
const events: string[] = [], messages: {sequence: number; frame: NativePackFrame}[] = [];
const warm = createNativeStickerWarmup({send(sequence, frame) {messages.push({sequence, frame});}, fail(error) {throw error;}});
const art: StickerArtwork = {id: 'proof', url: 'proof-art', width: 8, height: 8, visibleBounds: [0, 0, 1, 1]};
const scene: DeviceStickerScene = {assets: [art], prepareIds: [art.id], placements: [], pack: null, onPrepared(ids) {events.push(`prepared:${ids.join(',')}`);}, onArtworkReady(id) {events.push(`ready:${id}`);}};
async function next() {const end = Date.now() + 15_000; while (!messages.length && Date.now() < end) await Bun.sleep(5); const message = messages.shift(); assert(message, 'bounded warmup delivery'); return message;}
warm.update(scene); warm.update({...scene, pack: null});
const first = await next(); assert.equal(prepares, 1); assert.equal(first.frame.prints.length, 3); assert.equal(first.frame.geometry.length, 1); assert.equal(first.frame.damage.length, 1); assert.equal(first.frame.artworks.length, 1);
assert.deepEqual(events, ['prepared:']);
const environment = new Texture();
let owner = await prepareStickerWarmup(first.frame, environment, new AbortController().signal);
let meshes = 0; owner.root.traverse(object => {assert.equal(object.visible, true); if (object instanceof Mesh) {meshes++; assert.equal(object.frustumCulled, false); assert(object.geometry.getAttribute('uv')); assert(object.geometry.getAttribute('normal'));}});
assert.equal(meshes, 6); assert.equal(owner.root.parent, null);
assert.equal(inspectPaperPool().privateOwners, 1); assert.equal(inspectStickerTransactions().privateOwners, 1);
warm.ack(first.sequence - 1); assert.deepEqual(events, ['prepared:']);
warm.ack(first.sequence); assert.deepEqual(events, ['prepared:', 'ready:proof', 'prepared:proof']);
for (let index = 0; index < 25; index++) warm.update({...scene, onPrepared() {}});
await Bun.sleep(10); assert.equal(prepares, 1); assert.equal(messages.length, 0);
const replacement = {...scene, assets: [{...art, url: 'replacement-art'}]};
warm.update(replacement); const barrier = await next(); assert.equal(barrier.frame.prints.length, 0); assert.equal(prepares, 1); assert.equal(textureOwners, 0); assert.equal(inspectStickerTransactions().privateOwners, 1);
const empty = await prepareStickerWarmup(barrier.frame, environment, new AbortController().signal); owner.dispose(); empty.dispose(); warm.ack(barrier.sequence);
const second = await next(); assert.equal(prepares, 2); assert.equal(textureOwners, 0, 'compile-only queries retired before frame submission');
owner = await prepareStickerWarmup(second.frame, environment, new AbortController().signal); warm.ack(second.sequence);
warm.dispose(); assert.equal(textureOwners, 0, 'query-only leases retired after capture'); assert.equal(inspectStickerTransactions().privateOwners, 1, 'private owners retained until renderer retirement'); owner.dispose(); warm.rendererRetired(); warm.rendererRetired(); assert.equal(textureOwners, 0);
const {preparePackGeometry} = await import('../../../../../../packages/device/src/sticker-pack-resources');
const {preparePrint} = await import('../../../../../../packages/device/src/sticker-prepared-damage');
const {getPreparedStickerContour} = await import('../../../../../../packages/device/src/sticker-contour-preparation-data');
const geometryOwner = await preparePackGeometry({kind: 'parked-print', art, width: 1}, new AbortController().signal);
const geometry = geometryOwner.parts['geometry']; assert(geometry);
const image = document.createElement('img'); for (const [key, value] of Object.entries({complete: true, naturalWidth: 8, naturalHeight: 8})) Object.defineProperty(image, key, {value});
const texture = new Texture(image), input = {texture, id: art.id, geometry, wearGeometry: geometry, wear: 0};
const exact = await preparePrint(input, new AbortController().signal);
const shaderOnly = await preparePrint(input, new AbortController().signal, {prepareContour: false});
assert.equal(exact.damage.field, shaderOnly.damage.field, 'same canonical damage result, not duplicate computation');
assert.deepEqual(exact.geometry.getAttribute('position').array, shaderOnly.geometry.getAttribute('position').array);
assert(getPreparedStickerContour(exact.geometry, exact.damage.field, 0));
assert.equal(getPreparedStickerContour(shaderOnly.geometry, shaderOnly.damage.field, 0), undefined);
exact.release(); shaderOnly.release(); geometryOwner.release(); texture.dispose();
releaseUnusedPaperPackGeometry(); releaseUnusedStickerTransactions(); await Bun.sleep(30);
assert.equal(inspectPaperPool().accountedBytes, 0); assert.equal(inspectStickerTransactions().accountedBytes, 0); assert.equal(bitmapCloses, 2); environment.dispose();
const result = {provenance: 'Bun real geometry/damage workers and private MessagePorts; controlled browser decode/raster/bitmap, manual compile ACK. No WebGPU compile or native ImageBitmap-transfer claim.', checks: 14, artworkPreparations: prepares, variantsPerArtwork: 3, materialMeshes: meshes, bitmapCloses, finalPaper: inspectPaperPool(), finalTransactions: inspectStickerTransactions()};
await Bun.write(new URL('./owners.json', import.meta.url), JSON.stringify(result, null, 2) + '\n'); console.log(result);
await GlobalRegistrator.unregister();
