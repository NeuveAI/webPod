import type { PaperPreparationInput, PaperWorkerResponse } from './sticker-paper-transfer';
interface Input { readonly id: number; readonly input: PaperPreparationInput }
interface Client {
  onmessage: ((event: MessageEvent<PaperWorkerResponse>) => void) | null;
  onerror: (() => void) | null;
  onmessageerror: (() => void) | null;
  postMessage(input: Input): void;
  terminate(): void;
}
interface Job { readonly client: Client; readonly input: Input; readonly sequence: number }
const clients = new Set<Client>(), waiting = new Map<Client, Job>();
let worker: Worker | null = null, active: Job | null = null, sequence = 0;
const stop = () => { worker?.terminate(); worker = null; active = null; };
function dispatch(): void {
  if (active || document.hidden || waiting.size === 0) return;
  const job = waiting.values().next().value; if (!job) return;
  waiting.delete(job.client); active = job;
  try {
    if (!worker) {
      const instance = new Worker(new URL('./sticker-paper-worker.ts', import.meta.url), { type: 'module' }); worker = instance;
      const failed = () => {
        if (worker !== instance) return;
        const interrupted = active; stop(); interrupted?.client.onerror?.(); dispatch();
      };
      instance.onerror = failed; instance.onmessageerror = failed;
      instance.onmessage = ({ data }: MessageEvent<PaperWorkerResponse>) => {
        if (worker !== instance || active?.sequence !== data.id) return;
        const completed = active; active = null;
        completed.client.onmessage?.(new MessageEvent<PaperWorkerResponse>('message', { data: { ...data, id: completed.input.id } }));
        dispatch();
      };
    }
    worker.postMessage({ ...job.input, id: job.sequence });
  } catch { stop(); job.client.onerror?.(); dispatch(); }
}
/** One shared module worker, FIFO owners and one pending job per surface. */
export function createPaperWorker(): Client {
  // Product renders at most two neighbours plus one liner per device. Bound
  // unusual multi-device hosts too; overflow uses the exact cooperative path.
  if (clients.size >= 32) throw new Error('Paper worker capacity reached');
  let closed = false;
  const client: Client = {
    onmessage: null, onerror: null, onmessageerror: null,
    postMessage(input) {
      if (closed) throw new Error('Paper worker owner was disposed');
      waiting.set(client, { client, input, sequence: ++sequence }); dispatch();
    },
    terminate() {
      if (closed) return;
      closed = true; clients.delete(client); waiting.delete(client);
      if (active?.client === client) stop();
      if (clients.size === 0) stop(); else dispatch();
    },
  };
  clients.add(client); return client;
}
