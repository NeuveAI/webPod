import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { readFileSync } from 'node:fs'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  LIST_SCROLL_MINIMUM_THUMB_SIZE_PX,
  LIST_SCROLL_TRACK_SIZE_PX,
  ListScrollIndicator,
  listScrollGeometry,
} from './list-scroll-indicator'

GlobalRegistrator.register()
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true })

let container: HTMLDivElement
let root: Root

beforeAll(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterAll(async () => {
  await act(async () => root.unmount())
  container.remove()
  GlobalRegistrator.unregister()
})

describe('the list-owned scroll indicator', () => {
  test('is absent whenever the row window cannot move', () => {
    expect(listScrollGeometry(8, 8, 0)).toBeNull()
    expect(listScrollGeometry(4, 8, 0)).toBeNull()
    expect(renderToStaticMarkup(<ListScrollIndicator totalRows={8} visibleRows={8} windowStart={0} />)).toBe('')
  })

  test('derives start, middle, and end geometry from the authoritative row window', () => {
    expect(listScrollGeometry(16, 8, 0)).toEqual({
      thumbSizePx: 91.5,
      thumbOffsetPx: 0,
      windowStart: 0,
    })
    expect(listScrollGeometry(16, 8, 4)).toEqual({
      thumbSizePx: 91.5,
      thumbOffsetPx: 45.75,
      windowStart: 4,
    })
    expect(listScrollGeometry(16, 8, 8)).toEqual({
      thumbSizePx: 91.5,
      thumbOffsetPx: 91.5,
      windowStart: 8,
    })
  })

  test('clamps stale window starts before publishing diagnostic geometry', () => {
    expect(listScrollGeometry(16, 8, -4)?.windowStart).toBe(0)
    expect(listScrollGeometry(16, 8, 99)?.windowStart).toBe(8)
  })

  test('recomputes one mounted indicator as provider-backed lengths change', async () => {
    await act(async () => root.render(
      <ListScrollIndicator totalRows={120} visibleRows={8} windowStart={56} />,
    ))
    expect(container.querySelector('.wp-list-scroll')?.getAttribute('data-thumb-size')).toBe('12.200px')
    expect(container.querySelector('.wp-list-scroll')?.getAttribute('data-thumb-offset')).toBe('85.400px')

    await act(async () => root.render(
      <ListScrollIndicator totalRows={4} visibleRows={8} windowStart={0} />,
    ))
    expect(container.querySelector('.wp-list-scroll')).toBeNull()

    await act(async () => root.render(
      <ListScrollIndicator totalRows={10_000} visibleRows={8} windowStart={9_992} />,
    ))
    expect(container.querySelector('.wp-list-scroll')?.getAttribute('data-thumb-size')).toBe('5.000px')
    expect(container.querySelector('.wp-list-scroll')?.getAttribute('data-thumb-offset')).toBe('178.000px')
  })

  test('uses the effective minimum thumb in the ten-thousand-row end travel', () => {
    const geometry = listScrollGeometry(10_000, 8, 9_992)
    expect(geometry).toEqual({
      thumbSizePx: LIST_SCROLL_MINIMUM_THUMB_SIZE_PX,
      thumbOffsetPx: LIST_SCROLL_TRACK_SIZE_PX - LIST_SCROLL_MINIMUM_THUMB_SIZE_PX,
      windowStart: 9_992,
    })
    expect((geometry?.thumbOffsetPx ?? 0) + (geometry?.thumbSizePx ?? 0)).toBe(
      LIST_SCROLL_TRACK_SIZE_PX,
    )
  })

  test('renders crisp fixed-track geometry without becoming semantic content', () => {
    const html = renderToStaticMarkup(
      <ListScrollIndicator totalRows={120} visibleRows={8} windowStart={56} />,
    )
    expect(html).toContain('class="wp-list-scroll"')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('class="wp-list-scroll__well"')
    expect(html).toContain('class="wp-list-scroll__thumb"')
    expect(html).toContain('data-thumb-size="12.200px"')
    expect(html).toContain('data-thumb-offset="85.400px"')
  })

  test('documents the reusable component contract at its export', () => {
    const source = readFileSync(new URL('./list-scroll-indicator.tsx', import.meta.url), 'utf8')
    const exportOffset = source.indexOf('export function ListScrollIndicator')
    const documentationOffset = source.lastIndexOf('/**', exportOffset)
    expect(source.slice(documentationOffset, exportOffset)).toContain('authoritative row window')
    expect(source.slice(documentationOffset, exportOffset)).not.toContain('export ')
  })
})
