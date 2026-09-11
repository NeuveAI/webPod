/** One session budget shared by collision builds and private query residency.
 * Build estimates retain their original meaning; query owners charge actual
 * private arrays plus bounded output storage before allocating either. */
const limit = 128 * 1024 * 1024;
let bytes = 0, reservations = 0;
export interface StickerCollisionReservation { readonly bytes: number; release(): void }
/** Reserve before allocating. Release after actual retirement (worker ACK or
 * termination), not merely after sending cancellation. Idempotent per owner. */
export function reserveStickerCollisionBytes(size: number): StickerCollisionReservation {
  if (!Number.isSafeInteger(size) || size < 0) throw new Error('Invalid collision reservation');
  if (size > limit - bytes) throw new Error('Collision preparation capacity exceeded');
  bytes += size; reservations++;
  let released = false;
  return {bytes: size, release() { if (released) return; released = true; bytes -= size; reservations--; }};
}
/** Scalar diagnostics only; no buffer ownership or mutable budget access. */
export function stickerCollisionBudgetSnapshot() { return {bytes, reservations, limit}; }
