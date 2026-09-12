import { deepStrictEqual, rejects } from 'node:assert/strict';
import { BoxGeometry, PlaneGeometry, Matrix4 } from '../../../../../packages/device/node_modules/three';
import { createStickerCollision } from '../../../../../packages/device/src/sticker-collision';
import { prepareCollisionCooperatively } from '../../../../../packages/device/src/sticker-collision-cooperative';
import { prepareCollisionInWorker } from '../../../../../packages/device/src/sticker-collision-preparation';

const plane = new PlaneGeometry(300, 500, 32, 32), box = new BoxGeometry(40, 20, 15, 4, 4, 4);
const faces = [
  { geometry: plane, transform: new Matrix4().makeRotationX(.2), source: 'front', kind: 'surface' as const },
  { geometry: box, transform: new Matrix4().makeTranslation(20, 10, -5), source: 'hardware', kind: 'surface' as const, adhesiveSupport: true },
];
const original = createStickerCollision(faces), expected = original.snapshot();
let yields = 0;
const timer = setInterval(() => yields++, 0);
const actual = await prepareCollisionCooperatively(faces, new AbortController().signal);
clearInterval(timer);
deepStrictEqual(actual, expected);
const empty = createStickerCollision([]);
deepStrictEqual(await prepareCollisionCooperatively([], new AbortController().signal), empty.snapshot());
const abort = new AbortController(); abort.abort();
await rejects(prepareCollisionCooperatively(faces, abort.signal), { name: 'AbortError' });
const during = new AbortController();
const cancelled = prepareCollisionCooperatively(faces, during.signal);
setTimeout(() => during.abort(), 0);
await rejects(cancelled, { name: 'AbortError' });
const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
Object.defineProperty(globalThis, 'Worker', { configurable: true, value: class { constructor() { throw new Error('Unavailable'); } } });
try { deepStrictEqual(await prepareCollisionInWorker(faces, new AbortController().signal), expected); }
finally { if (descriptor) Object.defineProperty(globalThis, 'Worker', descriptor); else Reflect.deleteProperty(globalThis, 'Worker'); }
console.log(JSON.stringify({ exactSnapshotParity: true, triangleCount: expected.provenance.length, nodeCount: expected.nodeCount, timerTurnsDuringBuild: yields, emptyParity: true, abortBeforeAndDuring: true, workerUnavailableRecovery: true }, null, 2));
original.dispose(); empty.dispose(); plane.dispose(); box.dispose();
