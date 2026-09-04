import type { CSSProperties } from 'react'

/** Fixed Aqua well travel in authored panel pixels (183px pane minus 4px insets). */
export const LIST_SCROLL_TRACK_SIZE_PX = 175

/** Smallest thumb that remains legible in the five-pixel Aqua trough. */
export const LIST_SCROLL_MINIMUM_THUMB_SIZE_PX = 5

/** Effective thumb geometry after row-window and minimum-size clamping. */
export interface ListScrollGeometry {
  readonly thumbSizePx: number
  readonly thumbOffsetPx: number
  readonly windowStart: number
}

/** Maps an authoritative row window onto the fixed-size, non-native Aqua well. */
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
  const thumbSizePx = Math.max(
    LIST_SCROLL_MINIMUM_THUMB_SIZE_PX,
    (visible / total) * LIST_SCROLL_TRACK_SIZE_PX,
  )
  return {
    thumbSizePx,
    thumbOffsetPx:
      (start / maximumStart) * (LIST_SCROLL_TRACK_SIZE_PX - thumbSizePx),
    windowStart: start,
  }
}

/**
 * Renders the panel-owned, five-pixel Aqua scroll trough for an authoritative row window.
 *
 * The component has no local state: changing any of the three row-window
 * inputs immediately recomputes both the effective (minimum-clamped) thumb
 * size and its travel. It stays absent when the complete list fits.
 */
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

  const size = `${geometry.thumbSizePx.toFixed(3)}px`
  const offset = `${geometry.thumbOffsetPx.toFixed(3)}px`
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
