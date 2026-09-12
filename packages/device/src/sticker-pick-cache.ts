/** Share duplicate native admission queries only within the current JS task.
 * Callers include every pose/camera/layout/placement identity in the key; no hit
 * survives into another event, worker completion or animation frame.
 */
export function createStickerPickCache<T>() {
  let cached: { key: readonly unknown[]; value: T } | null = null;
  let scheduled = false;
  return (key: readonly unknown[], pick: () => T): T => {
    if (cached !== null && key.length === cached.key.length && key.every((value, index) => Object.is(value, cached?.key[index]))) return cached.value;
    const value = pick();
    cached = { key, value };
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(() => { cached = null; scheduled = false; });
    }
    return value;
  };
}
