import type { DevicePreviewStore } from './device-preview-orientation'
import { deviceStore } from '@webpod/state'
import { deviceRevealActiveAtom } from './device-reveal-state'
import { resetStickerPackPresence } from './sticker-pack-presence'

/* ANIMATION STORYBOARD
 * prelude  floor portal opens for after a 450ms breath; GPU resources warm for at least 1450ms while GPU resources warm
 *    0ms   warm device rises, steel back facing the viewer
 *  440ms   rising back-first; begin the half-turn
 * 1600ms   front arrives as the glow gives way to the device
 * 1900ms   settle exactly into the resting pose
 * reduced  show the resting front immediately
 */
export const DEVICE_REVEAL_TIMING = { warm: 1450, turn: 440, front: 1600, settle: 1900, maxFrameStep: 32 } as const
const REVEAL = { travelPercent: 110, yawDeg: 180, pitchDeg: -12, rollDeg: -5 } as const
const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value))
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export function deviceRevealFrame(elapsedMs: number) {
  const progress = Math.max(0, Math.min(1, elapsedMs / DEVICE_REVEAL_TIMING.settle))
  const rise = 1 - Math.pow(1 - progress, 3)
  const turn = smooth((elapsedMs - DEVICE_REVEAL_TIMING.turn) / (DEVICE_REVEAL_TIMING.front - DEVICE_REVEAL_TIMING.turn))
  return {
    travelPercent: REVEAL.travelPercent * (1 - rise),
    orientation: {
      yawDeg: REVEAL.yawDeg * (1 - turn),
      pitchDeg: REVEAL.pitchDeg * (1 - rise),
      rollDeg: REVEAL.rollDeg * (1 - rise),
    },
  }
}

/** One scene-entry owner; user/tool orientation changes immediately take over. */
export function mountDeviceReveal(stage: HTMLElement, store: DevicePreviewStore): () => void {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  let frame = 0
  let previousFrame: number | null = null
  let elapsed = 0
  const mounted = performance.now()
  const room = stage.parentElement
  let hold = 0
  let finished = false
  let publishing = false
  let unsubscribe = () => {}
  const finish = (front: boolean) => {
    if (finished) return
    finished = true
    cancelAnimationFrame(frame)
    observer.disconnect()
    clearTimeout(timeout)
    clearTimeout(hold)
    unsubscribe()
    stage.dataset['deviceReveal'] = 'complete'
    stage.style.removeProperty('--device-reveal-y')
    room?.style.removeProperty('--device-reveal-glow')
    if (front) store.resetOrientation()
    deviceStore.set(deviceRevealActiveAtom, false)
  }
  const publish = (elapsed: number) => {
    const next = deviceRevealFrame(elapsed)
    stage.style.setProperty('--device-reveal-y', `${next.travelPercent}%`)
    room?.style.setProperty('--device-reveal-glow', String(1 - smooth(elapsed / DEVICE_REVEAL_TIMING.front)))
    publishing = true
    try { store.setOrientation(next.orientation) } finally { publishing = false }
  }
  const tick = (now: number) => {
    if (finished) return
    elapsed += previousFrame === null ? 0 : Math.min(now - previousFrame, DEVICE_REVEAL_TIMING.maxFrameStep)
    previousFrame = now
    publish(elapsed)
    if (elapsed >= DEVICE_REVEAL_TIMING.settle) finish(true)
    else frame = requestAnimationFrame(tick)
  }
  const ready = () => {
    if (!stage.querySelector('canvas[data-wp-render-warm="ready"]')) return
    observer.disconnect()
    hold = window.setTimeout(() => {
      if (finished) return
      stage.dataset['deviceReveal'] = 'entering'
      frame = requestAnimationFrame(tick)
    }, Math.max(0, DEVICE_REVEAL_TIMING.warm - (performance.now() - mounted)))
  }
  const observer = new MutationObserver(ready)
  // A graphics fallback must never remain below the viewport.
  const timeout = window.setTimeout(() => finish(true), 10000)
  const interrupt = () => finish(true)
  const preferenceChanged = () => { if (media.matches) finish(true) }
  stage.dataset['deviceReveal'] = 'warming'
  deviceStore.set(deviceRevealActiveAtom, true)
  resetStickerPackPresence()
  if (media.matches) finish(true)
  else {
    publish(0)
    unsubscribe = store.subscribe(() => { if (!publishing) finish(false) })
    observer.observe(stage, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-wp-render-warm'] })
    ready()
    stage.addEventListener('pointerdown', interrupt, true)
    stage.addEventListener('keydown', interrupt, true)
    media.addEventListener('change', preferenceChanged)
  }
  return () => {
    finish(false)
    stage.removeEventListener('pointerdown', interrupt, true)
    stage.removeEventListener('keydown', interrupt, true)
    media.removeEventListener('change', preferenceChanged)
  }
}
