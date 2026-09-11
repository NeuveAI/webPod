import { createCarryWearCache } from './sticker-carry-wear';
import { computeStickerCarrySteps } from './sticker-carry-computation';
import { createStickerSurfaceGeometrySteps } from './sticker-surface';
import { createStickerCollision } from './sticker-collision';
import { stickerWrapSurface } from './sticker-wrap';
import { yieldSteps } from './sticker-computation-steps';
import type { BufferGeometry } from 'three';
import type { CarryInput } from './sticker-carry-computation';
import type { CarryWorkerMessage, CarryWorkerResult } from './sticker-carry-worker';
import { restorePaperGeometry, transferPaperGeometry } from './sticker-paper-transfer';
import type { createStickerVisibility } from './sticker-visibility';

type CarryVisibility = Pick<ReturnType<typeof createStickerVisibility>, 'ready' | 'revision' | 'snapshot'>;
interface CarryFrame { readonly geometry: BufferGeometry; readonly wearGeometry: BufferGeometry | null; readonly input: CarryInput; readonly pointerError: number | null; readonly releaseWear: () => void }
interface CarrySnapshot { readonly frame: CarryFrame | null; readonly error: string | null }
interface CarryJob { readonly id: number; readonly input: CarryInput; readonly owner: string }
const EMPTY: CarrySnapshot = { frame: null, error: null };
const release = (frame: CarryFrame) => { frame.geometry.dispose(); frame.releaseWear(); };
const owner = (input: CarryInput) => JSON.stringify([input.pack.computationEpoch, input.art, input.pack.sourcePlacement ?? null, input.pack.sourceAnchor ?? null]);

/**
 * One atomic deformation job plus one latest pending pose. The worker retains
 * immutable assembly/source surfaces; only scalar pose/matrix snapshots repeat.
 * Completed poses publish monotonically within one gesture owner; changed owners
 * and assemblies reject old results. The final pending pose is always computed.
 */
export function createCarryPreparation() {
  const wearCache = createCarryWearCache();
  let worker: Worker | null = null, mounted = false, sequence = 0;
  let active: CarryJob | null = null, wanted: CarryJob | null = null;
  let rear: BufferGeometry | null = null, visibility: CarryVisibility | null = null, revision = -1;
  let fallback: AbortController | null = null, workerFailed = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let snapshot = EMPTY;
  const retired = new Set<CarryFrame>(), listeners = new Set<() => void>();
  const publish = (next: CarrySnapshot) => { if (snapshot.frame && snapshot.frame !== next.frame) retired.add(snapshot.frame); snapshot = next; for (const listener of listeners) listener(); };
  const stop = () => { clearTimeout(timeout); timeout = undefined; worker?.terminate(); worker = null; wearCache.clear(); fallback?.abort(); fallback = null; active = null; };
  const fail = () => { stop(); workerFailed = true; dispatch(); };
  const dispatch = (): void => {
    if (!mounted || document.hidden || active || !wanted || !rear || !visibility?.ready) return;
    if (workerFailed) {
      const job = wanted, assembly = rear, contact = visibility, expectedRevision = revision, controller = new AbortController(); fallback = controller; active = job;
      const prepare = async () => {
        let source: BufferGeometry | null = null, target: BufferGeometry | null = null;
        const borrowed = contact.snapshot();
        const collider = createStickerCollision([], { ...borrowed, metadata: borrowed.metadata.map(value => ({ ...value })) });
        try {
          if (job.input.pack.sourcePlacement) source = await yieldSteps(createStickerSurfaceGeometrySteps(job.input.art, job.input.pack.sourcePlacement, assembly), controller.signal);
          if (job.input.pack.landing > 0 && job.input.pack.placement) target = await yieldSteps(createStickerSurfaceGeometrySteps(job.input.art, job.input.pack.placement, assembly), controller.signal);
          const result = await yieldSteps(computeStickerCarrySteps(job.input, assembly, source, target, collider), controller.signal);
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
        worker = new Worker(new URL('./sticker-carry-worker.ts', import.meta.url), { type: 'module' });
        const instance = worker;
        const workerFailure = () => { if (worker === instance) fail(); };
        worker.onerror = workerFailure; worker.onmessageerror = workerFailure;
        worker.onmessage = ({ data }: MessageEvent<CarryWorkerResult>) => {
          if (worker !== instance || active?.id !== data.id) return;
          const completed = active; active = null; clearTimeout(timeout); timeout = undefined;
          if (!data.geometry || data.error) { fail(); return; }
          try {
            // Consume immutable payloads even when their pose belongs to an old
            // epoch: the same worker may reference that revision in its next job.
            wearCache.accept(data.wearRevision, data.wearGeometry);
            if (!wanted || completed.owner !== wanted.owner || !visibility?.ready || revision !== visibility.revision) { dispatch(); return; }
            const geometry = restorePaperGeometry(data.geometry);
            const wear = wearCache.retain();
            const frame = { geometry, wearGeometry: wear.geometry, releaseWear: wear.release, input: completed.input, pointerError: data.pointerError ?? null };
            if (wanted.id === completed.id) wanted = null;
            publish({ frame, error: null }); dispatch();
          } catch { fail(); }
        };
        // Snapshot arrays are borrowed; structured clone copies them once per
        // assembly lifetime. No live rendering or visibility buffers detach.
        worker.postMessage({ context: { rear: transferPaperGeometry(rear), form: stickerWrapSurface(rear)?.form ?? null, collision: visibility.snapshot() } } satisfies CarryWorkerMessage);
      }
      active = wanted; timeout = setTimeout(fail, 15_000);
      worker.postMessage({ id: active.id, input: active.input } satisfies CarryWorkerMessage);
    } catch { fail(); }
  };
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => EMPTY,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    request(input: CarryInput, nextRear: BufferGeometry, nextVisibility: CarryVisibility): void {
      if (rear !== nextRear || visibility !== nextVisibility || revision !== nextVisibility.revision) { stop(); rear = nextRear; visibility = nextVisibility; revision = nextVisibility.revision; }
      wanted = { id: ++sequence, input, owner: owner(input) }; dispatch();
    },
    /** Release replaced buffers only after their meshes have committed new props. */
    commit(): void { for (const frame of retired) release(frame); retired.clear(); },
    mount(): () => void {
      mounted = true;
      const changed = () => { if (document.hidden) stop(); else dispatch(); };
      document.addEventListener('visibilitychange', changed); dispatch();
      return () => { mounted = false; document.removeEventListener('visibilitychange', changed); stop(); wanted = null; rear = null; visibility = null; if (snapshot.frame) release(snapshot.frame); for (const frame of retired) release(frame); retired.clear(); snapshot = EMPTY; };
    },
  };
}
