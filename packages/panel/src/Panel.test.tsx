import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { currentScreenAtom, deviceStore, resetStackActionAtom } from '@webpod/state'

import { Panel } from './Panel'
import { nowPlayingFrame } from './model'

describe('the bare DOM panel', () => {
  test('mounts as a bare semantic DOM surface', () => {
    const html = renderToStaticMarkup(<Panel colourway="dark" />)
    expect(html).toContain('aria-label="webPod music player"')
    expect(html).toContain('aria-label="Music categories"')
    expect(html).not.toContain(`<${'can' + 'vas'}`)
  })

  test('server rendering is pure and cannot seed document-global navigation', () => {
    deviceStore.set(resetStackActionAtom, [])
    expect(deviceStore.get(currentScreenAtom)).toBeNull()
    renderToStaticMarkup(<Panel />)
    expect(deviceStore.get(currentScreenAtom)).toBeNull()
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
    const source = readFileSync(new URL('./Panel.tsx', import.meta.url), 'utf8')
    expect(source).toMatch(/Array\.from\(\{ length: 8 \}/)
  })

  test('locks the authored iPod screen hierarchy and split-panel rhythm', () => {
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
    expect(css).toMatch(/\.wp-titlebar\s*\{[^}]*block-size:\s*21px/s)
    expect(css).toMatch(/\.wp-menu-split\s*\{[^}]*grid-template-columns:\s*168px 104px/s)
    expect(css).toMatch(/\.wp-menu-row\s*\{[^}]*block-size:\s*21px/s)
    expect(css).toMatch(/\.wp-now-body\s*\{[^}]*grid-template-columns:\s*88px minmax\(0, 1fr\)/s)
    expect(css).toMatch(/\.wp-art--large\s*\{[^}]*88px/s)
  })

  test('forced-airy menus use four ruled rows without changing compact row geometry', () => {
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
    const airyListRule = css.match(
      /\.wp-panel\[data-density="airy"\]\[data-visible-rows="4"\] \.wp-menu-list\s*\{([^}]*)\}/s,
    )?.[1]
    const airyRule = css.match(
      /\.wp-panel\[data-density="airy"\]\[data-visible-rows="4"\] \.wp-menu-row\s*\{([^}]*)\}/s,
    )?.[1]

    expect(airyListRule).toBeDefined()
    expect(airyListRule).toMatch(/display:\s*grid/)
    expect(airyListRule).toMatch(/grid-template-rows:\s*repeat\(4, 44px\)/)
    expect(airyRule).toBeDefined()
    expect(airyRule).toMatch(/block-size:\s*auto/)
    expect(airyRule).toMatch(/font-size:\s*17px/)
    expect(css).toMatch(/\.wp-menu-row\s*\{[^}]*block-size:\s*21px/s)
    expect(css).toMatch(/\.wp-menu-row\s*\{[^}]*font-size:\s*11px/s)
  })

  test('never authors final panel text below eleven pixels', () => {
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
    const sizes = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((match) => Number(match[1]))
    expect(sizes.length).toBeGreaterThan(0)
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11)
  })

  test('native interactive targets are at least forty-four panel pixels before preview scaling', () => {
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
    const actionRule = css.match(/\.wp-actions button\s*\{([^}]*)\}/)?.[1]
    expect(actionRule).toBeDefined()
    expect(actionRule).toMatch(/min-inline-size:\s*44px/)
    expect(actionRule).toMatch(/min-block-size:\s*44px/)
  })

  test('uses provider commands, subscriptions, and TanStack virtualization', () => {
    const source = readFileSync(new URL('./Panel.tsx', import.meta.url), 'utf8')
    expect(source).toContain('fixtureProvider.play(')
    expect(source).toContain('fixtureProvider.onPlaybackChange')
    expect(source).toContain('fixtureProvider.onProgress')
    expect(source).toContain('useVirtualizer(')
  })

  test('offline mode remains cached metadata and never restores the cut download product', () => {
    const source = readFileSync(new URL('./Panel.tsx', import.meta.url), 'utf8')
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
    expect(source).toContain('cached library metadata')
    expect(source).toContain('Playback unavailable; cached metadata shown')
    expect(source).not.toMatch(/Downloads|downloaded|Play downloads|⤓/i)
    expect(css).not.toMatch(/downloaded/i)
  })

  test('contains the three required accessibility preference branches', () => {
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(css).toContain('prefers-reduced-transparency: reduce')
    expect(css).toContain('prefers-contrast: more')
  })

  test('reduced motion removes every authored panel animation and transition', () => {
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
    const reducedMotion = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n[ ]{2}\}/)?.[1]
    expect(reducedMotion).toBeDefined()
    expect(reducedMotion).toContain('.wp-panel *::before')
    expect(reducedMotion).toContain('.wp-panel *::after')
    expect(reducedMotion).toContain('.wp-panel[data-state="success-confirmation"] [aria-current="true"]')
    expect(reducedMotion).toContain('.wp-panel[data-colourway][data-state="success-confirmation"] .wp-now-body')
    expect(reducedMotion).toContain('.wp-panel .wp-progress i { transition: none; }')
    expect(reducedMotion).toMatch(/animation:\s*none/)
    expect(reducedMotion).toMatch(/transition:\s*none/)
  })

  test('light tertiary text uses the AA-verified hierarchy token', () => {
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
    const lightRule = css.match(/\.wp-panel\[data-colourway="light"\]\s*\{([^}]*)\}/)?.[1]
    expect(lightRule).toBeDefined()
    expect(lightRule).toMatch(/--wp-text-2:\s*#475569/)
    expect(lightRule).toMatch(/--wp-text-3:\s*#52647a/)
  })

  test('keeps the package boundary compatible with DOM rasterization', () => {
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
    expect(css).not.toMatch(/mix-blend-mode\s*:/)
    expect(css).not.toMatch(/(?:^|[;{])\s*(?:backdrop-)?filter\s*:/m)
    expect(css).toContain('.wp-now-body::before')
    expect(css).toContain('prefers-reduced-transparency: reduce')
  })

  test('gives passive S13 playback glyphs accurate non-interactive semantics', () => {
    deviceStore.set(resetStackActionAtom, [nowPlayingFrame()])
    const html = renderToStaticMarkup(<Panel state="ready" />)

    expect(html).toContain('class="wp-actions" role="group" aria-label="Playback status"')
    for (const [label, icon] of [['Shuffle on', 'shuffle'], ['Repeat off', 'repeat'], ['Rate', 'star'], ['Queue', 'queue']] as const) {
      expect(html).toContain(`<span role="img" aria-label="${label}"><span aria-hidden="true"><svg class="wp-icon wp-icon--${icon}"`)
    }
    expect(html).not.toMatch(/<span aria-label="(?:Shuffle on|Repeat off|Rate|Queue)"/)
  })

  test('keeps S13 capability absence and the Love interaction unchanged', () => {
    deviceStore.set(resetStackActionAtom, [nowPlayingFrame()])
    const html = renderToStaticMarkup(<Panel state="ready" />)

    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html).toContain('<button type="button" aria-label="Love track" aria-pressed="false"')
    expect(html).not.toMatch(/Lyrics|Remove from playlist|Reorder playlist|Remove from queue|Reorder queue|Downloaded only/i)
  })
})
