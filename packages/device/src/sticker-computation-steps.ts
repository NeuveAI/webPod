/** Shared math executes synchronously in workers and cooperatively on worker failure. */
export function drainSteps<T>(steps: Generator<void, T, void>): T {
  let result = steps.next();
  while (!result.done) result = steps.next();
  return result.value;
}
export async function yieldSteps<T>(steps: Generator<void, T, void>, signal: AbortSignal): Promise<T> {
  await new Promise<void>(resolve => setTimeout(resolve, 0));
  let deadline = performance.now() + 4;
  try {
    for (;;) {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      const result = steps.next();
      if (result.done) return result.value;
      if (performance.now() >= deadline) { await new Promise<void>(resolve => setTimeout(resolve, 0)); deadline = performance.now() + 4; }
    }
  } finally { steps.return(undefined as T); }
}
