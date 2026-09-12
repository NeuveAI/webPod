import { createPaperWorker } from './sticker-paper-pool';
import { stickerPaperSteps } from './sticker-paper';
import { yieldSteps } from './sticker-computation-steps';
import { useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import type { BufferGeometry } from 'three';
import { restorePaperGeometry, type PaperPreparationInput, type PaperWorkerResponse } from './sticker-paper-transfer';

type Stock = { readonly front: BufferGeometry; readonly back: BufferGeometry; readonly edge: BufferGeometry };
interface PaperSnapshot { readonly stock: Stock | null; readonly dimensions: string; readonly error: string | null }
interface PaperJob { readonly id: number; readonly input: PaperPreparationInput }
const EMPTY: PaperSnapshot = { stock: null, dimensions: '', error: null };
const dimensions = (input: PaperPreparationInput) => `${input.width}:${input.height}:${input.pixel}:${input.liner}`;
const disposeStock = (stock: Stock) => { stock.front.dispose(); stock.back.dispose(); stock.edge.dispose(); };

/**
 * One worker/job plus one replaceable latest input per mounted paper surface.
 * Progress frames publish monotonically only within the same dimensions/epoch; the final pending curl always follows. Hidden/unmounted lifetimes terminate work;
 * previous compatible geometry stays visible while a new curl is computed.
 */
export function createPaperPreparation() {
  let worker: ReturnType<typeof createPaperWorker> | null = null, mounted = false, nextId = 0;
  let wanted: PaperJob | null = null;
  let active: PaperJob | null = null;
  let fallback: AbortController | null = null, workerFailed = false;
  let snapshot = EMPTY;
  const retired = new Set<Stock>(), listeners = new Set<() => void>();
  const publish = (next: PaperSnapshot) => { if (snapshot.stock && snapshot.stock !== next.stock) retired.add(snapshot.stock); snapshot = next; for (const listener of listeners) listener(); };
  const stop = () => { worker?.terminate(); worker = null; fallback?.abort(); fallback = null; active = null; };
  const fail = () => { stop(); workerFailed = true; dispatch(); };
  const dispatch = (): void => {
    if (!mounted || document.hidden || active || !wanted) return;
    if (workerFailed) {
      const job = wanted, controller = new AbortController(); fallback = controller; active = job;
      void yieldSteps(stickerPaperSteps(job.input.width, job.input.height, job.input.pixel, job.input.liner, job.input.curl), controller.signal).then(stock => {
        if (!mounted || controller.signal.aborted) { disposeStock(stock); return; }
        active = null; fallback = null;
        if (wanted && dimensions(wanted.input) === dimensions(job.input) && wanted.input.epoch === job.input.epoch) {
          if (wanted.id === job.id) wanted = null;
          publish({ stock, dimensions: dimensions(job.input), error: null });
        } else disposeStock(stock);
        dispatch();
      }).catch(() => { if (!controller.signal.aborted) { active = null; fallback = null; publish({ ...snapshot, error: 'Paper preparation unavailable' }); } });
      return;
    }
    try {
      if (!worker) {
        worker = createPaperWorker();
        const instance = worker;
        const workerFailure = () => { if (worker === instance) fail(); };
        worker.onerror = workerFailure; worker.onmessageerror = workerFailure;
        worker.onmessage = ({ data }: MessageEvent<PaperWorkerResponse>) => {
          if (worker !== instance || active?.id !== data.id) return;
          const completed = active; active = null;
          if (!wanted || (dimensions(wanted.input) !== dimensions(completed.input) || wanted.input.epoch !== completed.input.epoch)) { dispatch(); return; }
          if (!data.stock || data.error) { fail(); return; }
          if (wanted.id === completed.id) wanted = null;
          try {
            const stock = { front: restorePaperGeometry(data.stock.front), back: restorePaperGeometry(data.stock.back), edge: restorePaperGeometry(data.stock.edge) };
            publish({ stock, dimensions: dimensions(completed.input), error: null }); dispatch();
          } catch { fail(); }
        };
      }
      active = wanted;
      worker.postMessage(active);
    } catch { fail(); }
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    request(input: PaperPreparationInput): void { wanted = { id: ++nextId, input }; dispatch(); },
    /** Dispose retired geometries only after React commits replacement mesh props. */
    commit(): void { for (const stock of retired) disposeStock(stock); retired.clear(); },
    mount(): () => void {
      mounted = true;
      const visibility = () => { if (document.hidden) stop(); else dispatch(); };
      document.addEventListener('visibilitychange', visibility); dispatch();
      return () => { mounted = false; document.removeEventListener('visibilitychange', visibility); stop(); wanted = null; if (snapshot.stock) disposeStock(snapshot.stock); for (const stock of retired) disposeStock(stock); retired.clear(); snapshot = EMPTY; };
    },
  };
}

/** The hook owns transferred geometry; consumers must not dispose the returned stock. */
export function usePreparedStickerPaper(width: number, height: number, pixel: number, liner: boolean, curl: number, epoch = 0): PaperSnapshot {
  const runtime = useMemo(() => createPaperPreparation(), []);
  const snapshot = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, () => EMPTY);
  useEffect(() => runtime.mount(), [runtime]);
  useLayoutEffect(() => { runtime.request({ width, height, pixel, liner, curl, epoch }); }, [runtime, width, height, pixel, liner, curl, epoch]);
  useLayoutEffect(() => runtime.commit(), [runtime, snapshot]);
  return snapshot.dimensions === dimensions({ width, height, pixel, liner, curl }) ? snapshot : { ...snapshot, stock: null };
}
