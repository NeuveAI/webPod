import assert from 'node:assert/strict';
import { createRenderBackendOwner } from '../../../../../../packages/device/src/render-backend-services.ts';
import { WebGPUBackend } from '../../../../../../packages/device/node_modules/three/build/three.webgpu.js';
const results = [];
const tick = () => new Promise(resolve => globalThis.setTimeout(resolve, 0));
function fixture() {
  let resolve, reject, rendererReleases = 0, backendReleases = 0;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  const backend = new WebGPUBackend(); backend.dispose = () => backendReleases++;
  const originalDeviceLost = () => {};
  const renderer = { backend, onDeviceLost: originalDeviceLost, init: () => promise, hasFeature: () => true, dispose: () => rendererReleases++, compileAsync: () => Promise.resolve() };
  return { renderer, originalDeviceLost, resolve, reject, counts: () => ({ rendererReleases, backendReleases }), owner: createRenderBackendOwner({ kind: 'webgpu', renderer }) };
}
{
  const f = fixture(), abort = new globalThis.AbortController();
  const pending = f.owner.initialize(abort.signal); abort.abort();
  await assert.rejects(pending); assert.deepEqual(f.counts(), { rendererReleases: 0, backendReleases: 0 });
  f.resolve(); await tick(); assert.equal(f.owner.isReady(), false); assert.equal(f.counts().rendererReleases, 1);
  f.owner.dispose(); assert.equal(f.counts().rendererReleases, 1); results.push('late-success-after-abort-disposed-once');
}
{
  const f = fixture(), abort = new globalThis.AbortController();
  const pending = f.owner.initialize(abort.signal); abort.abort(); await assert.rejects(pending);
  f.reject(new Error('failed init')); await tick(); assert.deepEqual(f.counts(), { rendererReleases: 0, backendReleases: 1 });
  results.push('late-init-rejection-disposes-backend-without-reentrant-renderer-dispose');
}
{
  const f = fixture(), pending = f.owner.initialize(new globalThis.AbortController().signal, 1); await assert.rejects(pending, /timed out/);
  f.resolve(); await tick(); assert.equal(f.counts().rendererReleases, 1); assert.equal(f.owner.isReady(), false); results.push('timeout-then-success-cannot-publish-ready');
}
{
  const f = fixture(); f.renderer.hasFeature = () => false;
  const pending = f.owner.initialize(new globalThis.AbortController().signal); f.resolve(); await assert.rejects(pending, /MSAA/);
  assert.equal(f.counts().rendererReleases, 1); results.push('compatibility-mode-retires-quality-incomplete-renderer');
}
{
  const f = fixture(), original = f.renderer.backend;
  // Simulate installed fallback replacing the originally captured native backend.
  assert.equal(f.renderer.backend, original);
  const pending = f.owner.initialize(new globalThis.AbortController().signal);
  f.renderer.backend = { dispose() {} }; f.resolve(); await assert.rejects(pending, /fallback/);
  assert.deepEqual(f.counts(), { rendererReleases: 1, backendReleases: 1 }); results.push('native-fallback-releases-both-generations');
}
{
  const f = fixture(), signal = new globalThis.AbortController(); f.resolve(); await f.owner.initialize(signal.signal);
  let complete; f.renderer.compileAsync = () => new Promise(resolve => complete = resolve);
  const pending = f.owner.compile({}, {}, {}, signal.signal); signal.abort(); await assert.rejects(pending);
  complete(); await tick(); assert.equal(f.counts().rendererReleases, 1); assert.equal(f.owner.isReady(), false); results.push('late-compile-after-abort-cannot-revive-owner');
}
{
  const f = fixture(); f.resolve(); await f.owner.initialize(new globalThis.AbortController().signal);
  assert.equal(f.owner.isInitialized(), true); assert.equal(f.owner.isReady(), false);
  const completions = []; f.renderer.compileAsync = () => new Promise(resolve => completions.push(resolve));
  const first = f.owner.compile({}, {}, {}, new globalThis.AbortController().signal);
  const second = f.owner.compile({}, {}, {}, new globalThis.AbortController().signal);
  completions[1](); await second; assert.equal(f.owner.isReady(), true);
  completions[0](); await assert.rejects(first, /superseded/); assert.equal(f.owner.isReady(), true);
  const third = f.owner.compile({}, {}, {}, new globalThis.AbortController().signal); assert.equal(f.owner.isReady(), false);
  completions[2](); await third; assert.equal(f.owner.isReady(), true);
  f.owner.dispose(); assert.equal(f.owner.isReady(), false); results.push('only-latest-complete-material-generation-is-ready');
}
{
  let releases = 0;
  const renderer = { dispose: () => releases++, compileAsync() { throw new Error('synchronous shader failure'); } };
  const owner = createRenderBackendOwner({ kind: 'webgl', renderer });
  await assert.rejects(owner.compile({}, {}, {}, new globalThis.AbortController().signal), /synchronous shader failure/);
  assert.equal(releases, 1); assert.equal(owner.isInitialized(), false); assert.equal(owner.isReady(), false);
  owner.dispose(); assert.equal(releases, 1); results.push('synchronous-GL-compile-throw-retires-and-disposes-once');
}
{
  const f = fixture(), originalHandler = f.originalDeviceLost;
  f.resolve(); await f.owner.initialize(new globalThis.AbortController().signal);
  await f.owner.compile({}, {}, {}, new globalThis.AbortController().signal); assert.equal(f.owner.isReady(), true);
  f.renderer.onDeviceLost({ api: 'WebGPU', message: 'diagnostic loss', reason: 'unknown' });
  assert.equal(f.owner.isReady(), false); assert.equal(f.owner.isInitialized(), false); assert.equal(f.counts().rendererReleases, 1);
  assert.equal(f.renderer.onDeviceLost, originalHandler); results.push('native-device-loss-retires-ready-owner-and-restores-handler');
}
globalThis.console.log(JSON.stringify({ ok: true, checks: results }, null, 2));
