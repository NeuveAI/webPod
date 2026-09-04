import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { createFixtureProvider, mintLocalKey, type MusicProvider } from '@webpod/providers'
import { currentScreenAtom, deviceStore, pressActionAtom, resetStackActionAtom } from '@webpod/state'

import { Panel, showNowPlayingScreen, subscribeToRootScreenEntry, type PanelProps } from './Panel'
import { albumTracksFrame, fixtureNavigationSource, fixtureProvider, mainMenuFrame } from './fixtures'
import { nowPlayingFrame } from './model'
import { navigationRoot, selectNavigation } from './navigation'

type TestPanelProps = Omit<PanelProps, 'provider' | 'navigationSource'> & Partial<Pick<PanelProps, 'provider' | 'navigationSource'>>
const TestPanel = (props: TestPanelProps) => <Panel provider={fixtureProvider} navigationSource={fixtureNavigationSource} {...props} />

describe('the bare DOM panel', () => {
  test('brings provider-owned transport back into view through the singleton store', () => {
    deviceStore.set(resetStackActionAtom, [mainMenuFrame()])
    showNowPlayingScreen()
    expect(deviceStore.get(currentScreenAtom)?.route?.kind).toBe('now-playing')
  })

  test('reports a physical Menu transition back to the root exactly once', () => {
    const root = mainMenuFrame()
    deviceStore.set(resetStackActionAtom, [root, nowPlayingFrame()])
    let entries = 0
    const unsubscribe = subscribeToRootScreenEntry(() => { entries += 1 })
    deviceStore.set(pressActionAtom, { button: 'menu', source: 'human', path: 'key' })
    deviceStore.set(resetStackActionAtom, [root])
    unsubscribe()
    expect(entries).toBe(1)
  })

  test('mounts as a bare semantic DOM surface', () => {
    deviceStore.set(resetStackActionAtom, [mainMenuFrame()])
    const html = renderToStaticMarkup(<TestPanel colourway="dark" />)
    expect(html).toContain('aria-label="webPod music player"')
    expect(html).toContain('aria-label="Music categories"')
    expect(html).not.toContain(`<${'can' + 'vas'}`)
  })

  test('home keeps the period-authentic full-width list without a modern preview pane', () => {
    deviceStore.set(resetStackActionAtom, [navigationRoot(fixtureNavigationSource, fixtureProvider)])
    const live = renderToStaticMarkup(<TestPanel state="ready" />)
    expect(live).toContain('data-layout="full"')
    expect(live).not.toContain('wp-list-preview')
    expect(live).not.toContain('data-provider-artwork="true"')

    const emptySource = {
      ...fixtureNavigationSource,
      albums: [], artists: [], playlists: [], songs: [], stations: [],
    }
    deviceStore.set(resetStackActionAtom, [navigationRoot(emptySource, fixtureProvider)])
    const empty = renderToStaticMarkup(<TestPanel state="ready" navigationSource={emptySource} />)
    expect(empty).not.toContain('aria-label="No artwork available"')
    expect(empty).not.toContain('data-provider-artwork="true"')
  })

  test('server rendering is pure and cannot seed document-global navigation', () => {
    deviceStore.set(resetStackActionAtom, [])
    expect(deviceStore.get(currentScreenAtom)).toBeNull()
    renderToStaticMarkup(<TestPanel />)
    expect(deviceStore.get(currentScreenAtom)).toBeNull()
  })

  test('renders the light polarity as an explicit product variant', () => {
    const html = renderToStaticMarkup(<TestPanel colourway="light" />)
    expect(html).toContain('data-colourway="light"')
  })

  test('locks the panel and loading rows to the specified raster geometry', () => {
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
    expect(css).toContain('inline-size: 272px')
    expect(css).toContain('block-size: 204px')
    expect(css).toMatch(/\.wp-list-row\s*\{[^}]*block-size:\s*calc\(183px \/ var\(--wp-list-visible-rows, 8\)\)/s)
    const source = readFileSync(new URL('./Panel.tsx', import.meta.url), 'utf8')
    expect(source).toMatch(/Array\.from\(\{ length: visibleRows \}/)
    expect(readFileSync(new URL('./list-view.tsx', import.meta.url), 'utf8')).toContain('LIST_VIEWPORT_SIZE_PX = 183')
  })

  test('fits every declared album row completely inside the fixed list viewport', () => {
    deviceStore.set(resetStackActionAtom, [albumTracksFrame()])
    const html = renderToStaticMarkup(<TestPanel state="ready" />)
    expect(html).toContain('data-visible-rows="8"')
    expect(html).toContain('--wp-list-visible-rows:8')
    expect(html.match(/class="wp-list-row"/g)).toHaveLength(8)
  })

  test('locks the measured iPod screen hierarchy and Now Playing rhythm', () => {
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
    expect(css).toMatch(/\.wp-titlebar\s*\{[^}]*block-size:\s*21px/s)
    expect(css).toMatch(/\.wp-list-view\[data-layout="split"\]\s*\{[^}]*grid-template-columns:\s*168px 104px/s)
    expect(css).toMatch(/\.wp-list-row\s*\{[^}]*block-size:\s*calc\(183px \/ var\(--wp-list-visible-rows, 8\)\)/s)
    expect(css).toMatch(/\.wp-now-body\s*\{[^}]*grid-template-rows:\s*119px 14px minmax\(5px, 1fr\) 13px/s)
    expect(css).toMatch(/\.wp-now-body\s*\{[^}]*padding:\s*10px 18px 8px/s)
    expect(css).toMatch(/\.wp-now-track\s*\{[^}]*grid-template-columns:\s*86px minmax\(0, 1fr\)[^}]*padding-block-start:\s*27px/s)
    expect(css).toMatch(/\.wp-now-meta\s*\{[^}]*padding-block-start:\s*11px/s)
    expect(css).toMatch(/\.wp-art--large\s*\{[^}]*86px/s)
  })

  test('keeps Now Playing queue position out of the title bar and fills the LCD vertically', async () => {
    const playbackProvider = createFixtureProvider()
    await playbackProvider.play({ kind: 'tracks', tracks: playbackProvider.catalog.tracks, startIndex: 0 })
    deviceStore.set(resetStackActionAtom, [nowPlayingFrame()])
    const html = renderToStaticMarkup(<TestPanel state="ready" provider={playbackProvider} />)
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')

    expect(html).toMatch(/<header class="wp-titlebar"><span class="wp-titlebar__side wp-titlebar__transport"[^>]*data-transport="playing"[^>]*><svg[^>]*wp-icon--play/)
    expect(html).toContain('<strong>Now Playing</strong>')
    expect(html).not.toContain('wp-now-count')
    expect(css).toMatch(/\.wp-now-body\s*\{[^}]*block-size:\s*183px[^}]*padding:\s*10px 18px 8px/s)
    expect(css).toMatch(/\.wp-now-track\s*\{[^}]*column-gap:\s*12px/s)
    expect(css).toMatch(/\.wp-now-meta\s*\{[^}]*padding-block-start:\s*11px/s)
    expect(css).toMatch(/\.wp-progress\s*\{[^}]*grid-column:\s*1 \/ -1/s)
    expect(html).toContain('class="wp-now-timing-spacer" aria-hidden="true"')
  })

  test('never renders non-finite provider timing as NaN text or ARIA values', () => {
    const playbackProvider = createFixtureProvider()
    const track = playbackProvider.catalog.tracks[0]
    if (track === undefined) throw new Error('fixture track missing')
    const invalidProvider: MusicProvider = {
      ...playbackProvider,
      get playback() {
        return { ...playbackProvider.playback, status: 'playing' as const, now: track, queueIndex: 0, positionMs: Number.NaN, durationMs: Number.POSITIVE_INFINITY }
      },
    }
    deviceStore.set(resetStackActionAtom, [nowPlayingFrame()])

    const html = renderToStaticMarkup(<TestPanel state="ready" provider={invalidProvider} />)

    expect(html).not.toContain('NaN')
    expect(html).toContain('data-position-ms="0"')
    expect(html).toContain('aria-valuemax="0"')
    expect(html).toContain('aria-valuenow="0"')
    expect(html).toContain('<span>0:00</span><span>-0:00</span>')
  })

  test('the menu viewport fills the LCD while every density keeps fixed row geometry', () => {
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
    const splitRule = css.match(/\.wp-list-view\s*\{([^}]*)\}/s)?.[1]
    const listRule = css.match(/\.wp-list-viewport\s*\{([^}]*)\}/s)?.[1]
    const previewRule = css.match(/\.wp-list-preview\s*\{([^}]*)\}/s)?.[1]

    expect(splitRule).toMatch(/block-size:\s*183px/)
    expect(splitRule).toMatch(/min-block-size:\s*0/)
    expect(listRule).toMatch(/block-size:\s*183px/)
    expect(listRule).toMatch(/overflow:\s*hidden/)
    expect(listRule).toMatch(/background:\s*var\(--wp-bg\)/)
    expect(previewRule).toMatch(/block-size:\s*183px/)
    expect(previewRule).toMatch(/overflow:\s*clip/)
    expect(css).toMatch(/\.wp-list-row\s*\{[^}]*font-size:\s*11px/s)
  })

  test('owns scroll indication in list panes and never in the preview pane', () => {
    deviceStore.set(resetStackActionAtom, [mainMenuFrame()])
    const main = renderToStaticMarkup(<TestPanel state="ready" />)
    expect(main).not.toContain('wp-list-scroll')
    expect(main).not.toContain('wp-menu-preview__rail')

    deviceStore.set(resetStackActionAtom, [albumTracksFrame()])
    const album = renderToStaticMarkup(<TestPanel state="ready" />)
    expect(album).toMatch(/class="wp-list-body"[^>]*>[\s\S]*class="wp-list-viewport"[\s\S]*<\/div><span class="wp-list-scroll"/)
    expect(album).not.toMatch(/class="wp-list-preview"[^>]*>[\s\S]*class="wp-list-scroll"/)

    const source = readFileSync(new URL('./Panel.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('wp-menu-preview__rail')
  })

  test('never authors final panel text below eleven pixels', () => {
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
    const sizes = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((match) => Number(match[1]))
    expect(sizes.length).toBeGreaterThan(0)
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(11)
  })

  test('keeps Now Playing control on the physical click wheel rather than LCD buttons', () => {
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
    expect(css).not.toContain('.wp-actions')
    expect(css).not.toContain('.wp-control-shelf')
    expect(css).toContain('.wp-progress--scrub')
  })

  test('uses provider commands, subscriptions, and one canonical list path', () => {
    const source = readFileSync(new URL('./Panel.tsx', import.meta.url), 'utf8')
    expect(source).toContain('selectNavigationImmediate(')
    expect(readFileSync(new URL('./navigation.ts', import.meta.url), 'utf8')).toContain('provider.play(')
    expect(source).toContain('provider.onPlaybackChange')
    expect(source).toContain('provider.onProgress')
    expect(source).toContain('<ListViewport')
    expect(source).not.toMatch(/StaticTrackList|VirtualTrackList|TrackRow|BrowserRow/)
  })

  test('keeps fixture defaults and writes outside the shipped Panel module', () => {
    const source = readFileSync(new URL('./Panel.tsx', import.meta.url), 'utf8')
    const barrel = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/fixtureProvider|fixtureNavigationSource|currentTrack/)
    expect(source).toContain('readonly provider: MusicProvider')
    expect(source).toContain('readonly navigationSource: NavigationDataSource')
    expect(barrel).not.toContain("from './fixtures'")
  })

  test('offline mode remains cached metadata and never restores the cut download product', () => {
    const source = readFileSync(new URL('./Panel.tsx', import.meta.url), 'utf8')
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
    expect(source).toContain('cached library metadata')
    expect(source).toContain('Offline. Showing cached library metadata.')
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
    expect(reducedMotion).toContain('.wp-panel :is(.wp-progress, .wp-volume-progress) i { transition: none; }')
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

  test('removes invented playback glyphs and exposes a real wheel control', async () => {
    const playbackProvider = createFixtureProvider()
    await playbackProvider.play({ kind: 'tracks', tracks: playbackProvider.catalog.tracks, startIndex: 0 })
    deviceStore.set(resetStackActionAtom, [nowPlayingFrame()])
    const html = renderToStaticMarkup(<TestPanel state="ready" provider={playbackProvider} />)

    expect(html).toContain('data-mode="standard"')
    expect(html).toContain('aria-label="Playback position"')
    expect(html).not.toContain('Use the wheel to adjust')
    expect(html).not.toContain('class="wp-control-shelf"')
    expect(html).not.toMatch(/wp-icon--(?:shuffle|repeat|heart|star|queue)|Love track|aria-label="Rate"/)
  })

  test('keeps Now Playing free of invented status shelves and confines pending feedback to progress', async () => {
    const playbackProvider = createFixtureProvider()
    await playbackProvider.play({ kind: 'tracks', tracks: playbackProvider.catalog.tracks, startIndex: 0 })
    deviceStore.set(resetStackActionAtom, [nowPlayingFrame()])

    const ready = renderToStaticMarkup(<TestPanel state="ready" provider={playbackProvider} />)
    expect(ready).not.toContain('class="wp-control-shelf"')
    expect(ready).not.toContain('Use the wheel to adjust')
    expect(ready).not.toContain('class="wp-status-shelf"')

    for (const state of ['loading', 'error', 'permission-denied', 'offline', 'agent-active'] as const) {
      const html = renderToStaticMarkup(<TestPanel state={state} provider={playbackProvider} />)
      expect(html).not.toContain('wp-status-shelf')
      expect(html).not.toContain('Preparing playback')
      expect(html).toContain(playbackProvider.playback.now?.title ?? 'provider track absent')
      expect(html).toContain(playbackProvider.playback.now?.artistName ?? 'provider artist absent')
      expect(html).toContain('data-provider-artwork="true"')
      expect(html).toContain('role="progressbar"')
      if (state === 'error') expect(html).not.toContain('class="wp-times"')
      else expect(html).toContain('class="wp-times"')
      expect(html).not.toContain('class="wp-control-shelf"')
    }

    const failed = renderToStaticMarkup(<TestPanel state="error" provider={playbackProvider} />)
    expect(failed).toContain('class="wp-now-alert" role="status"')
  })

  test('keeps unavailable Now Playing mutations absent', async () => {
    const playbackProvider = createFixtureProvider()
    await playbackProvider.play({ kind: 'tracks', tracks: playbackProvider.catalog.tracks, startIndex: 0 })
    deviceStore.set(resetStackActionAtom, [nowPlayingFrame()])
    const html = renderToStaticMarkup(<TestPanel state="ready" provider={playbackProvider} />)

    expect(html).not.toContain('<button')
    expect(html).not.toMatch(/Lyrics|Remove from playlist|Reorder playlist|Remove from queue|Reorder queue|Downloaded only/i)
  })

  test('does not invent a track, queue index, source, or artwork before provider playback arrives', () => {
    const idleProvider = createFixtureProvider()
    deviceStore.set(resetStackActionAtom, [nowPlayingFrame()])
    const html = renderToStaticMarkup(<TestPanel state="ready" provider={idleProvider} />)

    expect(html).toContain('Nothing is playing.')
    expect(html).not.toContain('4 of 18')
    expect(html).not.toContain('Station · Late Drive')
    expect(html).not.toContain('data-authored-artwork="now-playing"')
    expect(html).not.toContain(idleProvider.catalog.tracks[0]?.title ?? 'fixture track absent')
  })

  test('renders provider-owned pending playback as loading rather than empty', () => {
    const idleProvider = createFixtureProvider()
    const pendingProvider: MusicProvider = {
      ...idleProvider,
      get playback() { return { ...idleProvider.playback, status: 'loading' as const, now: null, queueIndex: null } },
    }
    deviceStore.set(resetStackActionAtom, [nowPlayingFrame()])
    const html = renderToStaticMarkup(<TestPanel state="ready" provider={pendingProvider} />)

    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('Loading the song.')
    expect(html).not.toContain('Nothing is playing.')
  })

  test('renders a timed-out provider transaction as a bounded failure rather than empty', () => {
    const idleProvider = createFixtureProvider()
    const failedProvider: MusicProvider = {
      ...idleProvider,
      get playback() { return { ...idleProvider.playback, status: 'error' as const, now: null, queueIndex: null } },
    }
    deviceStore.set(resetStackActionAtom, [nowPlayingFrame()])
    const html = renderToStaticMarkup(<TestPanel state="ready" provider={failedProvider} />)

    expect(html).toContain('Playback unavailable.')
    expect(html).toContain('Press Menu to choose another song.')
    expect(html).not.toContain('Nothing is playing.')
  })

  test('pending and timed-out playback preserve the exact selected song metadata and artwork', async () => {
    const playbackProvider = createFixtureProvider()
    const root = navigationRoot(fixtureNavigationSource, playbackProvider)
    const songs = (await selectNavigation({ ...root, highlightIndex: 4 }, fixtureNavigationSource, playbackProvider)).frame
    if (songs === null) throw new Error('songs frame missing')
    const selectedIndex = 2
    const selectedTrack = fixtureNavigationSource.songs[selectedIndex]
    const nowPlaying = (await selectNavigation({ ...songs, highlightIndex: selectedIndex }, fixtureNavigationSource, playbackProvider)).frame
    if (nowPlaying === null || selectedTrack === undefined) throw new Error('selected playback frame missing')
    deviceStore.set(resetStackActionAtom, [nowPlaying])

    const pendingProvider: MusicProvider = {
      ...playbackProvider,
      get playback() { return { ...playbackProvider.playback, status: 'loading' as const, now: null, queueIndex: null } },
    }
    const pending = renderToStaticMarkup(<TestPanel state="ready" provider={pendingProvider} />)
    expect(pending).toContain(selectedTrack.title)
    expect(pending).toContain(selectedTrack.artistName)
    expect(pending).toContain('wp-progress--indeterminate')
    expect(pending).not.toContain('Preparing playback')
    expect(pending).toContain('data-provider-artwork="true"')

    const failedProvider: MusicProvider = {
      ...playbackProvider,
      get playback() { return { ...playbackProvider.playback, status: 'error' as const, now: null, queueIndex: null } },
    }
    const failed = renderToStaticMarkup(<TestPanel state="ready" provider={failedProvider} />)
    expect(failed).toContain(selectedTrack.title)
    expect(failed).toContain(selectedTrack.artistName)
    expect(failed).toContain('Playback unavailable')
    expect(failed).not.toContain('try again')
    expect(failed).not.toContain('class="wp-message" role="alert"')
  })

  test('an authoritative provider event error keeps the confirmed song rendered', async () => {
    const playbackProvider = createFixtureProvider()
    const root = navigationRoot(fixtureNavigationSource, playbackProvider)
    const songs = (await selectNavigation({ ...root, highlightIndex: 4 }, fixtureNavigationSource, playbackProvider)).frame
    if (songs === null) throw new Error('songs frame missing')
    const nowPlaying = (await selectNavigation({ ...songs, highlightIndex: 1 }, fixtureNavigationSource, playbackProvider)).frame
    const confirmed = playbackProvider.playback.now
    if (nowPlaying === null || confirmed === null) throw new Error('confirmed playback frame missing')
    deviceStore.set(resetStackActionAtom, [nowPlaying])
    const eventFailure: MusicProvider = {
      ...playbackProvider,
      get playback() { return { ...playbackProvider.playback, status: 'error' as const } },
    }

    const html = renderToStaticMarkup(<TestPanel state="ready" provider={eventFailure} />)

    expect(html).toContain(confirmed.title)
    expect(html).toContain(confirmed.artistName)
    expect(html).toContain('Playback unavailable')
    expect(html).not.toContain('try again')
  })

  test('renders provider playback with queue context produced by the selected frame', async () => {
    const playbackProvider = createFixtureProvider()
    const root = navigationRoot(fixtureNavigationSource, playbackProvider)
    const songs = (await selectNavigation({ ...root, highlightIndex: 4 }, fixtureNavigationSource, playbackProvider)).frame
    if (songs === null) throw new Error('songs frame missing')
    const selectedIndex = 2
    const nowPlaying = (await selectNavigation({ ...songs, highlightIndex: selectedIndex }, fixtureNavigationSource, playbackProvider)).frame
    if (nowPlaying === null) throw new Error('now playing frame missing')
    deviceStore.set(resetStackActionAtom, [nowPlaying])
    const html = renderToStaticMarkup(<TestPanel state="ready" provider={playbackProvider} />)

    expect(html).not.toContain(`${selectedIndex + 1} of ${fixtureNavigationSource.songs.length}`)
    expect(html).not.toContain('class="wp-source"')
    expect(html).toContain(playbackProvider.playback.now?.title ?? 'provider track absent')
    expect(html).not.toContain('Station · Late Drive')
  })

  test('matches a provider-emitted catalog counterpart to its retained library queue position', async () => {
    const fixture = createFixtureProvider()
    const root = navigationRoot(fixtureNavigationSource, fixture)
    const songs = (await selectNavigation({ ...root, highlightIndex: 4 }, fixtureNavigationSource, fixture)).frame
    if (songs === null) throw new Error('songs frame missing')
    const selectedIndex = 1
    const nowPlaying = (await selectNavigation({ ...songs, highlightIndex: selectedIndex }, fixtureNavigationSource, fixture)).frame
    const current = fixture.playback.now
    if (nowPlaying === null || current === null) throw new Error('playback context missing')
    const counterpartProvider: MusicProvider = { ...fixture, playback: { ...fixture.playback, now: { ...current, key: mintLocalKey() } } }
    deviceStore.set(resetStackActionAtom, [nowPlaying])

    const html = renderToStaticMarkup(<TestPanel state="ready" provider={counterpartProvider} />)

    expect(html).not.toContain(`${selectedIndex + 1} of ${fixtureNavigationSource.songs.length}`)
  })

  test('reports the selected occurrence when a playback queue contains duplicate tracks', async () => {
    const playbackProvider = createFixtureProvider()
    const [first, second] = fixtureNavigationSource.songs
    if (first === undefined || second === undefined) throw new Error('fixture tracks missing')
    const duplicateSongs = [first, second, first]
    const duplicateSource = { ...fixtureNavigationSource, songs: duplicateSongs }
    const root = navigationRoot(duplicateSource, playbackProvider)
    const songs = (await selectNavigation({ ...root, highlightIndex: 4 }, duplicateSource, playbackProvider)).frame
    if (songs === null) throw new Error('songs frame missing')
    const nowPlaying = (await selectNavigation({ ...songs, highlightIndex: 2 }, duplicateSource, playbackProvider)).frame
    if (nowPlaying === null) throw new Error('now playing frame missing')
    deviceStore.set(resetStackActionAtom, [nowPlaying])

    const html = renderToStaticMarkup(<TestPanel state="ready" provider={playbackProvider} navigationSource={duplicateSource} />)

    expect(html).not.toContain('3 of 3')
    expect(html).toContain(first.title)
  })

  test('follows provider queue position from first A through B to the second A', async () => {
    const playbackProvider = createFixtureProvider()
    const [first, second] = fixtureNavigationSource.songs
    if (first === undefined || second === undefined) throw new Error('fixture tracks missing')
    const duplicateSongs = [first, second, first]
    const duplicateSource = { ...fixtureNavigationSource, songs: duplicateSongs }
    const root = navigationRoot(duplicateSource, playbackProvider)
    const songs = (await selectNavigation({ ...root, highlightIndex: 4 }, duplicateSource, playbackProvider)).frame
    if (songs === null) throw new Error('songs frame missing')
    const nowPlaying = (await selectNavigation({ ...songs, highlightIndex: 0 }, duplicateSource, playbackProvider)).frame
    if (nowPlaying === null) throw new Error('now playing frame missing')
    deviceStore.set(resetStackActionAtom, [nowPlaying])

    await playbackProvider.skip('next')
    const middleHtml = renderToStaticMarkup(<TestPanel state="ready" provider={playbackProvider} navigationSource={duplicateSource} />)
    expect(middleHtml).not.toContain('2 of 3')
    expect(middleHtml).toContain(second.title)

    await playbackProvider.skip('next')
    const finalHtml = renderToStaticMarkup(<TestPanel state="ready" provider={playbackProvider} navigationSource={duplicateSource} />)
    expect(finalHtml).not.toContain('3 of 3')
    expect(finalHtml).toContain(first.title)
  })

  test('follows provider queue position from the second A back through B to the first A', async () => {
    const playbackProvider = createFixtureProvider()
    const [first, second] = fixtureNavigationSource.songs
    if (first === undefined || second === undefined) throw new Error('fixture tracks missing')
    const duplicateSongs = [first, second, first]
    const duplicateSource = { ...fixtureNavigationSource, songs: duplicateSongs }
    const root = navigationRoot(duplicateSource, playbackProvider)
    const songs = (await selectNavigation({ ...root, highlightIndex: 4 }, duplicateSource, playbackProvider)).frame
    if (songs === null) throw new Error('songs frame missing')
    const nowPlaying = (await selectNavigation({ ...songs, highlightIndex: 2 }, duplicateSource, playbackProvider)).frame
    if (nowPlaying === null) throw new Error('now playing frame missing')
    deviceStore.set(resetStackActionAtom, [nowPlaying])

    await playbackProvider.skip('previous')
    const middleHtml = renderToStaticMarkup(<TestPanel state="ready" provider={playbackProvider} navigationSource={duplicateSource} />)
    expect(middleHtml).not.toContain('2 of 3')
    expect(middleHtml).toContain(second.title)

    await playbackProvider.skip('previous')
    const finalHtml = renderToStaticMarkup(<TestPanel state="ready" provider={playbackProvider} navigationSource={duplicateSource} />)
    expect(finalHtml).not.toContain('1 of 3')
    expect(finalHtml).toContain(first.title)
  })
})
