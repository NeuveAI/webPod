import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { currentScreenAtom, detentActionAtom, deviceStore, resetStackActionAtom, type ScreenFrame } from '@webpod/state'

import { Panel, type PanelProps } from './Panel'
import { albumTracksFrame, fixtureNavigationSource, fixtureProvider } from './fixtures'
import { ListViewport, type ListRowContent } from './list-view'
import { navigationRoot, selectNavigation } from './navigation'

const rows = (count: number): readonly ListRowContent[] => Array.from({ length: count }, (_, index) => ({ index, leading: index + 1, primary: `A very long provider-owned title ${index}`, secondary: 'Secondary', count: String(index), chevron: '›' }))
type TestPanelProps = Omit<PanelProps, 'provider' | 'navigationSource'> & Partial<Pick<PanelProps, 'provider' | 'navigationSource'>>
const TestPanel = (props: TestPanelProps) => <Panel provider={fixtureProvider} navigationSource={fixtureNavigationSource} {...props} />

const renderFrame = (frame: ScreenFrame) => {
  deviceStore.set(resetStackActionAtom, [frame])
  return renderToStaticMarkup(<TestPanel />)
}

describe('the canonical panel list view', () => {
  test('fits exactly eight rows and adds the Aqua rail only for the ninth', () => {
    const eight = renderToStaticMarkup(<ListViewport rows={rows(8)} highlightIndex={0} windowStart={0} label="Eight" panelId="eight" />)
    const nine = renderToStaticMarkup(<ListViewport rows={rows(9)} highlightIndex={0} windowStart={0} label="Nine" panelId="nine" />)
    expect(eight.match(/class="wp-list-row"/g)).toHaveLength(8)
    expect(eight).not.toContain('wp-list-scroll')
    expect(eight).not.toContain('class="wp-list-body" data-overflow="true"')
    expect(nine.match(/class="wp-list-row"/g)).toHaveLength(8)
    expect(nine).toContain('wp-list-scroll')
    expect(nine).toContain('data-overflow="true"')
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
    expect(source).toContain('<OverflowMarquee')
    expect(css).toMatch(/\.wp-list-row\s*\{[^}]*padding-inline:\s*8px 6px[^}]*border-block-end:\s*1px solid var\(--wp-divider\)/s)
    expect(css).toMatch(/\.wp-list-row__primary, \.wp-list-row__secondary \{[^}]*text-overflow:\s*ellipsis/s)
    expect(css).toMatch(/\.wp-marquee\[data-overflow="true"\] \.wp-marquee__moving \{[^}]*animation:\s*wp-title-marquee/s)
    expect(css).toMatch(/prefers-reduced-motion:[\s\S]*\.wp-panel \.wp-marquee\[data-overflow="true"\] \.wp-marquee__moving \{[^}]*animation:\s*none/s)
    expect(css).toMatch(/\.wp-list-row__primary \{ grid-column: 2; \}/)
    expect(css).toMatch(/\.wp-list-row__chevron \{ grid-column: 6; \}/)
    expect(css).toMatch(/\.wp-list-row\[aria-current="true"\]\s*\{[^}]*background:\s*var\(--wp-selection-material\)/s)
  })

  test('every named collection family renders the same current row primitive and follows a wheel detent when scrollable', async () => {
    const root = navigationRoot(fixtureNavigationSource, fixtureProvider)
    const choose = async (frame: ScreenFrame, index: number, searchQuery = '') => {
      const result = await selectNavigation({ ...frame, highlightIndex: index }, fixtureNavigationSource, fixtureProvider, searchQuery)
      if (result.frame === null) throw new Error(`expected destination from ${frame.route?.kind ?? 'root'} row ${index}`)
      return result.frame
    }
    const rootFrame = async (label: string) => {
      const index = root.rows.findIndex((row) => row.label === label)
      if (index < 0) throw new Error(`missing ${label} root row`)
      return choose(root, index)
    }
    const playlists = await rootFrame('Playlists')
    const artists = await rootFrame('Artists')
    const albums = await rootFrame('Albums')
    const genres = await rootFrame('Genres')
    const searchEntry = await rootFrame('Search')
    const genreFacets = await choose(genres, 0)
    const namedFrames: readonly (readonly [string, ScreenFrame])[] = [
      ['root', root],
      ['playlists', playlists],
      ['artists', artists],
      ['albums', albums],
      ['songs', await rootFrame('Songs')],
      ['genres', genres],
      ['radio', await rootFrame('Radio')],
      ['search entry', searchEntry],
      ['search results', await choose(searchEntry, 0)],
      ['artist albums', await choose(artists, 0)],
      ['genre facets', genreFacets],
      ['genre artists', await choose(genreFacets, 0)],
      ['genre albums', await choose(genreFacets, 1)],
      ['genre tracks', await choose(genreFacets, 2)],
      ['album tracks', await choose(albums, 0)],
      ['playlist tracks', await choose(playlists, 0)],
    ]
    expect(namedFrames.map(([name]) => name)).toEqual(['root', 'playlists', 'artists', 'albums', 'songs', 'genres', 'radio', 'search entry', 'search results', 'artist albums', 'genre facets', 'genre artists', 'genre albums', 'genre tracks', 'album tracks', 'playlist tracks'])
    for (const [name, frame] of namedFrames) {
      const before = renderFrame({ ...frame, highlightIndex: 0, windowStart: 0 })
      expect(before).toMatch(/class="wp-list-row"[^>]*aria-current="true"/)
      expect(`${name}:${before}`).toContain('data-list-viewport="true"')
      if (frame.rows.length > 1) {
        deviceStore.set(detentActionAtom, { path: 'direct', source: 'human', detents: 1, timestampMs: 1 })
        const moved = deviceStore.get(currentScreenAtom)
        expect(`${name}:${moved?.highlightIndex}`).toBe(`${name}:1`)
        const after = renderToStaticMarkup(<TestPanel />)
        expect(after).toMatch(/class="wp-list-row"[^>]*aria-current="true"/)
      }
    }
  })

  test('loading skeleton tracks the active 8, 6 and 4 row viewport geometry', () => {
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
    expect(css).toMatch(/\.wp-list-loading \{[^}]*repeat\(var\(--wp-list-visible-rows, 8\), 1fr\)/s)
    expect(css).not.toContain('--wp-visible-rows')
    for (const visibleRows of [8, 6, 4]) {
      const markup = renderToStaticMarkup(<ListViewport rows={rows(visibleRows)} highlightIndex={0} windowStart={0} visibleRows={visibleRows} label={`${visibleRows} rows`} panelId={`rows-${visibleRows}`} message={<div className="wp-list-loading">{Array.from({ length: visibleRows }, (_, index) => <i key={index} />)}</div>} />)
      expect(markup).toContain(`--wp-list-visible-rows:${visibleRows}`)
      expect(markup.match(/<i><\/i>/g)).toHaveLength(visibleRows)
    }
  })

  test('period list routes stay full-width without preview copy competing for space', () => {
    const tracks = renderFrame({ ...navigationRoot(fixtureNavigationSource, fixtureProvider), highlightIndex: 1 })
    expect(tracks).toContain('data-layout="full"')
    expect(tracks).not.toContain(`${fixtureNavigationSource.playlists.length} playlists`)
    expect(tracks).not.toContain('wp-list-preview')
    const album = albumTracksFrame()
    const selected = album.rows[1]
    if (selected === undefined) throw new Error('fixture album needs a second track')
    const nested = renderFrame({ ...album, highlightIndex: selected.index })
    expect(nested).toContain(selected.label)
    expect(nested).not.toContain('wp-track-preview')
  })

  test('no bespoke sibling list renderers survive beside the canonical primitive', () => {
    const panel = readFileSync(new URL('./Panel.tsx', import.meta.url), 'utf8')
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
    expect(panel).not.toMatch(/StaticTrackList|VirtualTrackList|TrackRow|wp-menu-row|wp-browser-row|wp-track-row/)
    expect(css).not.toMatch(/wp-menu-row|wp-browser-row|wp-track-row|wp-menu-list|wp-track-list|wp-album-list/)
  })
})
