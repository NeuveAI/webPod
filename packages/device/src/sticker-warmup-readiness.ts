/** Each callback belongs to one committed warmup surface generation. Recording
 * readiness before subscription handles React child-first layout effects. */
export function createStickerWarmupReadiness(generation: object = {}) {
  const ready = new Set<string>();
  const listeners = new Set<() => void>();
  const complete = () => ready.size === 3;
  const mark = (appearance: string) => () => {
    if (ready.has(appearance)) return;
    ready.add(appearance);
    if (complete()) for (const listener of listeners) listener();
  };
  return {
    generation,
    earned: mark('earned'), locked: mark('locked'), placed: mark('placed'), complete,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (complete()) listener();
      return () => { listeners.delete(listener); };
    },
  };
}
