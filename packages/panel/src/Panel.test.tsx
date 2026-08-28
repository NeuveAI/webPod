import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'

import { Panel } from './Panel'

describe('the bare DOM panel', () => {
  test('mounts as a bare semantic DOM surface', () => {
    const html = renderToStaticMarkup(<Panel colourway="dark" />)
    expect(html).toContain('aria-label="webPod music player"')
    expect(html).toContain('aria-label="Music categories"')
    expect(html).not.toContain(`<${'can' + 'vas'}`)
  })

  test('renders the light polarity as an explicit product variant', () => {
    const html = renderToStaticMarkup(<Panel colourway="light" />)
    expect(html).toContain('data-colourway="light"')
  })

  test('locks the panel and loading rows to the specified raster geometry', () => {
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
    expect(css).toContain('inline-size: 272px')
    expect(css).toContain('block-size: 204px')
    expect(css).toContain('block-size: 26px')
  })

  test('contains the three required accessibility preference branches', () => {
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(css).toContain('prefers-reduced-transparency: reduce')
    expect(css).toContain('prefers-contrast: more')
  })
})
