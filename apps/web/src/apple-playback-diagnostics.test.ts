import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import type { ApplePlaybackDiagnosticSource, MusicKitInstanceLike } from '@webpod/providers'
import { appleMediaItemStateName, applePlaybackStateName, classifyApplePlaybackError, createApplePlaybackDiagnostics } from './apple-playback-diagnostics'

let diagnostics = createApplePlaybackDiagnostics({ development: true, now: () => 1 })
beforeEach(() => { diagnostics = createApplePlaybackDiagnostics({ development: true, now: () => 1 }) })
afterEach(() => { diagnostics.disable(); mock.restore() })

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
    diagnostics.capture('playCall', browserState)
    expect(reads).toBe(0)
    expect(diagnostics.getSnapshot()).toEqual({ enabled: false, emeCapability: null, events: [] })

    spyOn(console, 'info').mockImplementation(() => undefined)
    diagnostics.enable()
    diagnostics.capture('playCall', () => { reads += 1; return source() })
    expect(reads).toBe(1)
    diagnostics.disable()
    expect(diagnostics.getSnapshot()).toEqual({ enabled: false, emeCapability: null, events: [] })
  })

  test('captures truthful event order, repeated time samples, and keeps only forty events', () => {
    spyOn(console, 'info').mockImplementation(() => undefined)
    diagnostics.enable()
    const ordered = ['setQueue', 'queueItemsDidChange', 'playCall', 'mediaItemStateDidChange', 'bufferedProgressDidChange', 'mediaCanPlay', 'mediaItemDidChange', 'playbackStateDidChange', 'playResolve'] as const
    for (const event of ordered) diagnostics.capture(event, () => source())
    expect(diagnostics.getSnapshot().events.map((event) => event.event)).toEqual([...ordered])
    for (let index = 0; index < 45; index += 1) {
      diagnostics.capture('playbackTimeDidChange', () => source(undefined, index))
    }
    const events = diagnostics.getSnapshot().events
    expect(events).toHaveLength(40)
    expect(events.every((event) => event.event === 'playbackTimeDidChange')).toBeTrue()
    expect(events.map((event) => event.musicKit.currentTime)).toEqual(Array.from({ length: 40 }, (_, index) => index + 5))
  })

  test('console and snapshot contain classifications only for media errors', () => {
    const info = spyOn(console, 'info').mockImplementation(() => undefined)
    diagnostics.enable()
    const privateValue = 'blob:null/2037093401?token=private'
    diagnostics.capture('mediaPlaybackError', () => source({ name: privateValue, message: privateValue, code: privateValue }))
    const serialized = JSON.stringify({ snapshot: diagnostics.getSnapshot(), logged: info.mock.calls })
    expect(serialized).toContain('unknown')
    expect(serialized).not.toContain('2037093401')
    expect(serialized).not.toContain('blob:')
    expect(serialized).not.toContain('private')
  })

  test('maps the exact served MusicKit media-item and playback enums', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(appleMediaItemStateName)).toEqual(['none', 'loading', 'ready', 'playing', 'ended', 'unavailable', 'restricted', 'error'])
    expect([0, 1, 2, 3, 4, 5, 6, 8, 9, 10].map(applePlaybackStateName)).toEqual(['none', 'loading', 'playing', 'paused', 'stopped', 'ended', 'seeking', 'waiting', 'stalled', 'completed'])
    expect(appleMediaItemStateName(99)).toBe('unknown')
    expect(applePlaybackStateName('2')).toBeNull()
  })

  test('captures only numeric state fields from hostile MusicKit payloads', () => {
    spyOn(console, 'info').mockImplementation(() => undefined)
    diagnostics.enable()
    const privateValue = 'blob:https://private.test/item?token=secret'
    const music = { playbackState: 8 } as MusicKitInstanceLike
    diagnostics.capture('mediaItemStateDidChange', () => ({ music, audio: null, userActivation: null, event: { state: 7, title: privateValue } }))
    diagnostics.capture('playbackStateDidChange', () => ({ music, audio: null, userActivation: null, event: { state: 9, message: privateValue } }))
    const serialized = JSON.stringify(diagnostics.getSnapshot())
    expect(serialized).not.toContain(privateValue)
    expect(diagnostics.getSnapshot().events[0]?.mediaItemState).toEqual({ value: 7, name: 'error' })
    expect(diagnostics.getSnapshot().events[1]?.playbackEventState).toEqual({ value: 9, name: 'stalled' })
    expect(diagnostics.getSnapshot().events[1]?.musicKit.playbackStateName).toBe('waiting')
  })

  test('probes the served SDK key systems once with its minimal configuration', async () => {
    const request = mock(async (keySystem: string, supportedConfigurations: readonly MediaKeySystemConfiguration[]) => { void supportedConfigurations; if (keySystem === 'com.widevine.alpha') throw new Error('unsupported'); return {} as MediaKeySystemAccess })
    diagnostics = createApplePlaybackDiagnostics({ development: true, navigatorRef: { requestMediaKeySystemAccess: request as Navigator['requestMediaKeySystemAccess'] } })
    diagnostics.enable(); diagnostics.enable()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls.map(([keySystem]) => keySystem)).toEqual(['com.widevine.alpha', 'com.microsoft.playready'])
    expect(request.mock.calls[0]?.[1]).toEqual([{ initDataTypes: ['cenc', 'keyids'], audioCapabilities: [{ contentType: 'audio/mp4' }], distinctiveIdentifier: 'optional', persistentState: 'required' }])
    expect(diagnostics.getSnapshot().emeCapability).toBe('playready-supported')
  })

  test('removes every audio listener and ignores late EME results on teardown', async () => {
    spyOn(console, 'info').mockImplementation(() => undefined)
    let resolveAccess: ((value: MediaKeySystemAccess) => void) | undefined
    const request = mock(() => new Promise<MediaKeySystemAccess>((resolve) => { resolveAccess = resolve }))
    diagnostics = createApplePlaybackDiagnostics({ development: true, navigatorRef: { requestMediaKeySystemAccess: request as Navigator['requestMediaKeySystemAccess'] } })
    const audio = new EventTarget() as HTMLAudioElement
    diagnostics.enable(); diagnostics.capture('playCall', () => ({ ...source(), audio })); diagnostics.disable()
    audio.dispatchEvent(new Event('waiting')); resolveAccess?.({} as MediaKeySystemAccess); await Promise.resolve()
    expect(diagnostics.getSnapshot()).toEqual({ enabled: false, emeCapability: null, events: [] })
  })

  test('records only the six approved audio event names', () => {
    spyOn(console, 'info').mockImplementation(() => undefined)
    const audio = new EventTarget() as HTMLAudioElement
    diagnostics.enable(); diagnostics.capture('playCall', () => ({ ...source(), audio }))
    for (const name of ['waiting', 'stalled', 'canplay', 'playing', 'error', 'emptied', 'loadedmetadata']) audio.dispatchEvent(new Event(name))
    expect(diagnostics.getSnapshot().events.slice(1).map((event) => event.event)).toEqual(['audio:waiting', 'audio:stalled', 'audio:canplay', 'audio:playing', 'audio:error', 'audio:emptied'])
  })

  test('detaches all audio listeners when the observed element disappears or is replaced', () => {
    spyOn(console, 'info').mockImplementation(() => undefined)
    const first = new EventTarget() as HTMLAudioElement
    const second = new EventTarget() as HTMLAudioElement
    diagnostics.enable()
    diagnostics.capture('playCall', () => ({ ...source(), audio: first }))
    diagnostics.capture('mediaItemDidChange', () => ({ ...source(), audio: null }))
    first.dispatchEvent(new Event('waiting'))
    expect(diagnostics.getSnapshot().events.map((event) => event.event)).toEqual(['playCall', 'mediaItemDidChange'])

    diagnostics.capture('playCall', () => ({ ...source(), audio: first }))
    diagnostics.capture('mediaItemDidChange', () => ({ ...source(), audio: second }))
    first.dispatchEvent(new Event('stalled'))
    second.dispatchEvent(new Event('canplay'))
    expect(diagnostics.getSnapshot().events.map((event) => event.event)).toEqual([
      'playCall', 'mediaItemDidChange', 'playCall', 'mediaItemDidChange', 'audio:canplay',
    ])
  })

  test('classifies unavailable, unsupported, and malformed EME probes without retaining errors', async () => {
    diagnostics = createApplePlaybackDiagnostics({ development: true })
    diagnostics.enable()
    expect(diagnostics.getSnapshot().emeCapability).toBe('requestMediaKeySystemAccess unavailable')

    const unsupported = mock(async (keySystem: string, configurations: readonly MediaKeySystemConfiguration[]) => { void keySystem; void configurations; throw new Error('private DRM detail') })
    diagnostics = createApplePlaybackDiagnostics({ development: true, navigatorRef: { requestMediaKeySystemAccess: unsupported as Navigator['requestMediaKeySystemAccess'] } })
    diagnostics.enable(); await new Promise((resolve) => setTimeout(resolve, 0))
    expect(diagnostics.getSnapshot().emeCapability).toBe('neither-supported')
    expect(JSON.stringify(diagnostics.getSnapshot())).not.toContain('private DRM detail')

    const malformed = mock((keySystem: string, configurations: readonly MediaKeySystemConfiguration[]) => { void keySystem; void configurations; return null as unknown as Promise<MediaKeySystemAccess> })
    diagnostics = createApplePlaybackDiagnostics({ development: true, navigatorRef: { requestMediaKeySystemAccess: malformed as Navigator['requestMediaKeySystemAccess'] } })
    diagnostics.enable(); await new Promise((resolve) => setTimeout(resolve, 0))
    expect(diagnostics.getSnapshot().emeCapability).toBe('probe-error')
  })

  test('is inert in production before reading sources, audio, or EME', () => {
    let reads = 0
    const request = mock(async () => { reads += 1; return {} as MediaKeySystemAccess })
    diagnostics = createApplePlaybackDiagnostics({ development: false, navigatorRef: { requestMediaKeySystemAccess: request as Navigator['requestMediaKeySystemAccess'] } })
    diagnostics.enable(); diagnostics.capture('playCall', () => { reads += 1; return source() })
    expect(reads).toBe(0)
    expect(request).not.toHaveBeenCalled()
    expect(diagnostics.getSnapshot()).toEqual({ enabled: false, emeCapability: null, events: [] })
  })
})
