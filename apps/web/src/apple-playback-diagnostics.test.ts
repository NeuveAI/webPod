import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import type { ApplePlaybackDiagnosticSource, MusicKitInstanceLike } from '@webpod/providers'
import { applePlaybackDiagnostics, classifyApplePlaybackError } from './apple-playback-diagnostics'

afterEach(() => { applePlaybackDiagnostics.disable(); mock.restore() })

const source = (error?: unknown, currentTime = 1): ApplePlaybackDiagnosticSource => ({ error, music: { playbackState: 2, currentPlaybackTime: currentTime, currentPlaybackDuration: 20, volume: 1 } as MusicKitInstanceLike, audio: null, userActivation: null })

describe('route-scoped Apple playback diagnostics', () => {
  test('classifies untrusted errors without retaining any supplied strings or identifiers', () => {
    const hostile = [
      '2037093401', 'i.4PvL9eK2', '/v1/me/library/songs/i.4PvL9eK2', '../private/item',
      'https://example.test/media?id=2037093401&token=secret', 'blob:null/91d73f3a',
      'blob:https://example.test/91d73f3a?token=secret', 'eyJheader.eyJpayload.signaturevalue',
      'Bearer abcdefghijklmnopqrstuvwxyz', 'catalog-2037093401', 'library-id-i.4PvL9eK2',
    ]
    for (const value of hostile) {
      const classified = classifyApplePlaybackError({ name: value, message: value, code: value })
      expect(['autoplay-denied', 'aborted', 'network', 'decode', 'unsupported-source', 'drm-or-entitlement', 'unknown']).toContain(classified)
      expect(JSON.stringify(classified)).not.toContain(value)
    }
    expect(classifyApplePlaybackError({ name: 'NotAllowedError', message: 'request /private/123 was not allowed' })).toBe('autoplay-denied')
    expect(classifyApplePlaybackError({ message: 'FairPlay key session rejected /private/123' })).toBe('drm-or-entitlement')
  })

  test('does not invoke the browser-state source while disabled and clears on teardown', () => {
    let reads = 0
    const browserState = () => { reads += 1; throw new Error('browser state must not be touched') }
    applePlaybackDiagnostics.capture('playCall', browserState)
    expect(reads).toBe(0)
    expect(applePlaybackDiagnostics.getSnapshot()).toEqual({ enabled: false, events: [] })

    spyOn(console, 'info').mockImplementation(() => undefined)
    applePlaybackDiagnostics.enable()
    applePlaybackDiagnostics.capture('playCall', () => { reads += 1; return source() })
    expect(reads).toBe(1)
    applePlaybackDiagnostics.disable()
    expect(applePlaybackDiagnostics.getSnapshot()).toEqual({ enabled: false, events: [] })
  })

  test('captures truthful event order, repeated time samples, and keeps only forty events', () => {
    spyOn(console, 'info').mockImplementation(() => undefined)
    applePlaybackDiagnostics.enable()
    const ordered = ['setQueue', 'queueItemsDidChange', 'playCall', 'mediaItemStateDidChange', 'bufferedProgressDidChange', 'mediaCanPlay', 'mediaItemDidChange', 'playbackStateDidChange', 'playResolve'] as const
    for (const event of ordered) applePlaybackDiagnostics.capture(event, () => source())
    expect(applePlaybackDiagnostics.getSnapshot().events.map((event) => event.event)).toEqual(ordered)
    for (let index = 0; index < 45; index += 1) {
      applePlaybackDiagnostics.capture('playbackTimeDidChange', () => source(undefined, index))
    }
    const events = applePlaybackDiagnostics.getSnapshot().events
    expect(events).toHaveLength(40)
    expect(events.every((event) => event.event === 'playbackTimeDidChange')).toBeTrue()
    expect(events.map((event) => event.musicKit.currentTime)).toEqual(Array.from({ length: 40 }, (_, index) => index + 5))
  })

  test('console and snapshot contain classifications only for media errors', () => {
    const info = spyOn(console, 'info').mockImplementation(() => undefined)
    applePlaybackDiagnostics.enable()
    const privateValue = 'blob:null/2037093401?token=private'
    applePlaybackDiagnostics.capture('mediaPlaybackError', () => source({ name: privateValue, message: privateValue, code: privateValue }))
    const serialized = JSON.stringify({ snapshot: applePlaybackDiagnostics.getSnapshot(), logged: info.mock.calls })
    expect(serialized).toContain('unknown')
    expect(serialized).not.toContain('2037093401')
    expect(serialized).not.toContain('blob:')
    expect(serialized).not.toContain('private')
  })
})
