import { useLayoutEffect, useRef } from 'react';
import { createStickerVisibility } from './sticker-visibility';

/** Allocate and release together. Strict Mode and hot refresh replay effects
 * without necessarily recreating memoized values; disposed BVHs cannot be reused.
 * Callers query this ref from a subsequent layout effect, never during render.
 */
export function useStickerContactSurface() {
  const surface = useRef<ReturnType<typeof createStickerVisibility> | null>(null);
  useLayoutEffect(() => {
    const resource = createStickerVisibility();
    surface.current = resource;
    return () => { surface.current = null; resource.dispose(); };
  }, []);
  return surface;
}
