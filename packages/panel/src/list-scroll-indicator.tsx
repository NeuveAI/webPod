import type { CSSProperties } from 'react'

export interface ListScrollGeometry {
  readonly thumbSizePercent: number
  readonly thumbOffsetPercent: number
  readonly windowStart: number
}

/** Maps an authoritative row window onto a compact, non-native list indicator. */
export function listScrollGeometry(
  totalRows: number,
  visibleRows: number,
  windowStart: number,
): ListScrollGeometry | null {
  const total = Math.max(0, Math.floor(totalRows))
  const visible = Math.max(0, Math.floor(visibleRows))
  if (visible === 0 || total <= visible) return null

  const maximumStart = total - visible
  const start = Math.min(maximumStart, Math.max(0, Math.floor(windowStart)))
  const thumbSizePercent = (visible / total) * 100
  return {
    thumbSizePercent,
    thumbOffsetPercent: (start / maximumStart) * (100 - thumbSizePercent),
    windowStart: start,
  }
}

export function ListScrollIndicator({
  totalRows,
  visibleRows,
  windowStart,
}: {
  readonly totalRows: number
  readonly visibleRows: number
  readonly windowStart: number
}) {
  const geometry = listScrollGeometry(totalRows, visibleRows, windowStart)
  if (geometry === null) return null

  const size = `${geometry.thumbSizePercent.toFixed(3)}%`
  const offset = `${geometry.thumbOffsetPercent.toFixed(3)}%`
  const style = {
    '--wp-list-scroll-thumb-size': size,
    '--wp-list-scroll-thumb-offset': offset,
  } as CSSProperties

  return (
    <span
      className="wp-list-scroll"
      aria-hidden="true"
      data-total-rows={totalRows}
      data-visible-rows={visibleRows}
      data-window-start={geometry.windowStart}
      data-thumb-size={size}
      data-thumb-offset={offset}
      style={style}
    >
      <i className="wp-list-scroll__well" />
      <i className="wp-list-scroll__thumb" />
    </span>
  )
}
