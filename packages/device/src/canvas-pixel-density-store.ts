import { atom, createStore } from 'jotai';

/** One Canvas owns one numeric density. Both configuration and measurements
 * read/write this atom, so Fiber cannot restore a competing range-derived value.
 * Jotai suppresses identical measurements; no renderer/store is shared globally.
 */
export function createCanvasPixelDensityStore(initial: number) {
  const store = createStore();
  const density = atom(initial);
  return { store, density, publish: (value: number) => { store.set(density, value); } };
}
