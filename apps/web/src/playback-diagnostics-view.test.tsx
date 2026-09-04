import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import type { ApplePlaybackDiagnosticEvent } from './apple-playback-diagnostics'
import { musicRuntime } from './music-runtime'
import { PlaybackDiagnostics, PreviewControls } from './routes/[_]spike.device'

const event = (sequence: number, name: ApplePlaybackDiagnosticEvent['event'], overrides: Partial<ApplePlaybackDiagnosticEvent> = {}): ApplePlaybackDiagnosticEvent => ({
  sequence,
  event: name,
  timestampMs: sequence,
  musicKit: { playbackState: 2, playbackStateName: 'playing', currentTime: 1, duration: 20, volume: 1, authorized: true, previewOnly: false },
  queue: { present: true, length: 1, position: 0, hasNowPlayingItem: true },
  audio: { paused: false, muted: false, volume: 1, readyState: 4, networkState: 1, errorCode: null },
  userActivation: { isActive: false, hasBeenActive: true },
  ...overrides,
})

describe('playback diagnostic presentation', () => {
  test('announces one safe causal summary and keeps the event trace behind disclosure', () => {
    const html = renderToStaticMarkup(<PlaybackDiagnostics emeCapability="neither-supported" events={[
      event(1, 'audio:error', { audio: { paused: true, muted: false, volume: 1, readyState: 0, networkState: 3, errorCode: 4 } }),
      event(2, 'mediaPlaybackError', { errorClass: 'unsupported-source' }),
      event(3, 'playbackStateDidChange', { playbackEventState: { value: 3, name: 'paused' } }),
    ]} />)

    expect(html).toContain('role="status" aria-live="polite" aria-atomic="true"')
    expect(html.match(/aria-live=/g)).toHaveLength(1)
    expect(html).toContain('Protected Apple Music audio is unavailable in this browser')
    expect(html).toContain('Library data and artwork still work. Open webPod in a DRM-capable normal browser.')
    expect(html).toContain('<details>')
    expect(html).toContain('<summary>Technical timeline (3)</summary>')
    expect(html).toContain('data-causal="true"')
    expect(html).toContain('Causal failure')
    expect(html).toContain('data-latest="true"')
    expect(html).toContain('Latest follow-up')
    expect(html).toContain('Copy diagnostics')
  })

  test('offers a truthful Apple retry without exposing a production demo fallback', () => {
    const state = {
      colourway: 'black',
      room: 'dark',
      pose: 'front',
      orientation: { pitchDeg: 0, yawDeg: 0, rollDeg: 0 },
    } as const
    const music = {
      ...musicRuntime.getSnapshot(),
      requestedMode: 'apple',
      activeMode: 'apple',
      phase: 'error',
      message: 'Apple Music library loading failed',
    } as const

    const html = renderToStaticMarkup(<PreviewControls state={state} music={music} />)

    expect(html).toContain('Retry Apple Music')
    expect(html).not.toContain('Use demo library')
    expect(html).not.toContain('Sign in to Apple Music')
    expect(html).not.toContain('Sign out of Apple Music')
  })
})
