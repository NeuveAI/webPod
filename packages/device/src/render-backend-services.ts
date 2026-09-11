import { PMREMGenerator as GlPMREMGenerator, type Camera, type Object3D, type Scene, type WebGLRenderer } from 'three';
import { PMREMGenerator as NodePMREMGenerator, WebGPUBackend, type WebGPURenderer } from 'three/webgpu';
import { createProductStudioEnvironment } from './product-studio';

export type DeviceRenderBackend = { readonly kind: 'webgl'; readonly renderer: WebGLRenderer } | { readonly kind: 'webgpu'; readonly renderer: WebGPURenderer };

/** Concrete installed backends implement dispose(), omitted from the pinned
 * @types Backend declaration. Validate that exact source method at runtime;
 * do not assert an incompatible renderer type. Only used after init settles,
 * because Renderer.dispose() would otherwise reenter initialization itself. */
function releaseUninitializedBackend(backend: object | null) {
  if (backend === null) return;
  const release: unknown = Reflect.get(backend, 'dispose');
  if (typeof release !== 'function') throw new Error('Installed renderer backend has no disposal method');
  release.call(backend);
}

/** Renderer generation owner. Failure/cancellation retires the entire backend,
 * never just its ready flag. A late async initialization disposes immediately
 * after it settles; no stale compile completion can publish a usable owner.
 * isInitialized admits a backend; isReady admits only the most recent complete
 * scene compilation. Call compile again after changing the scene/material graph.
 * Worker termination remains the final boundary for a driver that never settles.
 */
export function createRenderBackendOwner(backend: DeviceRenderBackend) {
  let retired = false, initialized = backend.kind === 'webgl', released = false;
  let accepted = backend.kind === 'webgl', prepared = false, compilationRevision = 0;
  let initialization: Promise<void> | null = null;
  let initializationSettled = backend.kind === 'webgl';
  const originalBackend = backend.kind === 'webgpu' ? backend.renderer.backend : null;
  const priorDeviceLost = backend.kind === 'webgpu' ? backend.renderer.onDeviceLost : null;
  const onDeviceLost: WebGPURenderer['onDeviceLost'] = (info) => {
    dispose();
    if (backend.kind === 'webgpu') priorDeviceLost?.call(backend.renderer, info);
  };
  const release = () => {
    if (released || !initializationSettled) return;
    released = true;
    if (backend.kind === 'webgpu' && originalBackend !== backend.renderer.backend) releaseUninitializedBackend(originalBackend);
    if (initialized) backend.renderer.dispose();
    else if (backend.kind === 'webgpu') releaseUninitializedBackend(backend.renderer.backend);
  };
  const dispose = () => {
    retired = true; prepared = false; compilationRevision++;
    if (backend.kind === 'webgpu' && priorDeviceLost !== null && backend.renderer.onDeviceLost === onDeviceLost) backend.renderer.onDeviceLost = priorDeviceLost;
    release();
  };
  if (backend.kind === 'webgpu') backend.renderer.onDeviceLost = onDeviceLost;
  const assertLive = () => { if (retired) throw new Error('Renderer generation has retired'); };
  const bounded = async (work: () => Promise<unknown>, signal: AbortSignal, timeoutMs: number) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort = () => {};
    const cancelled = new Promise<never>((_, reject) => {
      abort = () => { dispose(); reject(signal.reason ?? new Error('Renderer preparation cancelled')); };
      signal.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => { dispose(); reject(new Error('Renderer preparation timed out')); }, timeoutMs);
      if (signal.aborted) abort();
    });
    try { await Promise.race([work(), cancelled]); assertLive(); }
    catch (error) { dispose(); throw error; }
    finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
  };
  return {
    backend,
    async initialize(signal: AbortSignal, timeoutMs = 10000) {
      assertLive(); signal.throwIfAborted();
      initialization ??= backend.kind === 'webgpu' ? backend.renderer.init().then(() => {
        initialized = true;
        if (!(backend.renderer.backend instanceof WebGPUBackend)) throw new Error('Native WebGPU initialization selected a fallback backend');
        if (!backend.renderer.hasFeature('core-features-and-limits')) throw new Error('WebGPU compatibility mode cannot preserve the authored MSAA quality');
        accepted = true;
      }).finally(() => { initializationSettled = true; if (retired) release(); }) : Promise.resolve();
      await bounded(() => initialization ?? Promise.resolve(), signal, timeoutMs);
    },
    async compile(root: Object3D, camera: Camera, targetScene: Scene, signal: AbortSignal, timeoutMs = 10000) {
      assertLive(); signal.throwIfAborted(); if (!accepted) throw new Error('Initialize renderer before material preparation');
      prepared = false;
      const revision = ++compilationRevision;
      await bounded(() => backend.renderer.compileAsync(root, camera, targetScene), signal, timeoutMs);
      if (revision !== compilationRevision) throw new Error('Material compilation was superseded');
      prepared = true;
    },
    dispose,
    isInitialized: () => accepted && !retired,
    isReady: () => prepared && !retired,
  };
}

/** Build the same two authored studio rooms using the selected renderer's PMREM
 * implementation. The caller restores scene bindings before disposing this owner.
 */
export function createBackendStudioMaps(backend: DeviceRenderBackend, sigma: number) {
  const room = createProductStudioEnvironment(), screenRoom = createProductStudioEnvironment(true);
  const generator = backend.kind === 'webgl' ? new GlPMREMGenerator(backend.renderer) : new NodePMREMGenerator(backend.renderer);
  let body: ReturnType<typeof generator.fromScene> | undefined, screen: ReturnType<typeof generator.fromScene> | undefined;
  try {
    body = generator.fromScene(room.scene, sigma);
    screen = generator.fromScene(screenRoom.scene, sigma);
    return { texture: body.texture, screenTexture: screen.texture, dispose() { body?.dispose(); screen?.dispose(); generator.dispose(); room.dispose(); screenRoom.dispose(); } };
  } catch (error) { body?.dispose(); screen?.dispose(); generator.dispose(); room.dispose(); screenRoom.dispose(); throw error; }
}
