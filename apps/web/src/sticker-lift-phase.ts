/** One lift travel: adhesive release first, then transfer the last rows into free carry. */
const FRONT_PHASE = .8
const clamp = (value: number) => Math.max(0, Math.min(1, value))
export interface StickerLiftPhase { readonly sourcePeelFront: number; readonly detachTransport: number }
export function stickerLiftPhase(phase: number): StickerLiftPhase {
  return { sourcePeelFront: clamp(phase / FRONT_PHASE), detachTransport: clamp((phase - FRONT_PHASE) / (1 - FRONT_PHASE)) }
}
export function stickerLiftProgress(state: { readonly peel: number; readonly sourcePeelFront?: number; readonly detachTransport?: number }): number {
  if (state.sourcePeelFront === undefined) return clamp(state.peel)
  const transport = clamp(state.detachTransport ?? 0)
  return transport > 0 ? FRONT_PHASE + (1 - FRONT_PHASE) * transport : FRONT_PHASE * clamp(state.sourcePeelFront)
}
/** Retarget from the actual physical phase without changing the existing curl spring. */
export function stickerLiftAnimation(initialPhase: number, startCurl: number, targetCurl: number, currentCurl: number): StickerLiftPhase {
  const fraction = startCurl === targetCurl ? 1 : clamp((currentCurl - startCurl) / (targetCurl - startCurl))
  const targetPhase = targetCurl === 0 ? 0 : targetCurl === 1 ? 1 : targetCurl === startCurl ? initialPhase : targetCurl > startCurl ? Math.max(initialPhase, clamp(targetCurl)) : Math.min(initialPhase, clamp(targetCurl))
  return stickerLiftPhase(initialPhase + (targetPhase - initialPhase) * fraction)
}
