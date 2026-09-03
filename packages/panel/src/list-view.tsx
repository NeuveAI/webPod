import type { CSSProperties, ReactNode } from 'react'

import { ListScrollIndicator } from './list-scroll-indicator'

export const LIST_VIEWPORT_SIZE_PX = 183
export const LIST_DEFAULT_VISIBLE_ROWS = 8

export interface ListRowContent {
  readonly index: number
  readonly leading?: ReactNode
  readonly primary: string
  readonly secondary?: string | null
  readonly count?: string | null
  readonly status?: ReactNode
  readonly chevron?: ReactNode
  readonly unavailable?: boolean
  readonly empty?: boolean
  readonly agent?: boolean
  readonly success?: boolean
}

/** Canonical semantic row for every browsable panel collection. */
export function ListRow({ row, current, id }: { readonly row: ListRowContent; readonly current: boolean; readonly id: string }) {
  return (
    <li
      id={id}
      className="wp-list-row"
      role="option"
      aria-selected={current}
      aria-current={current ? 'true' : undefined}
      data-unavailable={row.unavailable ? 'true' : undefined}
      data-empty={row.empty ? 'true' : undefined}
      data-agent={row.agent ? 'true' : undefined}
      data-success={row.success ? 'true' : undefined}
    >
      {current ? <i className="wp-selection-rim" aria-hidden="true" /> : null}
      {row.leading === undefined ? null : <span className="wp-list-row__leading">{row.leading}</span>}
      <span className="wp-list-row__primary">{row.primary}</span>
      {row.secondary == null ? null : <small className="wp-list-row__secondary">{row.secondary}</small>}
      {row.count == null ? null : <span className="wp-list-row__count">{row.count}</span>}
      {row.status === undefined ? null : <span className="wp-list-row__status">{row.status}</span>}
      {row.chevron === undefined ? null : <span className="wp-list-row__chevron" aria-hidden="true">{row.chevron}</span>}
    </li>
  )
}

/**
 * Owns the fixed title-bar-to-bottom list geometry, authoritative row window,
 * overflow clipping, selection visibility, optional preview slot and Aqua rail.
 */
export function ListViewport({
  rows,
  highlightIndex,
  windowStart,
  visibleRows = LIST_DEFAULT_VISIBLE_ROWS,
  label,
  panelId,
  preview,
  message,
}: {
  readonly rows: readonly ListRowContent[]
  readonly highlightIndex: number
  readonly windowStart: number
  readonly visibleRows?: number
  readonly label: string
  readonly panelId: string
  readonly preview?: ReactNode
  readonly message?: ReactNode
}) {
  const capacity = Math.max(1, visibleRows)
  const visible = rows.slice(windowStart, windowStart + capacity)
  const style = { '--wp-list-visible-rows': capacity } as CSSProperties
  return (
    <div className="wp-list-view" data-layout={preview === undefined ? 'full' : 'split'} style={style}>
      <div className="wp-list-viewport" data-list-viewport="true">
        {message ?? (
          <ol className="wp-list-rows" role="listbox" aria-label={label}>
            {visible.map((row) => <ListRow key={row.index} row={row} current={row.index === highlightIndex} id={`${panelId}-row-${row.index}`} />)}
          </ol>
        )}
        <ListScrollIndicator totalRows={rows.length} visibleRows={capacity} windowStart={windowStart} />
      </div>
      {preview === undefined ? null : <aside className="wp-list-preview">{preview}</aside>}
    </div>
  )
}
