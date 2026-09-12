import { carryContextSource, copyCarryContextSteps, MAX_CARRY_CONTEXT_BYTES } from './sticker-carry-context';
import { createCarryRenderResources, type CarryRenderStamp, type CarryRenderAck } from './sticker-carry-render-resources';
import { setStickerBoundsIndex } from './sticker-bounds-index';
import { createCarryWearCache } from './sticker-carry-wear';
import { computeStickerCarrySteps } from './sticker-carry-computation';
import { createStickerSurfaceGeometrySteps } from './sticker-surface';
import { createStickerCollision } from './sticker-collision';
import { stickerWrapSurface } from './sticker-wrap';
import { yieldSteps } from './sticker-computation-steps';
import type { BufferGeometry } from 'three';
import type { CarryInput } from './sticker-carry-computation';
import type { CarryWorkerMessage, CarryWorkerResult } from './sticker-carry-worker';
import { restorePaperGeometry } from './sticker-paper-transfer';
import type { createStickerVisibility } from './sticker-visibility';

type CarryVisibility = Pick<ReturnType<typeof createStickerVisibility>, 'ready' | 'revision' | 'snapshot'>;
export interface CarryFrame { readonly renderStamp?: CarryRenderStamp; readonly geometry: BufferGeometry; readonly wearGeometry: BufferGeometry | null; readonly input: CarryInput; readonly pointerError: number | null; readonly releaseWear: () => void }
interface CarrySnapshot { readonly frame: CarryFrame | null; readonly error: string | null }
interface CarryJob { readonly id: number; readonly input: CarryInput; readonly owner: string }
let nextOwnerId = 0;
const EMPTY: CarrySnapshot = { frame: null, error: null };
const release = (frame: CarryFrame) => { frame.geometry.dispose(); frame.releaseWear(); };
const owner = (input: CarryInput) => JSON.stringify([input.pack.computationEpoch, input.art, input.pack.sourcePlacement ?? null, input.pack.sourceAnchor ?? null]);

const renderOwner = (input: CarryInput) => JSON.stringify([owner(input), input.pack.landing > 0 ? input.pack.placement : null]);

/**
 * One atomic deformation job plus one latest pending pose. The worker retains
 * immutable assembly/source surfaces; only scalar pose/matrix snapshots repeat.
 * Completed poses publish monotonically within one gesture owner; changed owners
 * and assemblies reject old results. The final pending pose is always computed.
 */
export function createCarryPreparation(options: { readonly renderer?: boolean } = {}) {
  const ownerId = ++nextOwnerId; let workerGeneration = 0, stopping = false; let latestRenderOwner: string | null = null;
  const framePins = new Map<CarryFrame, { count: number; retired: boolean }>();
  const renderResources = createCarryRenderResources((message, transfer = []) => {
    if (!worker) {if (message.type === 'carry-render-copy') throw Error('Carry producer unavailable'); return;}
    worker.postMessage(message, transfer);
  }, () => fail(), () => dispatch());
  const free = (frame: CarryFrame) => {
    if (frame.renderStamp) renderResources.releaseFrame(frame.renderStamp);
    const pin = framePins.get(frame);
    if (pin) {pin.retired = true; return;}
    release(frame);
  };
  const wearCache = createCarryWearCache();
  let worker: Worker | null = null, mounted = false, sequence = 0;
  let active: CarryJob | null = null, wanted: CarryJob | null = null;
  let rear: BufferGeometry | null = null, visibility: CarryVisibility | null = null, revision = -1;
  let fallback: AbortController | null = null, workerFailed = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let contextBytes = 0, primeWanted = false;
  // An aborted copy keeps its reservation until its generator actually unwinds.
  // dispatch cannot start another copy while this owner is non-null.
  let contextJob: { controller: AbortController; bytes: number } | null = null;
  let snapshot = EMPTY;
  const retired = new Set<CarryFrame>(), listeners = new Set<() => void>();
  const publish = (next: CarrySnapshot) => { if (snapshot.frame && snapshot.frame !== next.frame) retired.add(snapshot.frame); snapshot = next; for (const listener of listeners) listener(); };
  const stop = () => { stopping = true; primeWanted = false; contextJob?.controller.abort(); contextBytes = 0; clearTimeout(timeout); timeout = undefined; worker?.terminate(); worker = null; active = null; renderResources.retired(); wearCache.clear(); fallback?.abort(); fallback = null; stopping = false; };
  const fail = () => { stop(); workerFailed = true; if (options.renderer) { wanted = null; publish({...snapshot, error: 'Native carry producer unavailable'}); } else dispatch(); };
  const dispatch = (): void => {
    if (stopping || !mounted || document.hidden || active || (!wanted && !primeWanted) || !rear || !visibility?.ready) return;
    if (workerFailed && options.renderer) { wanted = null; return; }
    if (workerFailed) {
      if (!wanted) return;
      const job = wanted, assembly = rear, contact = visibility, expectedRevision = revision, controller = new AbortController(); fallback = controller; active = job;
      const prepare = async () => {
        let source: BufferGeometry | null = null, target: BufferGeometry | null = null;
        const borrowed = contact.snapshot();
        const collider = createStickerCollision([], borrowed);
        try {
          if (job.input.pack.sourcePlacement) source = await yieldSteps(createStickerSurfaceGeometrySteps(job.input.art, job.input.pack.sourcePlacement, assembly), controller.signal);
          if (job.input.pack.landing > 0 && job.input.pack.placement) target = await yieldSteps(createStickerSurfaceGeometrySteps(job.input.art, job.input.pack.placement, assembly), controller.signal);
          const result = await yieldSteps(computeStickerCarrySteps(job.input, assembly, source, target, collider), controller.signal);
          setStickerBoundsIndex(result.geometry, result.bounds);
          const wearGeometry = job.input.pack.landing > 0 ? target : source;
          if (wearGeometry === target) target = null; else source = null;
          const frame = { geometry: result.geometry, wearGeometry, input: job.input, pointerError: result.pointerError, releaseWear: () => wearGeometry?.dispose() };
          if (!mounted || controller.signal.aborted || !wanted || wanted.owner !== job.owner || !contact.ready || contact.revision !== expectedRevision) { release(frame); return; }
          if (wanted.id === job.id) wanted = null;
          publish({ frame, error: null });
        } finally { source?.dispose(); target?.dispose(); collider.dispose(); }
      };
      void prepare().catch(() => { if (!controller.signal.aborted) publish({ ...snapshot, error: 'Sticker deformation unavailable' }); }).finally(() => {
        if (fallback === controller) { fallback = null; active = null; if (!snapshot.error) dispatch(); }
      });
      return;
    }
    try {
      if (!worker) {
        if (contextJob) return;
        if (typeof Worker === 'undefined') { fail(); return; }
        const assembly = rear, contact = visibility, expectedRevision = revision;
        const source = carryContextSource(assembly, contact.snapshot(), stickerWrapSurface(assembly)?.form ?? null);
        if (contextBytes + source.bytes > MAX_CARRY_CONTEXT_BYTES) throw Error('Carry context byte capacity exceeded');
        const job = { controller: new AbortController(), bytes: source.bytes }; contextJob = job;
        // Initial task yield and bounded copy checkpoints protect even the first
        // cold request. New poses only replace wanted while context is pending.
        void yieldSteps(copyCarryContextSteps(source), job.controller.signal).then(prepared => {
          if (!mounted || document.hidden || job.controller.signal.aborted || rear !== assembly || visibility !== contact || !contact.ready || revision !== expectedRevision || contact.revision !== expectedRevision) return;
          try {
            workerGeneration++;
            worker = new Worker(new URL('./sticker-carry-worker.ts', import.meta.url), { type: 'module' });
            const instance = worker;
            const workerFailure = () => { if (worker === instance) fail(); };
            worker.onerror = workerFailure; worker.onmessageerror = workerFailure;
            worker.onmessage = ({ data }: MessageEvent<CarryWorkerResult | CarryRenderAck>) => {
              if (worker !== instance) return;
              if ('type' in data) {renderResources.acknowledge(data); return;}
              if (active?.id !== data.id) return;
              const completed = active; active = null; clearTimeout(timeout); timeout = undefined;
              if (!data.geometry || data.error) { fail(); return; }
              try {
                if (options.renderer) renderResources.complete(data.renderStamp, data.renderBytes);
                // Consume immutable payloads even when their pose belongs to an old
                // epoch: the same worker may reference that revision in its next job.
                wearCache.accept(data.wearRevision, data.wearGeometry);
                if (!wanted || completed.owner !== wanted.owner || !visibility?.ready || revision !== visibility.revision) { if (data.renderStamp) renderResources.releaseFrame(data.renderStamp); dispatch(); return; }
                const geometry = restorePaperGeometry(data.geometry);
                if (data.bounds) setStickerBoundsIndex(geometry, data.bounds);
                const wear = wearCache.retain();
                const frame = { renderStamp: data.renderStamp, geometry, wearGeometry: wear.geometry, releaseWear: wear.release, input: completed.input, pointerError: data.pointerError ?? null };
                if (wanted.id === completed.id) wanted = null;
                publish({ frame, error: null }); dispatch();
              } catch { fail(); }
            };
            // These buffers are private. FIFO on this same Worker delivers context
            // before the later scalar job; no second clone or context ACK is needed.
            worker.postMessage(prepared.message, prepared.transfer);
            contextBytes = job.bytes; job.bytes = 0;
          } catch { fail(); }
        }).catch(() => { if (!job.controller.signal.aborted) fail(); }).finally(() => {
          job.bytes = 0;
          if (contextJob === job) contextJob = null;
          dispatch();
        });
        return;
      }
      if (!wanted) return;
      if (options.renderer && !renderResources.begin()) return;
      active = wanted; timeout = setTimeout(fail, 15_000);
      const renderStamp: CarryRenderStamp | undefined = options.renderer ? {ownerId, workerGeneration, jobId: active.id,
        computationEpoch: active.input.pack.computationEpoch ?? 0, owner: renderOwner(active.input), assemblyRevision: revision} : undefined;
      worker.postMessage({ id: active.id, input: active.input, renderStamp } satisfies CarryWorkerMessage);
    } catch { fail(); }
  };
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => EMPTY,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    /** Speculative context only: never manufacture a pose or publish readiness. */
    primeContext(nextRear: BufferGeometry, nextVisibility: CarryVisibility): void {
      if (!mounted || document.hidden || workerFailed) return;
      if (rear !== nextRear || visibility !== nextVisibility || revision !== nextVisibility.revision) { stop(); rear = nextRear; visibility = nextVisibility; revision = nextVisibility.revision; }
      primeWanted = true; dispatch();
    },
    request(input: CarryInput, nextRear: BufferGeometry, nextVisibility: CarryVisibility): void {
      if (rear !== nextRear || visibility !== nextVisibility || revision !== nextVisibility.revision) { stop(); rear = nextRear; visibility = nextVisibility; revision = nextVisibility.revision; }
      latestRenderOwner = renderOwner(input);
      wanted = { id: ++sequence, input, owner: owner(input) }; dispatch();
    },
    /** Pin the selected main/query frame while its private renderer copy is
     * acquired and displayed. Port receives CarryRenderPayload; lease release
     * belongs after renderer replacement/retirement, independently of commit. */
    acquireRendererFrame(frame: CarryFrame, port: MessagePort, signal: AbortSignal) {
      const stamp = frame.renderStamp;
      if (!options.renderer || !mounted || !worker || !stamp || stamp.ownerId !== ownerId || stamp.workerGeneration !== workerGeneration
        || !visibility?.ready || stamp.assemblyRevision !== visibility.revision
        || stamp.owner !== latestRenderOwner || (snapshot.frame !== frame && !retired.has(frame))) {
        port.close(); return Promise.reject(Error('Carry renderer frame is unavailable or obsolete'));
      }
      const pin = framePins.get(frame) ?? {count: 0, retired: false}; pin.count++; framePins.set(frame, pin);
      return renderResources.acquire(stamp, port, signal, () => {
        if (--pin.count === 0) {framePins.delete(frame); if (pin.retired) release(frame);}
      });
    },
    inspectRendererResources: renderResources.inspect,
    /** Release replaced buffers only after their meshes have committed new props. */
    commit(): void { for (const frame of retired) free(frame); retired.clear(); },
    mount(): () => void {
      mounted = true;
      const changed = () => { if (document.hidden) stop(); else dispatch(); };
      document.addEventListener('visibilitychange', changed); dispatch();
      return () => { mounted = false; document.removeEventListener('visibilitychange', changed); stop(); wanted = null; rear = null; visibility = null; if (snapshot.frame) free(snapshot.frame); for (const frame of retired) free(frame); retired.clear(); snapshot = EMPTY; };
    },
  };
}
