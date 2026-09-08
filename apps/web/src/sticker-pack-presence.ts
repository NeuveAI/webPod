import { atom } from 'jotai'
import { deviceStore } from '@webpod/state'

/* ANIMATION STORYBOARD
 * reveal: the sleeve and label rise together on Neuve's gentle spring
 * dismiss: both slide below the viewport before the pack is released
 * reversal: retain position/velocity; reduced motion reaches the endpoint now
 */
export const stickerPackPresenceAtom = atom(0)
const SPRING = { stiffness: 200, damping: 20, step: 1 / 120, rest: .001 } as const
let frame: number | null = null
let velocity = 0
let target = 0
let generation = 0

export function animateStickerPackPresence(next: 0 | 1, complete: () => void): void {
  if (next === target && frame !== null) return
  if (frame === null && deviceStore.get(stickerPackPresenceAtom) === next) { complete(); return }
  target = next
  const run = ++generation
  if (frame !== null) cancelAnimationFrame(frame)
  frame = null
  const finish = () => { velocity = 0; deviceStore.set(stickerPackPresenceAtom, next); if (run === generation) complete() }
  if (typeof requestAnimationFrame === 'undefined' || typeof globalThis.matchMedia !== 'function' || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { finish(); return }
  let previous = performance.now()
  const tick = (now: number) => {
    if (run !== generation) return
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { frame = null; finish(); return }
    let remaining = Math.min((now - previous) / 1000, .064)
    previous = now
    let position = deviceStore.get(stickerPackPresenceAtom)
    while (remaining > 0) {
      const dt = Math.min(remaining, SPRING.step)
      velocity += (SPRING.stiffness * (next - position) - SPRING.damping * velocity) * dt
      position += velocity * dt
      remaining -= dt
    }
    deviceStore.set(stickerPackPresenceAtom, position)
    if (run !== generation) return
    if (Math.abs(next - position) < SPRING.rest && Math.abs(velocity) < SPRING.rest) { frame = null; finish(); return }
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
}

export function resetStickerPackPresence(): void {
  generation++
  if (frame !== null) cancelAnimationFrame(frame)
  frame = null
  velocity = 0
  target = 0
  deviceStore.set(stickerPackPresenceAtom, 0)
}
