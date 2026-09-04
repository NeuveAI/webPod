import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import type { ApplePlaybackDiagnosticSource, MusicKitInstanceLike } from '@webpod/providers'
import { appleMediaItemStateName, applePlaybackStateName, classifyApplePlaybackError, createApplePlaybackDiagnostics, deriveApplePlaybackDiagnosis, serializeApplePlaybackDiagnostics, type ApplePlaybackDiagnosticEvent, type ApplePlaybackDiagnosticName } from './apple-playback-diagnostics'

let diagnostics = createApplePlaybackDiagnostics({ development: true, now: () => 1 })
beforeEach(() => { diagnostics = createApplePlaybackDiagnostics({ development: true, now: () => 1 }) })
afterEach(() => { diagnostics.disable(); mock.restore() })

const source = (error?: unknown, currentTime = 1): ApplePlaybackDiagnosticSource => ({ error, music: { playbackState: 2, currentPlaybackTime: currentTime, currentPlaybackDuration: 20, volume: 1 } as MusicKitInstanceLike, audio: null, userActivation: null })
const diagnosticEvent = (sequence: number, event: ApplePlaybackDiagnosticName, overrides: Partial<ApplePlaybackDiagnosticEvent> = {}): ApplePlaybackDiagnosticEvent => ({
  sequence,
  event,
  timestampMs: sequence,
  musicKit: { playbackState: 2, playbackStateName: 'playing', currentTime: 1, duration: 20, volume: 1, authorized: true, previewOnly: false },
  queue: { present: true, length: 1, position: 0, hasNowPlayingItem: true },
  audio: { paused: false, muted: false, volume: 1, readyState: 4, networkState: 1, errorCode: null },
  userActivation: { isActive: false, hasBeenActive: true },
  ...overrides,
})

describe('route-scoped Apple playback diagnostics', () => {
  test('keeps the live protected-media failure causal after a later paused state event', () => {
    const events = [
      diagnosticEvent(1, 'playCall'),
      diagnosticEvent(2, 'audio:error', { audio: { paused: true, muted: false, volume: 1, readyState: 0, networkState: 3, errorCode: 4 } }),
      diagnosticEvent(3, 'mediaPlaybackError', { errorClass: 'unsupported-source', audio: { paused: true, muted: false, volume: 1, readyState: 0, networkState: 3, errorCode: 4 } }),
      diagnosticEvent(4, 'playbackStateDidChange', { playbackEventState: { value: 3, name: 'paused' }, musicKit: { playbackState: 0, playbackStateName: 'none', currentTime: 0, duration: 0, volume: 1, authorized: true, previewOnly: false } }),
    ]

    const diagnosis = deriveApplePlaybackDiagnosis({ enabled: true, emeCapability: 'neither-supported', events })

    expect(diagnosis).toEqual({
      kind: 'protected-media-unsupported',
      headline: 'Protected Apple Music audio is unavailable in this browser',
      nextAction: 'Library data and artwork still work. Open webPod in a DRM-capable normal browser.',
      causalSequence: 3,
    })
    expect(events.at(-1)?.playbackEventState?.name).toBe('paused')
  })

  test('keeps autoplay, network, decode/source, DRM/entitlement, and unknown summaries distinct', () => {
    const diagnosis = (event: ApplePlaybackDiagnosticEvent, emeCapability: 'widevine-supported' | 'probe-error' = 'widevine-supported') => deriveApplePlaybackDiagnosis({ enabled: true, emeCapability, events: [event] })

    expect(diagnosis(diagnosticEvent(1, 'mediaPlaybackError', { errorClass: 'autoplay-denied' })).kind).toBe('autoplay')
    expect(diagnosis(diagnosticEvent(1, 'audio:error', { audio: { paused: true, muted: false, volume: 1, readyState: 0, networkState: 2, errorCode: 2 } })).kind).toBe('network')
    expect(diagnosis(diagnosticEvent(1, 'mediaPlaybackError', { errorClass: 'decode' })).kind).toBe('decode-or-source')
    expect(diagnosis(diagnosticEvent(1, 'mediaItemStateDidChange', { mediaItemState: { value: 6, name: 'restricted' } })).kind).toBe('drm-or-entitlement')
    expect(diagnosis(diagnosticEvent(1, 'mediaPlaybackError', { errorClass: 'unknown' }), 'probe-error').kind).toBe('unknown')
    expect(deriveApplePlaybackDiagnosis({ enabled: true, emeCapability: 'widevine-supported', events: [diagnosticEvent(1, 'playCall')] }).kind).toBe('none')
  })

  test('identifies a void queue result and a confirmation timeout as actionable causal failures', () => {
    const disabled = diagnosticEvent(2, 'setQueueResolve', { operation: { targetKind: 'tracks', targetItemCount: 1, startIndex: 0, queueResult: 'void' }, queue: { present: false, length: null, position: null, hasNowPlayingItem: false } })
    const timeout = diagnosticEvent(3, 'playbackConfirmationTimeout', { operation: { targetKind: 'tracks', targetItemCount: 1, startIndex: 0, queueResult: 'queue' }, queue: { present: true, length: 0, position: null, hasNowPlayingItem: false } })

    expect(deriveApplePlaybackDiagnosis({ enabled: true, emeCapability: 'widevine-supported', events: [disabled] })).toMatchObject({ kind: 'runtime-environment', causalSequence: 2 })
    expect(deriveApplePlaybackDiagnosis({ enabled: true, emeCapability: 'widevine-supported', events: [timeout] })).toMatchObject({ kind: 'queue-timeout', causalSequence: 3 })
  })

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
    const ordered = ['setQueue', 'setQueueResolve', 'queueItemsDidChange', 'playCall', 'mediaItemStateDidChange', 'bufferedProgressDidChange', 'mediaCanPlay', 'nowPlayingItemDidChange', 'playbackStateDidChange', 'playResolve'] as const
    for (const event of ordered) diagnostics.capture(event, () => source())
    expect(diagnostics.getSnapshot().events.map((event) => event.event)).toEqual([...ordered])
    for (let index = 0; index < 45; index += 1) {
      diagnostics.capture('playbackTimeDidChange', () => source(undefined, index))
    }
    const events = diagnostics.getSnapshot().events
    expect(events).toHaveLength(40)
    const retainedCausal = ordered.filter((event) => event !== 'bufferedProgressDidChange')
    expect(events.filter((event) => event.event !== 'playbackTimeDidChange' && event.event !== 'bufferedProgressDidChange').map((event) => event.event)).toEqual(retainedCausal)
    const samples = events.filter((event) => event.event === 'playbackTimeDidChange' || event.event === 'bufferedProgressDidChange')
    expect(samples).toHaveLength(40 - retainedCausal.length)
    expect(samples.at(-1)?.musicKit.currentTime).toBe(44)
  })

  test('retains a causal timeout while bounded progress samples continue', () => {
    spyOn(console, 'info').mockImplementation(() => undefined)
    diagnostics.enable()
    diagnostics.capture('playbackConfirmationTimeout', () => source())
    for (let index = 0; index < 80; index += 1) diagnostics.capture('playbackTimeDidChange', () => source(undefined, index))

    const snapshot = diagnostics.getSnapshot()
    expect(snapshot.events).toHaveLength(40)
    expect(snapshot.events.some((event) => event.event === 'playbackConfirmationTimeout')).toBeTrue()
    expect(deriveApplePlaybackDiagnosis(snapshot).kind).toBe('queue-timeout')
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

  test('exports a versioned, identifier-free report for browser agents and clipboard sharing', () => {
    spyOn(console, 'info').mockImplementation(() => undefined)
    diagnostics.enable()
    diagnostics.capture('setQueueResolve', () => ({ ...source(), operation: { targetKind: 'tracks', targetItemCount: 20, startIndex: 0, queueResult: 'queue' } }))
    const report = serializeApplePlaybackDiagnostics(diagnostics.getSnapshot())

    expect(report).toContain('"schemaVersion": 1')
    expect(report).toContain('"targetItemCount": 20')
    expect(report).toContain('"queueResult": "queue"')
    expect(report).not.toContain('catalogId')
    expect(report).not.toContain('libraryId')
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
    expect(request.mock.calls[0]?.[1]).toEqual([{ initDataTypes: ['cenc', 'keyids'], audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }], distinctiveIdentifier: 'optional', persistentState: 'optional', sessionTypes: ['temporary'] }])
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
    diagnostics.capture('nowPlayingItemDidChange', () => ({ ...source(), audio: null }))
    first.dispatchEvent(new Event('waiting'))
    expect(diagnostics.getSnapshot().events.map((event) => event.event)).toEqual(['playCall', 'nowPlayingItemDidChange'])

    diagnostics.capture('playCall', () => ({ ...source(), audio: first }))
    diagnostics.capture('nowPlayingItemDidChange', () => ({ ...source(), audio: second }))
    first.dispatchEvent(new Event('stalled'))
    second.dispatchEvent(new Event('canplay'))
    expect(diagnostics.getSnapshot().events.map((event) => event.event)).toEqual([
      'playCall', 'nowPlayingItemDidChange', 'playCall', 'nowPlayingItemDidChange', 'audio:canplay',
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
