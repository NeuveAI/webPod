import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { applePlaybackDiagnostics, sanitizeApplePlaybackError } from './playback-diagnostics.ts'

afterEach(() => { applePlaybackDiagnostics.disable(); mock.restore() })

describe('Apple playback diagnostics', () => {
  test('allows only bounded primitive error fields', () => {
    const secret = 'secret-token-and-url'
    expect(sanitizeApplePlaybackError({
      detail: { error: { name: 'NotAllowedError', message: 'Denied', code: 7, token: secret, url: 'blob:https://example.test/id', headers: { authorization: secret }, queueId: secret } },
    })).toEqual({ name: 'NotAllowedError', message: 'Denied', code: 7 })
    expect(sanitizeApplePlaybackError({ error: { name: 4, message: null, code: { private: true } } })).toBeUndefined()
    expect(sanitizeApplePlaybackError({ message: 'word '.repeat(80) })?.message).toHaveLength(240)
    expect(sanitizeApplePlaybackError({ message: 'failed at blob:https://example.test/private-id with Bearer private-value' })).toEqual({ message: 'failed at [redacted URL] with Bearer [redacted token]' })
  })

  test('is inert while disabled and captures only the bounded latest attempt', () => {
    const info = spyOn(console, 'info').mockImplementation(() => undefined)
    applePlaybackDiagnostics.capture({ event: 'playCall', playbackState: 3 })
    expect(applePlaybackDiagnostics.getSnapshot().events).toHaveLength(0)

    applePlaybackDiagnostics.enable()
    applePlaybackDiagnostics.capture({ event: 'playbackStateDidChange', playbackState: 2, currentTime: 0 })
    applePlaybackDiagnostics.capture({ event: 'setQueue', playbackState: 2, audio: { paused: true, muted: false, volume: 1, readyState: 1, networkState: 2, errorCode: null }, userActivation: { isActive: true, hasBeenActive: true }, timestampMs: 10 })
    applePlaybackDiagnostics.capture({ event: 'playCall', playbackState: 2, timestampMs: 11 })

    const captured = applePlaybackDiagnostics.getSnapshot().events
    expect(captured.map((event) => event.event)).toEqual(['setQueue', 'playCall'])
    expect(captured[0]).toMatchObject({ sequence: 1, timestampMs: 10, audio: { paused: true, muted: false, volume: 1 }, userActivation: { isActive: true, hasBeenActive: true } })
    expect(info).toHaveBeenCalledTimes(3)

    for (let index = 0; index < 50; index += 1) applePlaybackDiagnostics.capture({ event: 'playbackStateDidChange', playbackState: index })
    expect(applePlaybackDiagnostics.getSnapshot().events).toHaveLength(40)
    applePlaybackDiagnostics.disable()
    expect(applePlaybackDiagnostics.getSnapshot()).toEqual({ enabled: false, events: [] })
  })

  test('never serializes disallowed event payload properties', () => {
    spyOn(console, 'info').mockImplementation(() => undefined)
    applePlaybackDiagnostics.enable()
    applePlaybackDiagnostics.capture({ event: 'mediaPlaybackError', error: { name: 'MediaError', message: 'failed', code: 'MEDIA_ERR', src: 'blob:private', token: 'secret' } })
    const serialized = JSON.stringify(applePlaybackDiagnostics.getSnapshot())
    expect(serialized).toContain('MediaError')
    expect(serialized).not.toContain('blob:')
    expect(serialized).not.toContain('secret')
    expect(serialized).not.toContain('token')
    expect(serialized).not.toContain('src')
  })
})
