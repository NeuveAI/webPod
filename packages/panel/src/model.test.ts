import { describe, expect, test } from 'bun:test'
import { createFixtureProvider } from '@webpod/providers'

import {
  artworkSampleFixture,
  deriveArtworkTreatment,
  excludeActorHue,
  formatDuration,
  nextNowPlayingMode,
  nowPlayingModes,
  previewNowPlayingScrub,
  settleNowPlayingQueue,
  settleNowPlayingScrub,
  sharpArtwork,
  transitionNowPlayingCenter,
} from './model'
import { albumTracksFrame, mainMenuFrame } from './fixtures'

describe('panel models', () => {
  test('formats invalid provider durations as zero instead of leaking NaN', () => {
    expect(formatDuration(Number.NaN)).toBe('0:00')
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0:00')
    expect(formatDuration(-1_000)).toBe('0:00')
  })

  test('S03 keeps synchronous rows and removes Radio from the tree when stations are absent', () => {
    const provider = createFixtureProvider({ supports: { stations: false } })
    const labels = mainMenuFrame(provider).rows.map((row) => row.label)
    expect(labels).toContain('Albums')
    expect(labels).not.toContain('Radio')
  })

  test('S08 derives real tracks from the fixture catalogue', () => {
    const provider = createFixtureProvider()
    const frame = albumTracksFrame(provider)
    expect(frame.screenId).toBe('S08')
    expect(frame.rows.length).toBeGreaterThan(0)
    expect(frame.rows[0]?.label).toBe(provider.catalog.tracks[0]?.title)
  })

  test('the reference-backed centre cycle exposes standard, scrub, artwork, and queue', () => {
    const provider = createFixtureProvider({ supports: { lyrics: false } })
    expect(nowPlayingModes(provider)).toEqual(['standard', 'scrub', 'artwork', 'queue'])
    expect(nextNowPlayingMode('standard', provider)).toBe('scrub')
    expect(nextNowPlayingMode('artwork', provider)).toBe('queue')
    expect(nextNowPlayingMode('queue', provider)).toBe('standard')

    const scrub = transitionNowPlayingCenter({ mode: 'standard', scrub: 'clean', scrubRevision: 0, queue: 'clean' }, provider)
    expect(scrub).toEqual({ state: { mode: 'scrub', scrub: 'clean', scrubRevision: 0, queue: 'clean' }, effect: 'none' })
    const preview = previewNowPlayingScrub(scrub.state)
    expect(preview).toMatchObject({ mode: 'scrub', scrub: 'previewing', scrubRevision: 1 })
    const commit = transitionNowPlayingCenter(preview, provider)
    expect(commit).toEqual({ state: { mode: 'scrub', scrub: 'committing', scrubRevision: 1, queue: 'clean' }, effect: 'commit-scrub' })
    expect(transitionNowPlayingCenter(commit.state, provider)).toEqual({ state: commit.state, effect: 'none' })
    const committed = settleNowPlayingScrub(commit.state, 1, true)
    expect(transitionNowPlayingCenter(committed, provider).state.mode).toBe('artwork')
    const queueSelection = transitionNowPlayingCenter({ mode: 'queue', scrub: 'clean', scrubRevision: 1, queue: 'clean' }, provider, true)
    expect(queueSelection.effect).toBe('select-queue')
    expect(queueSelection.state).toMatchObject({ mode: 'standard', queue: 'selecting' })
    expect(transitionNowPlayingCenter(queueSelection.state, provider, true).effect).toBe('none')
    expect(settleNowPlayingQueue(queueSelection.state)).toMatchObject({ mode: 'standard', queue: 'clean' })
    expect(transitionNowPlayingCenter({ mode: 'queue', scrub: 'clean', scrubRevision: 1, queue: 'clean' }, provider, false)).toMatchObject({ state: { mode: 'standard' }, effect: 'none' })
  })

  test('sharp artwork never renders above actualPx', () => {
    const provider = createFixtureProvider()
    const track = provider.catalog.tracks[0]
    if (track === undefined) throw new Error('fixture track missing')
    const art = sharpArtwork(track, 4_000)
    expect(art?.renderedPx).toBeLessThanOrEqual(art?.actualPx ?? 0)
  })

  test('builds a genuine 120-row fixture for the canonical windowing boundary', () => {
    expect(albumTracksFrame(createFixtureProvider(), 120).rows).toHaveLength(120)
  })

  test('adaptive artwork requires exact 3×3 and 8×8 samples', () => {
    const pale = artworkSampleFixture('pale')
    expect(pale.dominant).toHaveLength(9)
    expect(pale.luminance).toHaveLength(64)
    expect(() => deriveArtworkTreatment('dark', pale.dominant.slice(1), pale.luminance)).toThrow()
  })

  test('adaptive artwork rebalances pale and dark covers in both colourways', () => {
    const pale = artworkSampleFixture('pale')
    const dark = artworkSampleFixture('dark')
    const darkPale = deriveArtworkTreatment('dark', pale.dominant, pale.luminance)
    const lightDark = deriveArtworkTreatment('light', dark.dominant, dark.luminance)
    expect(darkPale.bloomOpacity).toBeLessThan(0.72)
    expect(lightDark.bloomOpacity).toBeLessThan(0.62)
    expect(lightDark.bloomLightness).toEqual([0.84, 0.96])
  })

  test('ambient bloom cannot occupy either actor hue window', () => {
    expect(excludeActorHue(232.7)).toBe(252.7)
    expect(excludeActorHue(151.7)).toBe(171.7)
    expect(excludeActorHue(20)).toBe(20)
  })
})
