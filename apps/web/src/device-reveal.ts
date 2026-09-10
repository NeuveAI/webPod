import type { DevicePreviewStore } from './device-preview-orientation'
import { deviceStore } from '@webpod/state'
import { deviceRevealActiveAtom } from './device-reveal-state'
import { resetStickerPackPresence } from './sticker-pack-presence'

/* ANIMATION STORYBOARD
 * prelude  floor portal opens; GPU resources warm for at least 1450ms
 *    0ms   warm device rises, steel back facing the viewer
 *  440ms   rising back-first; begin the half-turn
 * 1600ms   front arrives as the glow gives way to the device
 * 1900ms   settle exactly into the resting pose
 * 2300ms   nudge toward a three-quarter view to hint at rotation
 * 2720ms   briefly linger on the steel edge
 * 2800ms   ease back to the front
 * 3460ms   rest; never repeat the hint
 * reduced  show the resting front immediately
 */
export const DEVICE_REVEAL_TIMING = {
  warm: 1450, turn: 440, front: 1600, settle: 1900,
  wink: 2300, winkPeak: 2720, winkReturn: 2800, complete: 3460,
  maxFrameStep: 32,
} as const
const REVEAL = { travelPercent: 110, yawDeg: 180, pitchDeg: -12, rollDeg: -5 } as const
const WINK = { yawDeg: -32, pitchDeg: -5, rollDeg: 2 } as const
const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value))
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export function deviceRevealFrame(elapsedMs: number) {
  const progress = Math.max(0, Math.min(1, elapsedMs / DEVICE_REVEAL_TIMING.settle))
  const rise = 1 - Math.pow(1 - progress, 3)
  const turn = smooth((elapsedMs - DEVICE_REVEAL_TIMING.turn) / (DEVICE_REVEAL_TIMING.front - DEVICE_REVEAL_TIMING.turn))
  const wink = smooth((elapsedMs - DEVICE_REVEAL_TIMING.wink) / (DEVICE_REVEAL_TIMING.winkPeak - DEVICE_REVEAL_TIMING.wink)) *
    (1 - smooth((elapsedMs - DEVICE_REVEAL_TIMING.winkReturn) / (DEVICE_REVEAL_TIMING.complete - DEVICE_REVEAL_TIMING.winkReturn)))
  return {
    travelPercent: REVEAL.travelPercent * (1 - rise),
    orientation: {
      yawDeg: REVEAL.yawDeg * (1 - turn) + WINK.yawDeg * wink,
      pitchDeg: REVEAL.pitchDeg * (1 - rise) + WINK.pitchDeg * wink,
      rollDeg: REVEAL.rollDeg * (1 - rise) + WINK.rollDeg * wink,
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
  let fallbackExpired = false
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
    if (elapsed >= DEVICE_REVEAL_TIMING.settle) {
      stage.dataset['deviceReveal'] = 'complete'
      deviceStore.set(deviceRevealActiveAtom, false)
    }
    if (elapsed >= DEVICE_REVEAL_TIMING.complete) finish(true)
    else frame = requestAnimationFrame(tick)
  }
  const ready = () => {
    if (finished) return
    const canvas = stage.querySelector('canvas')
    // A pending geometry/compile job is not graphics failure. In particular,
    // Suspense must not let the old safety timer skip the entry trajectory.
    if (canvas === null || canvas.dataset['wpRenderWarm'] === 'failed') {
      if (fallbackExpired) finish(true)
      return
    }
    if (canvas.dataset['wpRenderWarm'] !== 'ready') return
    clearTimeout(timeout)
    observer.disconnect()
    hold = window.setTimeout(() => {
      if (finished) return
      stage.dataset['deviceReveal'] = 'entering'
      frame = requestAnimationFrame(tick)
    }, Math.max(0, DEVICE_REVEAL_TIMING.warm - (performance.now() - mounted)))
  }
  const observer = new MutationObserver(ready)
  // No-canvas/failed graphics UI must never remain below the viewport. A real
  // preparing canvas waits for its bounded worker/compile owner to resolve.
  const timeout = window.setTimeout(() => { fallbackExpired = true; ready() }, 10000)
  const interrupt = () => finish(elapsed < DEVICE_REVEAL_TIMING.settle)
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
