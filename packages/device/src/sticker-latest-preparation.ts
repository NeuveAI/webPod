/** One active preparation plus one replaceable latest input per live surface.
 * Compatible progress can publish while a newer sample waits; ownership changes
 * abort and reject the old epoch. The consumer owns adopted result disposal. */
export function createLatestStickerPreparation<I, O extends { release(): void }>(prepare: (input: I, signal: AbortSignal) => Promise<O>, publish: (value: O) => void, failed: (input: I) => void) {
  let live = true, active: { readonly controller: AbortController; readonly owner: string } | null = null;
  let wanted: { readonly input: I; readonly owner: string } | null = null;
  const dispatch = () => {
    if (!live || active || !wanted) return;
    const next = wanted; wanted = null;
    const running = { controller: new AbortController(), owner: next.owner }; active = running;
    void prepare(next.input, running.controller.signal).then(value => {
      if (!live || active !== running || running.controller.signal.aborted) value.release(); else publish(value);
    }, () => { if (live && active === running && !running.controller.signal.aborted && !wanted) failed(next.input); }).finally(() => { if (active === running) { active = null; dispatch(); } });
  };
  return {
    request(input: I, owner: string) {
      live = true;
      if (active && active.owner !== owner) { active.controller.abort(); active = null; }
      wanted = { input, owner }; dispatch();
    },
    dispose() { live = false; wanted = null; active?.controller.abort(); active = null; },
  };
}
