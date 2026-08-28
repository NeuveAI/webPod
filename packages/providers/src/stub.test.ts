import { describe, expect, test } from 'bun:test'

import { createAppleProvider } from './apple/apple-provider.ts'
import { CAPABILITIES } from './capability.ts'
import { CapabilityUnsupportedError, NotImplementedError } from './errors.ts'
import { mintLocalKey } from './identity.ts'
import type { PlaylistRef, TrackRef } from './identity.ts'
import type { MusicProvider } from './provider.ts'
import { createSpotifyProvider } from './spotify/spotify-provider.ts'

const TRACK: TrackRef = {
  kind: 'track',
  key: mintLocalKey(),
  provider: 'apple',
  catalogId: '1440857781',
  title: 'Vienna',
  artistName: 'The Fray',
  durationMs: 224_000,
  playable: true,
}

const PLAYLIST: PlaylistRef = {
  kind: 'playlist',
  key: mintLocalKey(),
  provider: 'apple',
  catalogId: 'p.abc',
  name: 'Late shift',
  trackCount: 0,
  editable: true,
}

/** Every method, paired with the capability it is gated on. */
const CALLS: readonly (readonly [string, string, (p: MusicProvider) => unknown])[] = [
  ['configure', 'auth', (p) => p.configure()],
  ['authorize', 'auth', (p) => p.authorize()],
  ['unauthorize', 'auth', (p) => p.unauthorize()],
  ['search', 'search', (p) => p.search({ term: 'x', scope: 'catalog', kinds: ['track'] })],
  ['libraryList', 'libraryRead', (p) => p.libraryList('albums')],
  ['libraryAdd', 'libraryAdd', (p) => p.libraryAdd(TRACK)],
  ['libraryRemove', 'libraryRemove', (p) => p.libraryRemove(TRACK)],
  ['playlistCreate', 'playlistCreate', (p) => p.playlistCreate({ name: 'x' })],
  ['playlistAddTracks', 'playlistAddTracks', (p) => p.playlistAddTracks(PLAYLIST, [TRACK])],
  ['playlistRemoveTracks', 'playlistRemoveTracks', (p) => p.playlistRemoveTracks(PLAYLIST, [0])],
  ['playlistReorder', 'playlistReorder', (p) => p.playlistReorder(PLAYLIST, 0, 1)],
  ['play', 'transport', (p) => p.play()],
  ['pause', 'transport', (p) => p.pause()],
  ['skip', 'transport', (p) => p.skip('next')],
  ['seek', 'seek', (p) => p.seek(0)],
  ['setVolume', 'volume', (p) => p.setVolume(50)],
  ['queueRead', 'queueRead', (p) => p.queueRead()],
  ['queueAppend', 'queueAppend', (p) => p.queueAppend([TRACK])],
  ['queueInsertNext', 'queueInsertNext', (p) => p.queueInsertNext([TRACK])],
  ['queueRemove', 'queueRemove', (p) => p.queueRemove([0])],
  ['queueReorder', 'queueReorder', (p) => p.queueReorder(0, 1)],
  ['stationsList', 'stations', (p) => p.stationsList()],
  ['stationStart', 'stations', (p) => p.stationStart({ type: 'artist', ref: 'ar.1' })],
  ['lyrics', 'lyrics', (p) => p.lyrics(TRACK)],
  ['ratingSet', 'ratingLoveDislike', (p) => p.ratingSet(TRACK, { love: 'love' })],
  ['saveToggle', 'saveToggle', (p) => p.saveToggle(TRACK, true)],
]

for (const [providerName, make] of [
  ['apple', createAppleProvider],
  ['spotify', createSpotifyProvider],
] as const) {
  describe(`${providerName} adapter — a compiling stub with a real matrix`, () => {
    const provider = make()

    test('identifies itself', () => {
      expect(provider.id).toBe(providerName)
      expect(provider.displayName.length).toBeGreaterThan(0)
    })

    test('supports() is synchronous, total and never throws', () => {
      for (const capability of CAPABILITIES) {
        expect(typeof provider.supports(capability)).toBe('boolean')
      }
    })

    test('is never signed in and is never playing', () => {
      expect(provider.session).toBeNull()
      expect(provider.playback.status).toBe('idle')
      expect(provider.playback.now).toBeNull()
    })

    test('subscriptions register and unsubscribe without throwing', () => {
      for (const off of [
        provider.onSessionChange(() => {}),
        provider.onPlaybackChange(() => {}),
        provider.onProgress(() => {}),
      ]) {
        expect(() => {
          off()
        }).not.toThrow()
      }
    })

    for (const [method, capability, call] of CALLS) {
      test(`${method}() throws the right kind of error`, async () => {
        let thrown: unknown = null
        try {
          await call(provider)
        } catch (error) {
          thrown = error
        }

        if (provider.supports(capability as never)) {
          // Supported and unwritten: this is the stub half of the slice.
          expect(thrown).toBeInstanceOf(NotImplementedError)
          expect((thrown as NotImplementedError).providerId).toBe(providerName)
        } else {
          // Unsupported: the matrix half, which is finished. Keeping the two
          // errors apart is what stops "we have not built it" and "this
          // service cannot do it" from looking like the same defect.
          expect(thrown).toBeInstanceOf(CapabilityUnsupportedError)
          expect((thrown as CapabilityUnsupportedError).capability).toBe(capability)
        }
      })
    }

    test('a track-seeded station is refused separately from stations itself', async () => {
      let thrown: unknown = null
      try {
        await provider.stationStart({ type: 'track', ref: '651880159' })
      } catch (error) {
        thrown = error
      }
      if (provider.supports('stationSeedFromTrack')) {
        expect(thrown).toBeInstanceOf(NotImplementedError)
      } else {
        expect(thrown).toBeInstanceOf(CapabilityUnsupportedError)
        expect((thrown as CapabilityUnsupportedError).capability).toBe('stationSeedFromTrack')
      }
    })

    test('onProgress is subscribable even where progressTicks is false', () => {
      // §14.3 row 25: that capability reports whether the provider emits a
      // tick, not whether progress is knowable. It hides no control.
      expect(() => provider.onProgress(() => {})).not.toThrow()
    })
  })
}

describe('no adapter reaches the network', () => {
  test('constructing both providers touches neither fetch nor XHR', () => {
    const realFetch = globalThis.fetch
    let calls = 0
    // No cast: `Object.assign` keeps the real `preconnect`, so the stand-in
    // satisfies `typeof fetch` structurally. A cast here would be the one kind
    // of escape this repo's type posture asks us not to reach for.
    globalThis.fetch = Object.assign(
      (): never => {
        calls += 1
        throw new Error('a provider stub made a network call')
      },
      { preconnect: realFetch.preconnect },
    )
    try {
      const providers = [createAppleProvider(), createSpotifyProvider()]
      for (const provider of providers) {
        for (const capability of CAPABILITIES) {
          provider.supports(capability)
          provider.unsupportedReason(capability)
        }
        expect(provider.session).toBeNull()
        expect(provider.playback.status).toBe('idle')
      }
    } finally {
      globalThis.fetch = realFetch
    }
    expect(calls).toBe(0)
  })
})
