import assert from 'node:assert/strict';
import { mock } from 'bun:test';
import { DEFAULT_DEVICE_FORM } from '../../../../../../packages/device/src/form';
const cleanups: (() => void)[] = [];
mock.module('react', () => ({useLayoutEffect: (effect: () => () => void) => {cleanups.push(effect());}}));
const NativeWorker = globalThis.Worker;
const workers: Worker[] = [];
class ObservedWorker extends NativeWorker {
  constructor(url: URL, options: WorkerOptions) { super(url, options); workers.push(this); }
}
Object.defineProperty(globalThis, 'Worker', {configurable: true, value: ObservedWorker});
const {usePreparedImmutableShells: mount, acquirePreparedDeviceForRenderer: acquire, inspectDevicePreparation: inspect} = await import('../../../../../../packages/device/src/immutable-shell-preparation');
async function mounted(form: typeof DEFAULT_DEVICE_FORM) {
  for (;;) {try {return mount(form);} catch (error) {if (!(error instanceof Promise)) throw error; await error;}}
}
try {
  await mounted(DEFAULT_DEVICE_FORM); await mounted({...DEFAULT_DEVICE_FORM, bodyCrown: 1.3});
  const old = workers.at(-1); assert(old); old.dispatchEvent(new ErrorEvent('error', {message: 'Injected idle producer loss'}));
  const channel = new MessageChannel(), signal = new AbortController();
  const pending = acquire(DEFAULT_DEVICE_FORM, channel.port1, signal.signal);
  const before = inspect(); assert.equal(before.recovering, 1);
  const releaseOther = cleanups.pop(); assert(releaseOther); releaseOther();
  const outcome = await pending.then(value => {value.release(); return 'fulfilled';}, error => String(error));
  const result = {before, outcome, callerAborted: signal.signal.aborted, after: inspect()};
  await Bun.write(new URL('./reviewer-unrelated-eviction.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
  channel.port2.close();
  assert.equal(outcome, 'fulfilled', 'Unrelated last-owner eviction must not cancel an active recovery');
} finally {
  for (const release of cleanups) release();
  await new Promise<void>(resolve => setTimeout(resolve, 10));
  for (const worker of workers) worker.terminate();
}
