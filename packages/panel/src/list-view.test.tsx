import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { currentScreenAtom, detentActionAtom, deviceStore, resetStackActionAtom, type ScreenFrame } from '@webpod/state'

import { Panel } from './Panel'
import { albumTracksFrame, fixtureNavigationSource, fixtureProvider } from './model'
import { ListViewport, type ListRowContent } from './list-view'
import { navigationRoot, selectNavigation } from './navigation'

const rows = (count: number): readonly ListRowContent[] => Array.from({ length: count }, (_, index) => ({ index, leading: index + 1, primary: `A very long provider-owned title ${index}`, secondary: 'Secondary', count: String(index), chevron: '›' }))

const renderFrame = (frame: ScreenFrame) => {
  deviceStore.set(resetStackActionAtom, [frame])
  return renderToStaticMarkup(<Panel />)
}

describe('the canonical panel list view', () => {
  test('fits exactly eight rows and adds the Aqua rail only for the ninth', () => {
    const eight = renderToStaticMarkup(<ListViewport rows={rows(8)} highlightIndex={0} windowStart={0} label="Eight" panelId="eight" />)
    const nine = renderToStaticMarkup(<ListViewport rows={rows(9)} highlightIndex={0} windowStart={0} label="Nine" panelId="nine" />)
    expect(eight.match(/class="wp-list-row"/g)).toHaveLength(8)
    expect(eight).not.toContain('wp-list-scroll')
    expect(nine.match(/class="wp-list-row"/g)).toHaveLength(8)
    expect(nine).toContain('wp-list-scroll')
  })

  test('one row primitive owns composition, truncation, geometry and Aqua material', () => {
    const source = readFileSync(new URL('./list-view.tsx', import.meta.url), 'utf8')
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
    expect(source.match(/<li/g)).toHaveLength(1)
    expect(source).toContain('wp-list-row__leading')
    expect(source).toContain('wp-list-row__secondary')
    expect(source).toContain('wp-list-row__count')
    expect(source).toContain('wp-list-row__status')
    expect(source).toContain('wp-list-row__chevron')
    expect(css).toMatch(/\.wp-list-row\s*\{[^}]*padding-inline:\s*8px 6px[^}]*border-block-end:\s*1px solid var\(--wp-divider\)/s)
    expect(css).toMatch(/\.wp-list-row__primary, \.wp-list-row__secondary \{[^}]*text-overflow:\s*ellipsis/s)
    expect(css).toMatch(/\.wp-list-row\[aria-current="true"\]\s*\{[^}]*background:\s*var\(--wp-selection-material\)/s)
  })

  test('every collection family renders the same current row primitive and follows a wheel detent', async () => {
    const root = navigationRoot(fixtureNavigationSource, fixtureProvider)
    const frames: ScreenFrame[] = [root]
    for (const row of root.rows) {
      const selection = await selectNavigation({ ...root, highlightIndex: row.index }, fixtureNavigationSource, fixtureProvider)
      if (selection.frame !== null && selection.frame.rows.length > 1) frames.push(selection.frame)
    }
    const playlists = frames.find((frame) => frame.route?.kind === 'playlists')
    if (playlists !== undefined) {
      const nested = await selectNavigation(playlists, fixtureNavigationSource, fixtureProvider)
      if (nested.frame !== null) frames.push(nested.frame)
    }
    for (const frame of frames) {
      const before = renderFrame({ ...frame, highlightIndex: 0, windowStart: 0 })
      expect(before).toMatch(/class="wp-list-row"[^>]*aria-current="true"/)
      deviceStore.set(detentActionAtom, { path: 'direct', source: 'human', detents: 1, timestampMs: 1 })
      const moved = deviceStore.get(currentScreenAtom)
      expect(moved?.highlightIndex).toBe(1)
      const after = renderToStaticMarkup(<Panel />)
      expect(after).toMatch(/class="wp-list-row"[^>]*aria-current="true"/)
    }
  })

  test('split preview copy tracks the highlighted row', () => {
    const tracks = renderFrame({ ...navigationRoot(fixtureNavigationSource, fixtureProvider), highlightIndex: 1 })
    expect(tracks).toContain(`${fixtureNavigationSource.playlists.length} playlists`)
    const album = albumTracksFrame()
    const selected = album.rows[1]
    if (selected === undefined) throw new Error('fixture album needs a second track')
    const nested = renderFrame({ ...album, highlightIndex: selected.index })
    expect(nested).toMatch(new RegExp(`wp-track-preview[\\s\\S]*${selected.label}`))
  })

  test('no bespoke sibling list renderers survive beside the canonical primitive', () => {
    const panel = readFileSync(new URL('./Panel.tsx', import.meta.url), 'utf8')
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
    expect(panel).not.toMatch(/StaticTrackList|VirtualTrackList|TrackRow|wp-menu-row|wp-browser-row|wp-track-row/)
    expect(css).not.toMatch(/wp-menu-row|wp-browser-row|wp-track-row|wp-menu-list|wp-track-list|wp-album-list/)
  })
})
