/** Warm offscreen, descend from above the frame, then release the demo loop. */
export function mountTeaserEntrance(element: HTMLElement) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  let animation: Animation | undefined
  let disposed = false
  const finish = () => {
    if (disposed || element.dataset['teaserEntrance'] === 'complete') return
    element.dataset['teaserEntrance'] = 'complete'
    animation?.cancel()
    element.dispatchEvent(new Event('teaser-settled'))
  }
  const ready = () => {
    if (element.dataset['teaserEntrance'] !== 'waiting') return
    if (media.matches) return finish()
    // Layout owns the resting box; translation never feeds back into its size.
    const travel = element.getBoundingClientRect().bottom
    animation = element.animate([
      { transform: `translateY(${-travel}px)` },
      { transform: 'translateY(0)' },
    ], { duration: 1100, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' })
    element.dataset['teaserEntrance'] = 'entering'
    void animation.finished.then(finish, () => {})
  }
  const preferenceChanged = () => { if (media.matches) finish() }
  element.addEventListener('teaser-ready', ready)
  media.addEventListener('change', preferenceChanged)
  return () => {
    disposed = true
    animation?.cancel()
    element.removeEventListener('teaser-ready', ready)
    media.removeEventListener('change', preferenceChanged)
  }
}
