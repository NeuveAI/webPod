import type { StickerPlacement } from '@webpod/stickers';
/** Fitting is read-only and may outlive a gesture. Only its current owner may
 * persist; preserve the exact captured release sample and recheck after any
 * synchronous callback. A completed obsolete save cannot authorize animation. */
export async function placeCurrentStickerDrop(input: {
  readonly placement: StickerPlacement; readonly clientX: number; readonly clientY: number;
  readonly resolve?: (placement: StickerPlacement, x: number, y: number, signal?: AbortSignal) => StickerPlacement | Promise<StickerPlacement>;
  readonly save: (placement: StickerPlacement) => Promise<void>;
  readonly beforeSave: () => void;
  readonly isCurrent: () => boolean; readonly signal: AbortSignal;
}): Promise<StickerPlacement | null> {
  const { placement: initial, clientX, clientY, signal, isCurrent } = input;
  const placement = await input.resolve?.(initial, clientX, clientY, signal) ?? initial;
  if (signal.aborted || !isCurrent()) return null;
  input.beforeSave();
  if (signal.aborted || !isCurrent()) return null;
  await input.save(placement);
  return signal.aborted || !isCurrent() ? null : placement;
}
