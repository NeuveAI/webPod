import { describe, expect, test } from 'bun:test'
import { createFixtureProvider } from '@webpod/providers'

import {
  albumTracksFrame,
  mainMenuFrame,
  nextNowPlayingMode,
  nowPlayingModes,
  sharpArtwork,
} from './model'

describe('W3 panel models', () => {
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

  test('the Apple-shaped centre cycle has exactly three stops and defaults after lyrics to volume', () => {
    const provider = createFixtureProvider({ supports: { lyrics: false } })
    expect(nowPlayingModes(provider)).toEqual(['volume', 'scrub', 'rate'])
    expect(nextNowPlayingMode('volume', provider)).toBe('scrub')
    expect(nextNowPlayingMode('scrub', provider)).toBe('rate')
    expect(nextNowPlayingMode('rate', provider)).toBe('volume')
  })

  test('sharp artwork never renders above actualPx', () => {
    const provider = createFixtureProvider()
    const track = provider.catalog.tracks[0]
    if (track === undefined) throw new Error('fixture track missing')
    const art = sharpArtwork(track, 4_000)
    expect(art?.renderedPx).toBeLessThanOrEqual(art?.actualPx ?? 0)
  })
})
