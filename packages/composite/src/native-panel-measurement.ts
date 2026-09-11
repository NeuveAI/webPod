export interface NativePanelDimensions { readonly width: number; readonly height: number }

/** One host's exact untransformed integer border box. Pose reads never measure.
 * Zero/hidden boxes suspend availability while preserving the last valid size;
 * ResizeObserver and the host's visibility callback refresh before reuse. */
export function observeNativePanelDimensions(panel: HTMLElement, changed: () => void) {
  let target: HTMLElement | null = panel, notify: (() => void) | null = changed
  let last: NativePanelDimensions | null = null, available = false, disposed = false
  const waiters = new Set<{ resolve(): void; reject(): void }>()
  const read = (): NativePanelDimensions | null => !disposed && available && !document.hidden ? last : null
  const refresh = (publish = true) => {
    if (disposed || !target) return
    if (document.hidden) { available = false; return }
    const width = target.offsetWidth, height = target.offsetHeight
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) { available = false; return }
    const different = !available || !last || last.width !== width || last.height !== height
    last = { width, height }; available = true
    for (const waiter of [...waiters]) waiter.resolve()
    if (publish && different) notify?.()
  }
  const observer = new ResizeObserver(entries => {
    if (!disposed && entries.some(entry => entry.target === target)) refresh()
  })
  observer.observe(panel, { box: 'border-box' })
  refresh(false)
  return {
    read,
    refresh: () => refresh(),
    /** First usable box participates in the existing host readiness deadline.
     * Abort/disposal always removes the waiter and its signal listener. */
    whenReady(signal: AbortSignal): Promise<void> {
      if (signal.aborted || disposed) return Promise.reject(new DOMException('Cancelled', 'AbortError'))
      if (read()) return Promise.resolve()
      return new Promise((resolve, reject) => {
        const cleanup = () => { waiters.delete(waiter); signal.removeEventListener('abort', waiter.reject) }
        const waiter = { resolve() { cleanup(); resolve() }, reject() { cleanup(); reject(new DOMException('Cancelled', 'AbortError')) } }
        waiters.add(waiter); signal.addEventListener('abort', waiter.reject, { once: true })
      })
    },
    dispose() {
      if (disposed) return
      disposed = true; observer.disconnect(); available = false; target = null; notify = null; last = null
      for (const waiter of [...waiters]) waiter.reject()
    },
  }
}
