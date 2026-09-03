import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { createFixtureProvider, mintLocalKey, type MusicProvider } from '@webpod/providers'
import { currentScreenAtom, deviceStore, resetStackActionAtom } from '@webpod/state'

import { Panel } from './Panel'
import { albumTracksFrame, fixtureNavigationSource, mainMenuFrame, nowPlayingFrame } from './model'
import { navigationRoot, selectNavigation } from './navigation'

describe('the bare DOM panel', () => {
  test('mounts as a bare semantic DOM surface', () => {
    deviceStore.set(resetStackActionAtom, [mainMenuFrame()])
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
    expect(css).toMatch(/\.wp-list-row\s*\{[^}]*block-size:\s*calc\(183px \/ var\(--wp-list-visible-rows, 8\)\)/s)
    const source = readFileSync(new URL('./Panel.tsx', import.meta.url), 'utf8')
    expect(source).toMatch(/Array\.from\(\{ length: visibleRows \}/)
    expect(readFileSync(new URL('./list-view.tsx', import.meta.url), 'utf8')).toContain('LIST_VIEWPORT_SIZE_PX = 183')
  })

  test('fits every declared album row completely inside the fixed list viewport', () => {
    deviceStore.set(resetStackActionAtom, [albumTracksFrame()])
    const html = renderToStaticMarkup(<Panel state="ready" />)
    expect(html).toContain('data-visible-rows="8"')
    expect(html).toContain('--wp-list-visible-rows:8')
    expect(html.match(/class="wp-list-row"/g)).toHaveLength(8)
  })

  test('locks the authored iPod screen hierarchy and split-panel rhythm', () => {
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
    expect(css).toMatch(/\.wp-titlebar\s*\{[^}]*block-size:\s*21px/s)
    expect(css).toMatch(/\.wp-list-view\[data-layout="split"\]\s*\{[^}]*grid-template-columns:\s*168px 104px/s)
    expect(css).toMatch(/\.wp-list-row\s*\{[^}]*block-size:\s*calc\(183px \/ var\(--wp-list-visible-rows, 8\)\)/s)
    expect(css).toMatch(/\.wp-now-body\s*\{[^}]*grid-template-columns:\s*88px minmax\(0, 1fr\)/s)
    expect(css).toMatch(/\.wp-art--large\s*\{[^}]*88px/s)
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
    const main = renderToStaticMarkup(<Panel state="ready" />)
    expect(main).not.toContain('wp-list-scroll')
    expect(main).not.toContain('wp-menu-preview__rail')

    deviceStore.set(resetStackActionAtom, [albumTracksFrame()])
    const album = renderToStaticMarkup(<Panel state="ready" />)
    expect(album).toMatch(/class="wp-list-viewport"[\s\S]*class="wp-list-scroll"/)
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

  test('native interactive targets are at least forty-four panel pixels before preview scaling', () => {
    const css = readFileSync(new URL('./panel.css', import.meta.url), 'utf8')
    const actionRule = css.match(/\.wp-actions button\s*\{([^}]*)\}/)?.[1]
    expect(actionRule).toBeDefined()
    expect(actionRule).toMatch(/min-inline-size:\s*44px/)
    expect(actionRule).toMatch(/min-block-size:\s*44px/)
  })

  test('uses provider commands, subscriptions, and one canonical list path', () => {
    const source = readFileSync(new URL('./Panel.tsx', import.meta.url), 'utf8')
    expect(source).toContain('selectNavigation(')
    expect(readFileSync(new URL('./navigation.ts', import.meta.url), 'utf8')).toContain('provider.play(')
    expect(source).toContain('provider.onPlaybackChange')
    expect(source).toContain('provider.onProgress')
    expect(source).toContain('<ListViewport')
    expect(source).not.toMatch(/StaticTrackList|VirtualTrackList|TrackRow|BrowserRow/)
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

  test('gives passive S13 playback glyphs accurate non-interactive semantics', async () => {
    const playbackProvider = createFixtureProvider()
    await playbackProvider.play({ kind: 'tracks', tracks: playbackProvider.catalog.tracks, startIndex: 0 })
    deviceStore.set(resetStackActionAtom, [nowPlayingFrame()])
    const html = renderToStaticMarkup(<Panel state="ready" provider={playbackProvider} />)

    expect(html).toContain('class="wp-actions" role="group" aria-label="Playback status"')
    for (const [label, icon] of [['Shuffle off', 'shuffle'], ['Repeat off', 'repeat'], ['Rate', 'star'], ['Queue', 'queue']] as const) {
      expect(html).toContain(`<span role="img" aria-label="${label}"><span aria-hidden="true"><svg class="wp-icon wp-icon--${icon}"`)
    }
    expect(html).not.toMatch(/<span aria-label="(?:Shuffle off|Repeat off|Rate|Queue)"/)
  })

  test('reports every provider shuffle and repeat state truthfully', async () => {
    for (const shuffle of ['off', 'songs', 'albums'] as const) {
      for (const repeat of ['off', 'one', 'all'] as const) {
        const playbackProvider = createFixtureProvider()
        await playbackProvider.play({ kind: 'tracks', tracks: playbackProvider.catalog.tracks, startIndex: 0 })
        await playbackProvider.setShuffle(shuffle)
        await playbackProvider.setRepeat(repeat)
        deviceStore.set(resetStackActionAtom, [nowPlayingFrame()])
        const html = renderToStaticMarkup(<Panel state="ready" provider={playbackProvider} />)
        expect(html).toContain(`aria-label="Shuffle ${shuffle}"`)
        expect(html).toContain(`aria-label="Repeat ${repeat}"`)
      }
    }
  })

  test('keeps S13 capability absence and the Love interaction unchanged', async () => {
    const playbackProvider = createFixtureProvider()
    await playbackProvider.play({ kind: 'tracks', tracks: playbackProvider.catalog.tracks, startIndex: 0 })
    deviceStore.set(resetStackActionAtom, [nowPlayingFrame()])
    const html = renderToStaticMarkup(<Panel state="ready" provider={playbackProvider} />)

    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html).toContain('<button type="button" aria-label="Love track" aria-pressed="false"')
    expect(html).not.toMatch(/Lyrics|Remove from playlist|Reorder playlist|Remove from queue|Reorder queue|Downloaded only/i)
  })

  test('does not invent a track, queue index, source, or artwork before provider playback arrives', () => {
    const idleProvider = createFixtureProvider()
    deviceStore.set(resetStackActionAtom, [nowPlayingFrame()])
    const html = renderToStaticMarkup(<Panel state="ready" provider={idleProvider} />)

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
    const html = renderToStaticMarkup(<Panel state="ready" provider={pendingProvider} />)

    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('Loading the song.')
    expect(html).not.toContain('Nothing is playing.')
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
    const html = renderToStaticMarkup(<Panel state="ready" provider={playbackProvider} />)

    expect(html).toContain(`${selectedIndex + 1} of ${fixtureNavigationSource.songs.length}`)
    expect(html).toContain('class="wp-source">Songs</span>')
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

    const html = renderToStaticMarkup(<Panel state="ready" provider={counterpartProvider} />)

    expect(html).toContain(`${selectedIndex + 1} of ${fixtureNavigationSource.songs.length}`)
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

    const html = renderToStaticMarkup(<Panel state="ready" provider={playbackProvider} navigationSource={duplicateSource} />)

    expect(html).toContain('3 of 3')
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
    const middleHtml = renderToStaticMarkup(<Panel state="ready" provider={playbackProvider} navigationSource={duplicateSource} />)
    expect(middleHtml).toContain('2 of 3')

    await playbackProvider.skip('next')
    const finalHtml = renderToStaticMarkup(<Panel state="ready" provider={playbackProvider} navigationSource={duplicateSource} />)
    expect(finalHtml).toContain('3 of 3')
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
    const middleHtml = renderToStaticMarkup(<Panel state="ready" provider={playbackProvider} navigationSource={duplicateSource} />)
    expect(middleHtml).toContain('2 of 3')

    await playbackProvider.skip('previous')
    const finalHtml = renderToStaticMarkup(<Panel state="ready" provider={playbackProvider} navigationSource={duplicateSource} />)
    expect(finalHtml).toContain('1 of 3')
  })
})
