import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { currentScreenAtom, deviceStore, resetStackActionAtom } from '@webpod/state'

import { Panel } from './Panel'

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
    expect(lightRule).toMatch(/--wp-text-3:\s*#607086/)
  })

  test('keeps the package boundary compatible with DOM rasterization', () => {
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
    expect(css).not.toMatch(/mix-blend-mode\s*:/)
    expect(css).not.toMatch(/(?:^|[;{])\s*(?:backdrop-)?filter\s*:/m)
    expect(css).toContain('.wp-now-body::before')
    expect(css).toContain('prefers-reduced-transparency: reduce')
  })
})
