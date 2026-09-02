import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { ListScrollIndicator, listScrollGeometry } from './list-scroll-indicator'

describe('the list-owned scroll indicator', () => {
  test('is absent whenever the row window cannot move', () => {
    expect(listScrollGeometry(8, 8, 0)).toBeNull()
    expect(listScrollGeometry(4, 8, 0)).toBeNull()
    expect(renderToStaticMarkup(<ListScrollIndicator totalRows={8} visibleRows={8} windowStart={0} />)).toBe('')
  })

  test('derives start, middle, and end geometry from the authoritative row window', () => {
    expect(listScrollGeometry(16, 8, 0)).toEqual({
      thumbSizePercent: 50,
      thumbOffsetPercent: 0,
      windowStart: 0,
    })
    expect(listScrollGeometry(16, 8, 4)).toEqual({
      thumbSizePercent: 50,
      thumbOffsetPercent: 25,
      windowStart: 4,
    })
    expect(listScrollGeometry(16, 8, 8)).toEqual({
      thumbSizePercent: 50,
      thumbOffsetPercent: 50,
      windowStart: 8,
    })
  })

  test('clamps stale window starts before publishing diagnostic geometry', () => {
    expect(listScrollGeometry(16, 8, -4)?.windowStart).toBe(0)
    expect(listScrollGeometry(16, 8, 99)?.windowStart).toBe(8)
  })

  test('recomputes generically as provider-backed list lengths change', () => {
    const lengths = [0, 4, 8, 9, 120]
    const geometries = lengths.map((totalRows) =>
      listScrollGeometry(totalRows, 8, 0)?.thumbSizePercent ?? null,
    )
    expect(geometries).toEqual([
      null,
      null,
      null,
      88.88888888888889,
      6.666666666666667,
    ])
  })

  test('renders crisp percentage geometry without becoming semantic content', () => {
    const html = renderToStaticMarkup(
      <ListScrollIndicator totalRows={120} visibleRows={8} windowStart={56} />,
    )
    expect(html).toContain('class="wp-list-scroll"')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('class="wp-list-scroll__well"')
    expect(html).toContain('class="wp-list-scroll__thumb"')
    expect(html).toContain('data-thumb-size="6.667%"')
    expect(html).toContain('data-thumb-offset="46.667%"')
  })
})
