import type { ShellPickingIndex, ShellPickingInput } from './shell-picking-index';

type Job = { input: ShellPickingInput; signal: AbortSignal; resolve: (index: ShellPickingIndex) => void; reject: (error: Error) => void; abort: () => void };
const queue: Job[] = [];
let active: Job | null = null;
let worker: Worker | null = null;
let deadline: ReturnType<typeof setTimeout> | undefined;

function stop() {
  if (deadline !== undefined) clearTimeout(deadline);
  deadline = undefined;
  worker?.terminate(); worker = null;
}
function finish(error: Error | null, index?: ShellPickingIndex) {
  const job = active; active = null;
  if (deadline !== undefined) clearTimeout(deadline);
  deadline = undefined;
  if (job) {
    job.signal.removeEventListener('abort', job.abort);
    if (error || !index) job.reject(error ?? new Error('Missing shell index'));
    else job.resolve(index);
  }
  pump();
}
function pump() {
  if (active) return;
  const job = queue.shift();
  if (!job) { stop(); return; }
  active = job;
  try {
    if (!worker) {
      worker = new Worker(new URL('./shell-picking-worker.ts', import.meta.url), { type: 'module' });
      const owner = worker;
      worker.onmessage = (event: MessageEvent<{ index?: ShellPickingIndex; error?: string }>) => {
        if (worker !== owner) return;
        finish(event.data.error ? new Error(event.data.error) : null, event.data.index);
      };
      const fail = () => { if (worker !== owner) return; stop(); finish(new Error('Shell preparation worker failed')); };
      worker.onerror = fail; worker.onmessageerror = fail;
    }
    deadline = setTimeout(() => { stop(); finish(new Error('Shell preparation timed out')); }, 15000);
    const { positions, indices } = job.input;
    worker.postMessage(job.input, indices ? [positions.buffer, indices.buffer] : [positions.buffer]);
  } catch (error) { stop(); finish(error instanceof Error ? error : new Error('Shell preparation failed')); }
}

/** Session-wide single worker, at most four waiting shells. Overflow and failure
 * retain exact source raycasting. Idle/cancelled workers release their Three heap. */
export function prepareShellPickingIndex(input: ShellPickingInput, signal: AbortSignal): Promise<ShellPickingIndex> {
  return new Promise((resolve, reject) => {
    if (signal.aborted || queue.length >= 4) { reject(new Error('Shell preparation cancelled or busy')); return; }
    const job: Job = { input, signal, resolve, reject, abort: () => {
      if (active === job) { stop(); finish(new Error('Shell preparation cancelled')); }
      else {
        const index = queue.indexOf(job); if (index >= 0) queue.splice(index, 1);
        signal.removeEventListener('abort', job.abort); reject(new Error('Shell preparation cancelled'));
      }
    } };
    signal.addEventListener('abort', job.abort, { once: true });
    queue.push(job); pump();
  });
}
