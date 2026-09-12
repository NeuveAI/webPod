import { WebHaptics } from 'web-haptics'
import { interactionFeedbackAtom, type DeviceStore } from '@webpod/state'

/** Short tactile vocabulary: motion stays lighter than physical contact. */
export type InteractionHaptic = 'detent' | 'press' | 'pickup' | 'peel' | 'detach' | 'place'
const PATTERNS = {
  detent: { duration: 8, intensity: .45 },
  press: { duration: 24, intensity: .85 },
  pickup: { duration: 18, intensity: .6 },
  peel: { duration: 10, intensity: .4 },
  detach: { duration: 30, intensity: .8 },
  place: { duration: 38, intensity: .7 },
} satisfies Record<InteractionHaptic, { duration: number; intensity: number }>

/**
 * Browser-safe, lazily allocated tactile session. No queued work, debug audio or
 * timers: sustained gestures are sampled at most every 45ms (peeling: 70ms).
 * Mount returns a cleanup that also destroys web-haptics' Safari switch fallback.
 */
export class InteractionHaptics {
  private engine: WebHaptics | null = null
  private mounted = false
  private lastPulse = -Infinity

  mount(): () => void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}
    this.mounted = true
    const cancel = () => this.cancel()
    const visibility = () => { if (document.hidden) this.cancel() }
    window.addEventListener('blur', cancel)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      this.mounted = false
      window.removeEventListener('blur', cancel)
      document.removeEventListener('visibilitychange', visibility)
      this.cancel()
      this.engine?.destroy()
      this.engine = null
    }
  }

  trigger(kind: InteractionHaptic): void {
    if (!this.mounted || typeof document === 'undefined' || document.hidden) return
    // Safari's native switch supplies the library fallback. Other unsupported
    // browsers should not allocate an invisible control or an animation loop.
    if (!WebHaptics.isSupported && !('switch' in document.createElement('input'))) return
    const now = performance.now()
    if (now - this.lastPulse < (kind === 'peel' ? 70 : 45)) return
    this.lastPulse = now
    this.engine ??= new WebHaptics({ debug: false, showSwitch: false })
    void this.engine.trigger([PATTERNS[kind]]).catch(() => { this.cancel() })
  }

  /** Abort ongoing native vibration and the fallback's frame loop. */
  cancel(): void {
    try { this.engine?.cancel() } catch { /* Device policy may reject vibration. */ }
    this.lastPulse = -Infinity
  }
}

const wheelBindings = new WeakMap<DeviceStore, { users: number; haptics: InteractionHaptics; dispose: () => void }>()
/** One authoritative human-touch detent consumer per store, even with two views. */
export function mountWheelHaptics(store: DeviceStore): () => void {
  let binding = wheelBindings.get(store)
  if (binding === undefined) {
    const haptics = new InteractionHaptics()
    const cleanup = haptics.mount()
    const unsubscribe = store.sub(interactionFeedbackAtom, () => {
      const feedback = store.get(interactionFeedbackAtom)
      if (feedback?.control === 'wheel' && feedback.actor === 'human:touch' && feedback.origin === 'detent') haptics.trigger('detent')
    })
    binding = { users: 0, haptics, dispose: () => { unsubscribe(); cleanup() } }
    wheelBindings.set(store, binding)
  }
  const owned = binding
  owned.users += 1
  return () => {
    owned.users -= 1
    if (owned.users === 0) { owned.dispose(); wheelBindings.delete(store) }
  }
}

/** Only the admitted wheel owner cancels detents; sticker capture is independent. */
export function cancelWheelHaptics(store: DeviceStore): void { wheelBindings.get(store)?.haptics.cancel() }
