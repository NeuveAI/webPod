import { describe, expect, test } from 'bun:test'
import { createFixtureProvider } from '@webpod/providers'

import { fixtureNavigationSource, fixtureProvider } from './fixtures'
import { nowPlayingFrame } from './model'
import { derivePlaybackPresentation, playbackFrameKey, type PlaybackAttempt } from './playback-presentation'

const tracks = fixtureNavigationSource.songs.slice(0, 3)
const selected = tracks[1]
if (selected === undefined) throw new Error('playback presentation fixture missing')
const frame = { ...nowPlayingFrame(), playbackQueue: { tracks, startIndex: 1, sourceLabel: 'Songs' } }
const pending: PlaybackAttempt = { id: 1, provider: fixtureProvider, frameKey: playbackFrameKey(frame), status: 'pending' }

describe('playback presentation state machine', () => {
  test('a matching playing label stays starting until the playback clock advances', () => {
    const labelledPlaying = derivePlaybackPresentation(frame, pending, {
      ...fixtureProvider.playback,
      status: 'playing',
      now: selected,
      queueIndex: 1,
      positionMs: 0,
      durationMs: selected.durationMs,
    }, fixtureProvider)

    expect(labelledPlaying).toMatchObject({ phase: 'starting', track: selected, settleAttempt: false })

    const clockAdvanced = derivePlaybackPresentation(frame, pending, {
      ...fixtureProvider.playback,
      status: 'playing',
      now: selected,
      queueIndex: 1,
      positionMs: 1_250,
      durationMs: selected.durationMs,
    }, fixtureProvider)

    expect(clockAdvanced).toMatchObject({ phase: 'ready', track: selected, settleAttempt: true })
  })

  test('a matching queued item does not end starting while MusicKit still reports loading', () => {
    const presentation = derivePlaybackPresentation(frame, pending, {
      ...fixtureProvider.playback,
      status: 'loading',
      now: selected,
      queueIndex: null,
      durationMs: selected.durationMs,
    }, fixtureProvider)

    expect(presentation).toMatchObject({ phase: 'starting', track: selected, settleAttempt: false })
  })

  test('a duplicate at the wrong queue occurrence cannot confirm the request', () => {
    const duplicateTracks = [tracks[0] ?? selected, selected, tracks[0] ?? selected]
    const duplicateFrame = { ...nowPlayingFrame(), playbackQueue: { tracks: duplicateTracks, startIndex: 2, sourceLabel: 'Songs' } }
    const duplicateAttempt: PlaybackAttempt = { id: 2, provider: fixtureProvider, frameKey: playbackFrameKey(duplicateFrame), status: 'pending' }
    const presentation = derivePlaybackPresentation(duplicateFrame, duplicateAttempt, {
      ...fixtureProvider.playback,
      status: 'playing',
      now: duplicateTracks[0] ?? null,
      queueIndex: 0,
    }, fixtureProvider)

    expect(presentation.phase).toBe('starting')
  })

  test('a rejected current attempt cannot remain stuck in starting', () => {
    const presentation = derivePlaybackPresentation(frame, { ...pending, status: 'rejected' }, {
      ...fixtureProvider.playback,
      status: 'loading',
      now: null,
      queueIndex: null,
    }, fixtureProvider)

    expect(presentation.phase).toBe('failed')
  })

  test('an attempt from a replaced provider cannot poison the active provider', () => {
    const activeProvider = createFixtureProvider()
    const presentation = derivePlaybackPresentation(frame, { ...pending, status: 'rejected' }, {
      ...activeProvider.playback,
      status: 'loading',
      now: null,
      queueIndex: null,
    }, activeProvider)

    expect(presentation).toMatchObject({ phase: 'starting', attemptApplies: false })
  })
})
