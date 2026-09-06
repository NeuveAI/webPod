import { Material, Mesh, REVISION, type Camera, type Object3D, type Scene, type WebGLRenderer } from 'three';

/** Narrow port keeps the pinned renderer-property boundary testable without a GPU. */
interface PreparationRenderer {
  readonly compile: WebGLRenderer['compile'];
  readonly properties: { get(material: Material): unknown };
  readonly domElement: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
  getContext(): { isContextLost(): boolean };
}
interface ReadyProgram { isReady(): boolean }

/** Three185.1 exposes this internally, but its public compileAsync cannot abort.
 * Validate once immediately after compile; never re-read disposed material state
 * from a timer. The explicit revision guard makes upgrades fail closed. */
function capturedProgram(properties: unknown): ReadyProgram {
  if (properties === null || typeof properties !== 'object' || !('currentProgram' in properties)) throw new Error('Sticker program metadata is unavailable');
  const program = properties.currentProgram;
  if (program === null || typeof program !== 'object' || !('isReady' in program) || typeof program.isReady !== 'function') throw new Error('Sticker program readiness is unsupported');
  const isReady = program.isReady;
  return { isReady: () => Reflect.apply(isReady, program, []) === true };
}

/** Prepares exact sticker shader variants without borrowing their disposal lifetime.
 *
 * Success retains cloned program-owning materials until signal abort/context loss;
 * disposing the sole owners on success would evict the warmed GPU programs. Caller
 * MUST abort even an already-ready preparation when its subscription ends. Geometry
 * and maps are borrowed for synchronous compile and are never disposed here.
 *
 * Uses pinned Three185.1 compile + validated program readiness instead of its
 * uncancellable compileAsync timer. Without KHR_parallel_shader_compile, Three's
 * readiness check is immediate: this does not certify deferred driver work is done.
 * The deadline bounds pending polling; no timer remains after success or cancellation.
 */
export function prepareStickerPrograms(renderer: PreparationRenderer, root: Object3D, camera: Camera, targetScene: Scene, signal: AbortSignal, timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (REVISION !== '185') { reject(new Error(`Sticker preparation requires Three185; received ${REVISION}`)); return; }
    if (!(timeoutMs > 0) || !Number.isFinite(timeoutMs)) { reject(new RangeError('Sticker preparation deadline must be positive and finite')); return; }
    if (signal.aborted) { reject(new DOMException('Sticker preparation cancelled', 'AbortError')); return; }
    const owned = new Set<Material>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let busy = true;
    let released = false;
    let settled = false;
    let cancellation: Error | undefined;
    const deadline = performance.now() + timeoutMs;
    const release = (reason: unknown): void => {
      if (released) return;
      released = true;
      clearTimeout(timer); timer = undefined;
      signal.removeEventListener('abort', abort);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      for (const material of owned) { try { material.dispose(); } catch { /* Continue releasing the other owned program references. */ } }
      owned.clear();
      if (!settled) { settled = true; reject(reason); }
    };
    const cancel = (reason: Error): void => {
      cancellation ??= reason;
      // An abort raised synchronously by compile/isReady must not dispose their
      // resources until that call returns. Browser events normally arrive later.
      if (!busy) release(cancellation);
    };
    const abort = (): void => cancel(new DOMException('Sticker preparation cancelled', 'AbortError'));
    const contextLost = (): void => cancel(new DOMException('Sticker preparation context lost', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    try {
      if (renderer.getContext().isContextLost()) { busy = false; contextLost(); return; }
      const copy = root.clone(true);
      const clones = new Map<Material, Material>();
      copy.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const clone = (material: Material): Material => {
          let result = clones.get(material);
          if (result === undefined) {
            result = material.clone();
            // Material.copy intentionally omits these callbacks. They define the
            // locked/vacant/underside variants and must keep clone `this` binding.
            result.onBeforeCompile = material.onBeforeCompile;
            result.customProgramCacheKey = material.customProgramCacheKey;
            clones.set(material, result); owned.add(result);
          }
          return result;
        };
        object.material = Array.isArray(object.material) ? object.material.map(clone) : clone(object.material);
      });
      if (owned.size === 0) throw new Error('No sticker materials are available to prepare');
      const materials = renderer.compile(copy, camera, targetScene);
      if (cancellation !== undefined) { busy = false; release(cancellation); return; }
      const programs: ReadyProgram[] = [];
      for (const material of owned) {
        if (!materials.has(material)) throw new Error('Sticker compilation omitted an active material');
        programs.push(capturedProgram(renderer.properties.get(material)));
      }
      // Only material/program ownership remains during polling. The copied object
      // hierarchy, original-material map, and borrowed geometry need no lifetime lease.
      copy.clear(); clones.clear();
      const poll = (): void => {
        timer = undefined;
        if (released) return;
        busy = true;
        let failure: { readonly error: unknown } | undefined;
        let complete = false;
        try {
          if (renderer.getContext().isContextLost()) contextLost();
          if (cancellation === undefined) {
            if (performance.now() >= deadline) throw new Error('Sticker program preparation timed out');
            complete = programs.every((program) => cancellation === undefined && program.isReady());
          }
        } catch (error) { failure = { error }; }
        busy = false;
        if (cancellation !== undefined) { release(cancellation); return; }
        if (failure !== undefined) { release(failure.error); return; }
        if (complete) { settled = true; resolve(); return; }
        timer = setTimeout(poll, Math.min(10, Math.max(0, deadline - performance.now())));
      };
      busy = false;
      poll();
    } catch (error) { busy = false; release(cancellation ?? error); }
  });
}
