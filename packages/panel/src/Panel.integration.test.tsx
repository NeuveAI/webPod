import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { createFixtureProvider, type MusicProvider, type PlaybackState, type QueueSnapshot } from '@webpod/providers'
import { detentActionAtom, deviceStore, pressActionAtom, resetStackActionAtom } from '@webpod/state'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { Panel, showNowPlayingScreen } from './Panel'
import { fixtureNavigationSource, mainMenuFrame } from './fixtures'
import { nowPlayingFrame } from './model'
import { navigationRoot, selectNavigation } from './navigation'

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

describe('mounted playback selection', () => {
  test('browsing retains live play/pause status and Songs hides only artist subtitles', async () => {
    const provider = createFixtureProvider()
    const source = fixtureNavigationSource
    const menu = navigationRoot(source, provider)
    const artists = (await selectNavigation({ ...menu, highlightIndex: 2 }, source, provider)).frame
    const albums = (await selectNavigation({ ...menu, highlightIndex: 3 }, source, provider)).frame
    const songs = (await selectNavigation({ ...menu, highlightIndex: 4 }, source, provider)).frame
    if (artists === null || albums === null || songs === null) throw new Error('library frames missing')
    await act(async () => root.render(<Panel provider={provider} navigationSource={source} accountStatus={null} />))
    const show = async (frame: typeof songs) => act(async () => {
      deviceStore.set(resetStackActionAtom, [frame])
      await Promise.resolve()
    })
    await show(songs)
    expect(container.querySelector('.wp-titlebar__transport')).toBeNull()
    expect(container.querySelector('.wp-list-row__secondary')).toBeNull()
    expect(container.querySelector('.wp-list-row__primary')?.textContent).toContain(songs.rows[0]?.label ?? '')
    await show(albums)
    expect(container.querySelector('.wp-list-row__secondary')?.textContent).toBe(albums.rows[0]?.sublabel ?? undefined)
    expect(container.querySelector('.wp-list-row__secondary')).not.toBeNull()
    await act(async () => { await provider.play({ kind: 'tracks', tracks: provider.catalog.tracks, startIndex: 0 }) })
    for (const frame of [artists, songs, albums, menu]) {
      await show(frame)
      expect(container.querySelector('.wp-titlebar__transport')?.getAttribute('aria-label')).toBe('Playback playing')
      expect(container.querySelector('.wp-titlebar strong')?.textContent).toBe(frame.title)
      expect(container.querySelector('.wp-titlebar')?.children.length).toBe(3)
    }
    await act(async () => { await provider.pause() })
    for (const frame of [artists, songs]) {
      await show(frame)
      expect(container.querySelector('.wp-titlebar__transport')?.getAttribute('aria-label')).toBe('Playback paused')
    }
    await act(async () => { await provider.play() })
    expect(container.querySelector('.wp-titlebar__transport')?.getAttribute('aria-label')).toBe('Playback playing')
    expect(container.querySelector('.wp-list-row__secondary')).toBeNull()
  })

  test('progressive library revisions do not restart a stationary track dwell', async () => {
    const fixture = createFixtureProvider()
    let prepares = 0
    const provider: MusicProvider = {
      ...fixture,
      async prepare(target, signal) {
        prepares += 1
        await fixture.prepare(target, signal)
      },
      get playback() { return fixture.playback },
    }
    let revision = 0
    const revisionListeners = new Set<() => void>()
    const source = {
      ...fixtureNavigationSource,
      subscribe(listener: () => void) { revisionListeners.add(listener); return () => { revisionListeners.delete(listener) } },
      getRevision: () => revision,
    }
    const songs = (await selectNavigation({ ...navigationRoot(source, provider), highlightIndex: 4 }, source, provider)).frame
    if (songs === null) throw new Error('songs frame missing')

    await act(async () => root.render(<Panel provider={provider} navigationSource={source} accountStatus={null} />))
    await act(async () => {
      deviceStore.set(resetStackActionAtom, [songs])
      await Promise.resolve()
    })
    for (let index = 0; index < 4; index += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150))
        revision += 1
        for (const listener of revisionListeners) listener()
        await Promise.resolve()
      })
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150))
      await Promise.resolve()
    })

    expect(prepares).toBe(1)
  })

  test('Center cycles substantive modes and the wheel controls volume, scrub, and queue', async () => {
    const provider = createFixtureProvider()
    await provider.play({ kind: 'tracks', tracks: provider.catalog.tracks, startIndex: 0 })
    await act(async () => {
      root.render(<Panel provider={provider} navigationSource={fixtureNavigationSource} accountStatus={null} />)
      await Promise.resolve()
    })
    await act(async () => {
      deviceStore.set(resetStackActionAtom, [nowPlayingFrame()])
      await Promise.resolve()
    })
    const center = async () => act(async () => {
      deviceStore.set(pressActionAtom, { button: 'center', source: 'human', path: 'key' })
      await Promise.resolve()
      await Promise.resolve()
    })
    const menu = async () => act(async () => {
      deviceStore.set(pressActionAtom, { button: 'menu', source: 'human', path: 'key' })
      await Promise.resolve()
    })
    for (let index = 0; index < 4 && container.querySelector('.wp-now')?.getAttribute('data-mode') !== 'standard'; index += 1) await center()
    expect(container.querySelector('.wp-now')?.getAttribute('data-mode')).toBe('standard')
    const startingVolume = provider.playback.volume0to100

    await act(async () => {
      deviceStore.set(detentActionAtom, { path: 'direct', source: 'human', detents: 1, timestampMs: 1 })
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(provider.playback.volume0to100).toBe(startingVolume + 2)
    expect(container.querySelector('.wp-volume-feedback')).not.toBeNull()
    expect(container.querySelector('.wp-progress')).toBeNull()
    expect(container.querySelector('.wp-times')).toBeNull()
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-label')).toBe('Volume')
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe(String(startingVolume + 2))

    await center()
    expect(container.querySelector('.wp-now')?.getAttribute('data-mode')).toBe('scrub')
    expect(container.querySelector('.wp-volume-feedback')).toBeNull()
    await menu()
    expect(container.querySelector('.wp-now')?.getAttribute('data-mode')).toBe('standard')
    await center()
    expect(container.querySelector('.wp-now')?.getAttribute('data-mode')).toBe('scrub')
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-label')).toBe('Track position, scrubbing')
    const positionBeforeScrub = provider.playback.positionMs
    await act(async () => {
      deviceStore.set(detentActionAtom, { path: 'direct', source: 'human', detents: 1, timestampMs: 2 })
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(provider.playback.positionMs).toBe(positionBeforeScrub)
    expect(container.querySelector('.wp-now')?.getAttribute('data-position-ms')).toBe(String(positionBeforeScrub + 5_000))
    expect(container.querySelector('.wp-now')?.getAttribute('data-scrub-state')).toBe('previewing')

    await center()
    expect(container.querySelector('.wp-now')?.getAttribute('data-mode')).toBe('scrub')
    expect(container.querySelector('.wp-now')?.getAttribute('data-scrub-state')).toBe('clean')
    expect(provider.playback.positionMs).toBe(positionBeforeScrub + 5_000)

    await center()
    expect(container.querySelector('.wp-now')?.getAttribute('data-mode')).toBe('artwork')
    expect(container.querySelector('.wp-now-full-artwork .wp-art')).not.toBeNull()

    await center()
    expect(container.querySelector('.wp-now')?.getAttribute('data-mode')).toBe('queue')
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(container.querySelector('.wp-now--queue')).not.toBeNull()
    expect(container.querySelectorAll('.wp-now--queue .wp-list-row')).toHaveLength(9)
    const application = container.querySelector('[role="application"]')
    const activeId = application?.getAttribute('aria-activedescendant')
    if (activeId == null) throw new Error('Queue active descendant is absent')
    expect(container.querySelector('[aria-current="true"]')?.id).toBe(activeId)
    const before = container.querySelector('.wp-now--queue [aria-current="true"]')?.textContent
    await act(async () => {
      deviceStore.set(detentActionAtom, { path: 'direct', source: 'human', detents: 1, timestampMs: 3 })
      await Promise.resolve()
    })
    const selected = container.querySelector('.wp-now--queue [aria-current="true"]')?.textContent
    expect(selected).not.toBe(before)
    await act(async () => {
      provider.tick(1_000)
      await Promise.resolve()
    })
    expect(container.querySelector('.wp-now--queue [aria-current="true"]')?.textContent).toBe(selected)
    const selectedTitle = container.querySelector('.wp-now--queue [aria-current="true"] .wp-list-row__primary')?.getAttribute('title')
    if (selectedTitle == null) throw new Error('selected queue title missing')
    await center()
    expect(provider.playback.queueIndex).toBe(0)
    expect(container.querySelector('.wp-now')?.getAttribute('data-mode')).toBe('standard')
    expect(container.querySelector('.wp-now-meta h1 .wp-marquee')?.getAttribute('title')).toBe(provider.playback.now?.title)
    expect(provider.playback.now?.title).toBe(selectedTitle)
    expect((await provider.queueRead()).history).toHaveLength(0)
  })

  test('a rejected provider volume write rolls the visible feedback value back without dismissing it', async () => {
    const fixture = createFixtureProvider()
    await fixture.play({ kind: 'tracks', tracks: fixture.catalog.tracks, startIndex: 0 })
    const initialVolume = fixture.playback.volume0to100
    const provider: MusicProvider = {
      ...fixture,
      get playback() { return fixture.playback },
      async setVolume() { throw new Error('volume write rejected') },
    }
    await act(async () => {
      root.render(<Panel provider={provider} navigationSource={fixtureNavigationSource} accountStatus={null} />)
      await Promise.resolve()
    })
    await act(async () => {
      deviceStore.set(resetStackActionAtom, [nowPlayingFrame()])
      await Promise.resolve()
      await Promise.resolve()
    })
    await act(async () => {
      deviceStore.set(detentActionAtom, { path: 'direct', source: 'human', detents: 1, timestampMs: 1 })
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('.wp-volume-feedback')).not.toBeNull()
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-label')).toBe('Volume')
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe(String(initialVolume))
    expect(container.querySelector('.wp-now')?.getAttribute('data-volume')).toBe(String(initialVolume))
  })

  test('a ready-to-ready track identity change dismisses visible volume feedback', async () => {
    const fixture = createFixtureProvider()
    const [first, second] = fixture.catalog.tracks
    if (first === undefined || second === undefined) throw new Error('fixture tracks missing')
    await fixture.play({ kind: 'tracks', tracks: [first, second, second], startIndex: 0 })
    let currentPlayback: PlaybackState = { ...fixture.playback, status: 'playing', now: first, queueIndex: 0 }
    const listeners = new Set<(playback: PlaybackState) => void>()
    const provider: MusicProvider = {
      ...fixture,
      get playback() { return currentPlayback },
      onPlaybackChange(listener) {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
      async setVolume(value) {
        currentPlayback = { ...currentPlayback, volume0to100: value }
        for (const listener of listeners) listener(currentPlayback)
      },
    }
    await act(async () => {
      root.render(<Panel provider={provider} navigationSource={fixtureNavigationSource} accountStatus={null} />)
      await Promise.resolve()
    })
    await act(async () => {
      deviceStore.set(resetStackActionAtom, [nowPlayingFrame()])
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(container.querySelector('.wp-now')?.getAttribute('data-mode')).toBe('standard')
    expect(container.querySelector('.wp-now')?.getAttribute('data-wheel-control')).toBe('volume')
    await act(async () => {
      deviceStore.set(detentActionAtom, { path: 'direct', source: 'human', detents: 1, timestampMs: 1 })
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(container.querySelector('.wp-volume-feedback')).not.toBeNull()

    await act(async () => {
      currentPlayback = { ...currentPlayback, now: second, queueIndex: 1, positionMs: 0 }
      for (const listener of listeners) listener(currentPlayback)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(container.querySelector('.wp-volume-feedback')).toBeNull()
    expect(container.querySelector('.wp-now-meta h1 .wp-marquee')?.getAttribute('title')).toBe(second.title)

    await act(async () => {
      deviceStore.set(detentActionAtom, { path: 'direct', source: 'human', detents: 1, timestampMs: 2 })
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(container.querySelector('.wp-volume-feedback')).not.toBeNull()
    await act(async () => {
      currentPlayback = { ...currentPlayback, now: second, queueIndex: 2, positionMs: 0 }
      for (const listener of listeners) listener(currentPlayback)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(container.querySelector('.wp-volume-feedback')).toBeNull()
  })

  test('reconstructed Now Playing restores authoritative track and queue position', async () => {
    const provider = createFixtureProvider()
    const tracks = provider.catalog.tracks.slice(0, 3)
    await provider.play({ kind: 'tracks', tracks, startIndex: 1 })
    await act(async () => {
      root.render(<Panel provider={provider} navigationSource={fixtureNavigationSource} accountStatus={null} />)
      await Promise.resolve()
    })
    await act(async () => {
      deviceStore.set(resetStackActionAtom, [mainMenuFrame()])
      showNowPlayingScreen()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(container.querySelector('.wp-now-count')?.textContent).toBe('2 of 3')
    expect(container.querySelector('[role="application"]')?.hasAttribute('aria-activedescendant')).toBe(false)
    expect(container.querySelector('.wp-now-meta h1')?.textContent).toContain(tracks[1]?.title ?? '')

    await act(async () => {
      deviceStore.set(resetStackActionAtom, [mainMenuFrame()])
      await provider.skip('next')
      showNowPlayingScreen()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(container.querySelector('.wp-now-count')?.textContent).toBe('3 of 3')
    expect(container.querySelector('.wp-now-meta h1')?.textContent).toContain(tracks[2]?.title ?? '')
  })

  test('a late queue read cannot replace a newer authoritative queue', async () => {
    const fixture = createFixtureProvider()
    const base = fixture.catalog.tracks[0]
    if (base === undefined) throw new Error('queue fixture missing')
    await fixture.play({ kind: 'tracks', tracks: [base], startIndex: 0 })
    let resolveStale: ((snapshot: QueueSnapshot) => void) | undefined
    const staleRead = new Promise<QueueSnapshot>((resolve) => { resolveStale = resolve })
    const activeTrack = { ...base, title: 'Active provider queue' }
    let currentPlayback = fixture.playback
    let refreshed = false
    const listeners = new Set<(playback: PlaybackState) => void>()
    const provider: MusicProvider = {
      ...fixture,
      get playback() { return currentPlayback },
      onPlaybackChange(callback) { listeners.add(callback); return () => { listeners.delete(callback) } },
      queueRead() {
        return refreshed ? Promise.resolve({ history: [], now: activeTrack, next: [] }) : staleRead
      },
    }
    const frame = nowPlayingFrame()

    await act(async () => {
      root.render(<Panel provider={provider} navigationSource={fixtureNavigationSource} accountStatus={null} />)
      await Promise.resolve()
    })
    await act(async () => {
      deviceStore.set(resetStackActionAtom, [frame])
      await Promise.resolve()
    })
    for (let index = 0; index < 3; index += 1) {
      await act(async () => {
        deviceStore.set(pressActionAtom, { button: 'center', source: 'human', path: 'key' })
        await Promise.resolve()
        await Promise.resolve()
      })
    }
    expect(container.querySelector('.wp-now')?.getAttribute('data-mode')).toBe('queue')
    expect(container.querySelector('.wp-now--queue')?.getAttribute('aria-busy')).toBe('true')

    await act(async () => {
      refreshed = true
      currentPlayback = { ...currentPlayback, queueIndex: (currentPlayback.queueIndex ?? 0) + 1 }
      for (const listener of listeners) listener(currentPlayback)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(container.querySelector('.wp-list-row__primary')?.textContent).toContain(activeTrack.title)

    await act(async () => {
      resolveStale?.({ history: [], now: { ...base, title: 'Stale provider queue' }, next: [] })
      await staleRead
      await Promise.resolve()
    })
    expect(container.querySelector('.wp-list-row__primary')?.textContent).toContain(activeTrack.title)
    expect(container.textContent).not.toContain('Stale provider queue')
  })

  test('a stale copy of the same catalog song cannot confirm a different pending occurrence', async () => {
    const fixture = createFixtureProvider()
    const first = fixtureNavigationSource.songs[0]
    const middle = fixtureNavigationSource.songs[1]
    if (first === undefined || middle === undefined) throw new Error('duplicate queue fixtures missing')
    const source = { ...fixtureNavigationSource, songs: [first, middle, first] }
    let currentPlayback: PlaybackState = { ...fixture.playback, status: 'playing', now: first, queueIndex: 0 }
    const listeners = new Set<(playback: PlaybackState) => void>()
    let resolvePlay: (() => void) | undefined
    const pendingPlay = new Promise<void>((resolve) => { resolvePlay = resolve })
    const pendingProvider: MusicProvider = {
      ...fixture,
      play() { return pendingPlay },
      get playback() { return currentPlayback },
      onPlaybackChange(callback) { listeners.add(callback); return () => { listeners.delete(callback) } },
    }
    const rootFrame = navigationRoot(source, pendingProvider)
    const songs = (await selectNavigation({ ...rootFrame, highlightIndex: 4 }, source, pendingProvider)).frame
    if (songs === null) throw new Error('songs frame missing')

    await act(async () => {
      root.render(<Panel provider={pendingProvider} navigationSource={source} accountStatus={null} />)
    })
    await act(async () => {
      deviceStore.set(resetStackActionAtom, [{ ...songs, highlightIndex: 2 }])
      deviceStore.set(pressActionAtom, { button: 'center', source: 'human', path: 'key' })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('.wp-now-meta h1 .wp-marquee__rest')?.textContent).toBe(first.title)
    expect(container.querySelector('.wp-now-count')).toBeNull()
    expect(container.querySelector('.wp-now')?.getAttribute('aria-busy')).toBe('true')
    expect(container.querySelector('.wp-progress--indeterminate')).not.toBeNull()
    expect(container.textContent).not.toContain('Preparing playback')

    await act(async () => {
      resolvePlay?.()
      await pendingPlay
      for (const listener of listeners) listener(currentPlayback)
      await Promise.resolve()
    })
    expect(container.querySelector('.wp-now-count')).toBeNull()
    expect(container.querySelector('.wp-now')?.getAttribute('aria-busy')).toBe('true')

    await act(async () => {
      currentPlayback = { ...currentPlayback, queueIndex: 2, positionMs: 1_000 }
      for (const listener of listeners) listener(currentPlayback)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(container.querySelector('.wp-now-count')).toBeNull()
    expect(container.querySelector('.wp-now')?.getAttribute('aria-busy')).toBe('false')
    expect(container.querySelector('.wp-status-shelf')).toBeNull()
  })

  test('play resolution and a matching MusicKit item stay pending until its playback clock advances', async () => {
    const fixture = createFixtureProvider()
    const selected = fixtureNavigationSource.songs[1]
    if (selected === undefined) throw new Error('selected track missing')
    let currentPlayback: PlaybackState = { ...fixture.playback, status: 'stopped', now: null, queueIndex: null, positionMs: 0 }
    const listeners = new Set<(playback: PlaybackState) => void>()
    const provider: MusicProvider = {
      ...fixture,
      async play() {},
      get playback() { return currentPlayback },
      onPlaybackChange(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
    }
    const rootFrame = navigationRoot(fixtureNavigationSource, provider)
    const songs = (await selectNavigation({ ...rootFrame, highlightIndex: 4 }, fixtureNavigationSource, provider)).frame
    if (songs === null) throw new Error('songs frame missing')

    await act(async () => root.render(<Panel provider={provider} navigationSource={fixtureNavigationSource} accountStatus={null} />))
    await act(async () => {
      deviceStore.set(resetStackActionAtom, [{ ...songs, highlightIndex: 1 }])
      deviceStore.set(pressActionAtom, { button: 'center', source: 'human', path: 'key' })
      for (let index = 0; index < 4; index += 1) await Promise.resolve()
    })

    expect(container.querySelector('.wp-now')?.getAttribute('aria-busy')).toBe('true')
    expect(container.querySelector('.wp-progress--indeterminate')).not.toBeNull()
    expect(container.textContent).not.toContain('Preparing playback')

    await act(async () => {
      currentPlayback = { ...currentPlayback, status: 'loading', now: selected, queueIndex: null }
      for (const listener of listeners) listener(currentPlayback)
      await Promise.resolve()
    })
    expect(container.querySelector('.wp-now')?.getAttribute('aria-busy')).toBe('true')
    expect(container.querySelector('.wp-progress--indeterminate')).not.toBeNull()
    expect(container.querySelector('.wp-now')?.getAttribute('data-playback-phase')).toBe('starting')
    expect(container.querySelector('.wp-titlebar__transport')?.getAttribute('data-transport')).toBe('starting')

    await act(async () => {
      currentPlayback = { ...currentPlayback, status: 'playing', queueIndex: 1, positionMs: 0 }
      for (const listener of listeners) listener(currentPlayback)
      await Promise.resolve()
    })
    expect(container.querySelector('.wp-now')?.getAttribute('aria-busy')).toBe('true')
    expect(container.querySelector('.wp-progress--indeterminate')).not.toBeNull()

    await act(async () => {
      currentPlayback = { ...currentPlayback, positionMs: 250 }
      for (const listener of listeners) listener(currentPlayback)
      await Promise.resolve()
    })
    expect(container.querySelector('.wp-now')?.getAttribute('aria-busy')).toBe('false')
    expect(container.querySelector('.wp-progress--indeterminate')).toBeNull()
    expect(container.querySelector('.wp-now')?.getAttribute('data-playback-phase')).toBe('ready')
    expect(container.querySelector('.wp-titlebar__transport')?.getAttribute('data-transport')).toBe('playing')
  })

  test('audible provider truth clears starting while the play command is unresolved', async () => {
    const fixture = createFixtureProvider()
    const selected = fixtureNavigationSource.songs[1]
    if (selected === undefined) throw new Error('selected track missing')
    let currentPlayback: PlaybackState = { ...fixture.playback, status: 'stopped', now: null, queueIndex: null, positionMs: 0 }
    const listeners = new Set<(playback: PlaybackState) => void>()
    const neverResolvingPlay = new Promise<void>(() => undefined)
    const provider: MusicProvider = {
      ...fixture,
      play() { return neverResolvingPlay },
      get playback() { return currentPlayback },
      onPlaybackChange(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
    }
    const songs = (await selectNavigation({ ...navigationRoot(fixtureNavigationSource, provider), highlightIndex: 4 }, fixtureNavigationSource, provider)).frame
    if (songs === null) throw new Error('songs frame missing')

    await act(async () => root.render(<Panel provider={provider} navigationSource={fixtureNavigationSource} accountStatus={null} />))
    await act(async () => {
      deviceStore.set(resetStackActionAtom, [{ ...songs, highlightIndex: 1 }])
      deviceStore.set(pressActionAtom, { button: 'center', source: 'human', path: 'key' })
      await Promise.resolve()
    })
    expect(container.querySelector('.wp-now')?.getAttribute('data-playback-phase')).toBe('starting')
    expect(container.querySelector('.wp-titlebar__transport')?.getAttribute('data-transport')).toBe('starting')

    await act(async () => {
      currentPlayback = {
        ...currentPlayback,
        status: 'playing',
        now: selected,
        queueIndex: 1,
        positionMs: 1_000,
        durationMs: selected.durationMs,
      }
      for (const listener of listeners) listener(currentPlayback)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('.wp-now')?.getAttribute('aria-busy')).toBe('false')
    expect(container.querySelector('.wp-now')?.getAttribute('data-playback-phase')).toBe('ready')
    expect(container.querySelector('.wp-progress--indeterminate')).toBeNull()
    expect(container.querySelector('.wp-titlebar__transport')?.getAttribute('data-transport')).toBe('playing')
  })

  test('a rapid second song selection keeps metadata aligned with the winning transport', async () => {
    const fixture = createFixtureProvider()
    const first = fixtureNavigationSource.songs[1]
    const second = fixtureNavigationSource.songs[2]
    if (first === undefined || second === undefined) throw new Error('rapid selection tracks missing')
    let currentPlayback: PlaybackState = { ...fixture.playback, status: 'stopped', now: null, queueIndex: null }
    const listeners = new Set<(playback: PlaybackState) => void>()
    let rejectFirst: ((cause: Error) => void) | undefined
    let selections = 0
    const provider: MusicProvider = {
      ...fixture,
      play(target) {
        selections += 1
        if (selections === 1) return new Promise<void>((_resolve, reject) => { rejectFirst = reject })
        if (target?.kind !== 'tracks') throw new Error('track queue expected')
        currentPlayback = { ...currentPlayback, status: 'playing', now: target.tracks[target.startIndex ?? 0] ?? null, queueIndex: target.startIndex ?? 0, positionMs: 250 }
        for (const listener of listeners) listener(currentPlayback)
        return Promise.resolve()
      },
      get playback() { return currentPlayback },
      onPlaybackChange(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
    }
    const songs = (await selectNavigation({ ...navigationRoot(fixtureNavigationSource, provider), highlightIndex: 4 }, fixtureNavigationSource, provider)).frame
    if (songs === null) throw new Error('songs frame missing')

    await act(async () => root.render(<Panel provider={provider} navigationSource={fixtureNavigationSource} accountStatus={null} />))
    await act(async () => {
      deviceStore.set(resetStackActionAtom, [{ ...songs, highlightIndex: 1 }])
      deviceStore.set(pressActionAtom, { button: 'center', source: 'human', path: 'key' })
      await Promise.resolve()
    })
    expect(container.querySelector('.wp-now-meta h1')?.textContent).toContain(first.title)
    expect(container.querySelector('.wp-progress--indeterminate')).not.toBeNull()

    await act(async () => {
      deviceStore.set(resetStackActionAtom, [{ ...songs, highlightIndex: 2 }])
      deviceStore.set(pressActionAtom, { button: 'center', source: 'human', path: 'key' })
      for (let index = 0; index < 3; index += 1) await Promise.resolve()
    })
    expect(container.querySelector('.wp-now-meta h1')?.textContent).toContain(second.title)
    expect(container.querySelector('.wp-progress--indeterminate')).toBeNull()

    await act(async () => {
      rejectFirst?.(new Error('superseded'))
      await Promise.resolve()
    })
    expect(container.querySelector('.wp-now-meta h1')?.textContent).toContain(second.title)
    expect(container.querySelector('.wp-now-alert')).toBeNull()
  })

  test('station playback adopts the provider track and clears loading after its clock advances', async () => {
    const provider = createFixtureProvider()
    const stations = (await selectNavigation({ ...navigationRoot(fixtureNavigationSource, provider), highlightIndex: 6 }, fixtureNavigationSource, provider)).frame
    if (stations === null) throw new Error('stations frame missing')

    await act(async () => root.render(<Panel provider={provider} navigationSource={fixtureNavigationSource} accountStatus={null} />))
    await act(async () => {
      deviceStore.set(resetStackActionAtom, [stations])
      deviceStore.set(pressActionAtom, { button: 'center', source: 'human', path: 'key' })
      for (let index = 0; index < 4; index += 1) await Promise.resolve()
    })

    expect(provider.playback.status).toBe('playing')
    expect(container.querySelector('.wp-now-meta h1')?.textContent).toContain(provider.playback.now?.title ?? '')
    expect(container.querySelector('.wp-now')?.getAttribute('aria-busy')).toBe('true')
    expect(container.querySelector('.wp-progress--indeterminate')).not.toBeNull()

    await act(async () => {
      provider.tick(250)
      await Promise.resolve()
    })

    expect(container.querySelector('.wp-now')?.getAttribute('aria-busy')).toBe('false')
    expect(container.querySelector('.wp-progress--indeterminate')).toBeNull()
  })

  test('a late relationship response cannot replace the screen after navigation leaves its shell', async () => {
    const provider = createFixtureProvider()
    let resolveTracks: ((tracks: readonly (typeof fixtureNavigationSource.songs)[number][]) => void) | undefined
    const relationship = new Promise<readonly (typeof fixtureNavigationSource.songs)[number][]>((resolve) => { resolveTracks = resolve })
    const source = { ...fixtureNavigationSource, tracksForAlbum: () => relationship }
    const rootFrame = navigationRoot(source, provider)
    const albums = (await selectNavigation({ ...rootFrame, highlightIndex: 3 }, source, provider)).frame
    if (albums === null) throw new Error('albums frame missing')
    await act(async () => root.render(<Panel provider={provider} navigationSource={source} accountStatus={null} />))
    await act(async () => {
      deviceStore.set(resetStackActionAtom, [rootFrame, albums])
      deviceStore.set(pressActionAtom, { button: 'center', source: 'human', path: 'key' })
      await Promise.resolve()
    })
    expect(container.querySelector('.wp-list-loading')).not.toBeNull()

    await act(async () => {
      deviceStore.set(resetStackActionAtom, [rootFrame])
      resolveTracks?.(fixtureNavigationSource.songs.slice(0, 2))
      await relationship
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[aria-label="Music categories"]')).not.toBeNull()
    expect(container.querySelector('.wp-list-loading')).toBeNull()
  })

  test('a rejected play request keeps the selected occurrence on Now Playing', async () => {
    const fixture = createFixtureProvider()
    const rejectedProvider: MusicProvider = {
      ...fixture,
      async play() { throw new Error('playback refused') },
      get playback() { return fixture.playback },
    }
    const rootFrame = navigationRoot(fixtureNavigationSource, rejectedProvider)
    const songs = (await selectNavigation({ ...rootFrame, highlightIndex: 4 }, fixtureNavigationSource, rejectedProvider)).frame
    if (songs === null) throw new Error('songs frame missing')
    const selectedIndex = 2
    const selected = fixtureNavigationSource.songs[selectedIndex]
    if (selected === undefined) throw new Error('selected track missing')

    await act(async () => {
      root.render(<Panel provider={rejectedProvider} navigationSource={fixtureNavigationSource} accountStatus={null} />)
    })
    await act(async () => {
      deviceStore.set(resetStackActionAtom, [{ ...songs, highlightIndex: selectedIndex }])
      deviceStore.set(pressActionAtom, { button: 'center', source: 'human', path: 'key' })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('.wp-now-meta h1 .wp-marquee__rest')?.textContent).toBe(selected.title)
    expect(container.querySelector('.wp-now-meta p')?.textContent).toBe(selected.artistName)
    expect(container.querySelector('.wp-now-alert')?.textContent).toContain('Playback unavailable')
    expect(container.querySelector('.wp-now-alert')?.getAttribute('role')).toBe('status')
    expect(container.querySelector('.wp-actions')).toBeNull()
    expect(container.querySelector('.wp-message')).toBeNull()
  })
})
