import { mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { BufferGeometry, Matrix4, PerspectiveCamera } from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import { createStickerWrapSurface } from '../../../../../../packages/device/src/sticker-wrap';
import { DEFAULT_DEVICE_FORM } from '../../../../../../packages/device/src/form';
import { drainSteps, yieldSteps } from '../../../../../../packages/device/src/sticker-computation-steps';
import { computeStickerTransaction } from '../../../../../../packages/device/src/sticker-transaction-computation';
import { restoreShell, transferShell } from '../../../../../../packages/device/src/immutable-shell-transfer';
import type { StickerTransactionRequest, StickerTransactionResponse } from '../../../../../../packages/device/src/sticker-transaction-data';

const baseline = 'ebebb32d0b7f0b30b7e41b81778293d6b7d44405';
const temporary = mkdtempSync(join(tmpdir(), 'webpod-sticker-parity-'));
execFileSync('tar', ['-x', '-C', temporary], { input: execFileSync('git', ['archive', baseline, 'packages/device/src'], { maxBuffer: 32 * 1024 * 1024 }) });
symlinkSync(resolve('packages/device/node_modules'), join(temporary, 'packages/device/node_modules'));
const previousAlpha: typeof import('../../../../../../packages/device/src/sticker-alpha') = await import(join(temporary, 'packages/device/src/sticker-alpha.ts'));
const previousSurface: typeof import('../../../../../../packages/device/src/sticker-surface') = await import(join(temporary, 'packages/device/src/sticker-surface.ts'));
const previousFit: typeof import('../../../../../../packages/device/src/sticker-drop-fit') = await import(join(temporary, 'packages/device/src/sticker-drop-fit.ts'));
const art = { id: 'transaction-proof', url: 'proof', width: 96, height: 128, visibleBounds: [0, 0, 96, 128] as const };
const placement = { stickerId: art.id, surface: 'back' as const, x: .53, y: .48, width: .2, rotationDeg: 17, wear: .4 };
const form = DEFAULT_DEVICE_FORM;
const rear = new BufferGeometry();
const source = previousSurface.createStickerSurfaceGeometry(art, placement, rear, createStickerWrapSurface(form, []));
const mask = { width: 96, height: 128, pixels: Uint8Array.from({ length: 96 * 128 }, (_, index) => index % 96 > 4 && index % 96 < 92 && index > 96 * 4 && index < 96 * 124 ? 255 : 0) };
const camera = new PerspectiveCamera(30, 1, 1, 4000); camera.position.set(0, 0, 1200); camera.updateMatrixWorld();
const world = new Matrix4().makeRotationY(Math.PI);
const requests: StickerTransactionRequest[] = [
  { kind: 'surface', art, placement, form },
  { kind: 'damage', artworkKey: 'proof:1', stickerId: art.id, mask, surface: { normals: Float32Array.from(source.getAttribute('normal').array), uv: Float32Array.from(source.getAttribute('uv').array) } },
  { kind: 'fit', art, placement, form, grabbedUv: [.5, .5], screen: { x: 200, y: 300 }, canvas: { left: 0, top: 0, width: 440, height: 956 }, world: world.toArray(), cameraWorld: camera.matrixWorld.toArray(), cameraProjection: camera.projectionMatrix.toArray() },
];
function equal(actual: unknown, expected: unknown, path = 'result'): void {
  if (ArrayBuffer.isView(actual) && ArrayBuffer.isView(expected)) {
    const a = new Uint8Array(actual.buffer, actual.byteOffset, actual.byteLength), b = new Uint8Array(expected.buffer, expected.byteOffset, expected.byteLength);
    if (a.length !== b.length || !a.every((value, index) => value === b[index])) throw new Error(`Byte mismatch ${path}`);
    return;
  }
  if (actual && expected && typeof actual === 'object' && typeof expected === 'object') {
    if (Object.keys(actual).length !== Object.keys(expected).length) throw new Error(`Shape mismatch ${path}`);
    for (const key of Object.keys(actual)) equal(Reflect.get(actual, key), Reflect.get(expected, key), `${path}.${key}`);
    return;
  }
  if (actual !== expected) throw new Error(`Value mismatch ${path}`);
}
const checks: string[] = [];
for (const input of requests) {
  const result = drainSteps(computeStickerTransaction(input));
  equal(await yieldSteps(computeStickerTransaction(input), new AbortController().signal), result);
  const worker = new Worker(new URL('../../../../../../packages/device/src/sticker-transaction-worker.ts', import.meta.url).href);
  try {
    const response = await new Promise<StickerTransactionResponse>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Worker parity timeout')), 15000);
      worker.onmessage = (event: MessageEvent<StickerTransactionResponse>) => { clearTimeout(timeout); resolve(event.data); };
      worker.onerror = () => { clearTimeout(timeout); reject(new Error('Worker failed')); };
      worker.postMessage({ version: 1, id: 1, input });
    });
    if ('error' in response) throw new Error(response.error);
    equal(response.result, result);
  } finally { worker.terminate(); }
  if (result.kind === 'surface') { equal(result.geometry, transferShell(source)); restoreShell(result.geometry).dispose(); }
  if (result.kind === 'damage') equal(result.field, previousAlpha.createSurfaceStickerDamage(previousAlpha.createStickerDamageField(mask, art.id), source));
  if (result.kind === 'fit') equal(result.placement, previousFit.fitStickerDrop(art, placement, [.5, .5], { x: 200, y: 300 }, { left: 0, top: 0, width: 440, height: 956 }, world, camera, createStickerWrapSurface(form, [])));
  checks.push(`${input.kind}: exact native-worker/cooperative/synchronous bytes`);
}
source.dispose(); rear.dispose(); rmSync(temporary, { recursive: true, force: true });
const evidence = { ok: true, baseline, checks, limitation: 'Pinned original implementation and local Bun worker; not browser timing.' };
await Bun.write(new URL('./parity.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');
console.log(evidence);
