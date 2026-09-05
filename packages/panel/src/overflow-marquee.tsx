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
    const moving = root.querySelector<HTMLElement>('.wp-marquee__moving')
    if (moving === null) return
    const measure = () => {
      const overflow = active && moving.scrollWidth > root.clientWidth + 1
      root.dataset.overflow = overflow ? 'true' : 'false'
      root.style.setProperty('--wp-marquee-distance', `${Math.max(0, moving.scrollWidth - root.clientWidth)}px`)
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
