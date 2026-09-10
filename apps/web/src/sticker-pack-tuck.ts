import { atom } from 'jotai'
import { deviceStore } from '@webpod/state'
import { advanceStickerSpring } from './sticker-motion'

/* ANIMATION STORYBOARD
 * pickup/select: slide the workspace down to its lip on its own spring
 * carry/edit: preserve the liner and print origin while the workspace is away
 * reopen/return: reverse from the current position, retaining velocity
 * reduced motion: reach the same endpoint immediately
 */
export const stickerPackTuckedAtom = atom(false)
export const stickerPackTuckAtom = atom(0)
let frame: number | null = null
let velocity = 0
let generation = 0
export function setStickerPackTucked(tucked: boolean): void {
  if (deviceStore.get(stickerPackTuckedAtom) === tucked && (frame !== null || deviceStore.get(stickerPackTuckAtom) === (tucked ? 1 : 0))) return
  deviceStore.set(stickerPackTuckedAtom, tucked)
  const target = tucked ? 1 : 0
  const run = ++generation
  if (frame !== null) cancelAnimationFrame(frame)
  frame = null
  if (typeof requestAnimationFrame === 'undefined' || typeof matchMedia !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    velocity = 0; deviceStore.set(stickerPackTuckAtom, target); return
  }
  let previous = performance.now()
  const step = (now: number) => {
    if (run !== generation) return
    frame = null
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { velocity = 0; deviceStore.set(stickerPackTuckAtom, target); return }
    const next = advanceStickerSpring({ position: deviceStore.get(stickerPackTuckAtom), velocity, target }, (now - previous) / 1000)
    previous = now
    velocity = next?.velocity ?? 0
    deviceStore.set(stickerPackTuckAtom, next?.position ?? target)
    if (run === generation && next !== null) frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
}
export function resetStickerPackTuck(): void {
  generation++
  if (frame !== null) cancelAnimationFrame(frame)
  frame = null; velocity = 0
  deviceStore.set(stickerPackTuckedAtom, false); deviceStore.set(stickerPackTuckAtom, 0)
}
