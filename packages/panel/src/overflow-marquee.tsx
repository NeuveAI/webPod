import { useEffect, useRef } from 'react'

export interface OverflowMarqueeProps {
  readonly text: string
  readonly active?: boolean
  readonly className?: string
}

/** Enables the classic iPod crawl only when the active label actually overflows. */
export function OverflowMarquee({ text, active = false, className }: OverflowMarqueeProps) {
  const rootRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const root = rootRef.current
    if (root === null) return
    if (!active) { root.dataset.overflow = 'false'; return }
    const moving = root.querySelector<HTMLElement>('.wp-marquee__moving')
    if (moving === null) return
    const measure = () => {
      // Read geometry together before any attribute/style writes.
      const distance = Math.max(0, moving.scrollWidth - root.clientWidth)
      const overflow = distance > 1 ? 'true' : 'false'
      const cssDistance = `${distance}px`
      if (root.dataset.overflow !== overflow) root.dataset.overflow = overflow
      if (root.style.getPropertyValue('--wp-marquee-distance') !== cssDistance) root.style.setProperty('--wp-marquee-distance', cssDistance)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    observer.observe(moving)
    return () => observer.disconnect()
  }, [active, text])

  return (
    <span
      ref={rootRef}
      className={['wp-marquee', className].filter(Boolean).join(' ')}
      data-active={active ? 'true' : undefined}
      data-overflow="false"
      title={text}
    >
      <span className="wp-marquee__rest">{text}</span>
      <span key={text} className="wp-marquee__moving" aria-hidden="true">{text}</span>
    </span>
  )
}
