import { describe, expect, test } from 'bun:test'

import { CapabilityUnsupportedError, NotAuthorizedError, PlaybackNotPermittedError } from '../errors.ts'
import { createFixtureProvider } from './fixture-provider.ts'
import type { FixtureProvider } from './fixture-provider.ts'

/**
 * Every member that needs the user's account, with a call it will accept.
 *
 * §15.3 failure 8: *"Silently dropped states… You must be able to reach each
 * one."* Before this file, `createFixtureProvider({ authorized: false })`
 * served all 42 songs and a full search, and `{ canPlay: false }` played — so
 * the two states §11.5 and §14.3 row 3 write copy for could not be produced in
 * the only provider W3 can drive.
 */
const NEEDS_A_SESSION: readonly (readonly [string, (p: FixtureProvider) => Promise<unknown>])[] = [
  ['search', (p) => p.search({ term: 'vienna', scope: 'library', kinds: ['track'] })],
  ['libraryList', (p) => p.libraryList('songs')],
  ['libraryAdd', (p) => p.libraryAdd(firstTrack(p))],
  ['libraryRemove', (p) => p.libraryRemove(firstTrack(p))],
  ['playlistCreate', (p) => p.playlistCreate({ name: 'Scratch' })],
  ['playlistAddTracks', (p) => p.playlistAddTracks(firstPlaylist(p), [firstTrack(p)])],
  ['playlistRemoveTracks', (p) => p.playlistRemoveTracks(firstPlaylist(p), [0])],
  ['playlistReorder', (p) => p.playlistReorder(firstPlaylist(p), 0, 1)],
  ['play', (p) => p.play()],
  ['pause', (p) => p.pause()],
  ['skip', (p) => p.skip('next')],
  ['seek', (p) => p.seek(1000)],
  ['setVolume', (p) => p.setVolume(50)],
  ['setShuffle', (p) => p.setShuffle('songs')],
  ['setRepeat', (p) => p.setRepeat('all')],
  ['queueRead', (p) => p.queueRead()],
  ['queueAppend', (p) => p.queueAppend([firstTrack(p)])],
  ['queueInsertNext', (p) => p.queueInsertNext([firstTrack(p)])],
  ['queueRemove', (p) => p.queueRemove([0])],
  ['queueReorder', (p) => p.queueReorder(0, 1)],
  ['stationsList', (p) => p.stationsList()],
  ['stationStart', (p) => p.stationStart({ type: 'artist', ref: 'ar.1' })],
  ['lyrics', (p) => p.lyrics(firstTrack(p))],
  ['ratingSet', (p) => p.ratingSet(firstTrack(p), { love: 'love' })],
  ['saveToggle', (p) => p.saveToggle(firstTrack(p), true)],
]

function firstTrack(p: FixtureProvider) {
  const track = p.catalog.tracks[0]
  if (track === undefined) throw new Error('empty fixture catalogue')
  return track
}

function firstPlaylist(p: FixtureProvider) {
  const playlist = p.catalog.playlists[0]
  if (playlist === undefined) throw new Error('empty fixture catalogue')
  return playlist
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (error: unknown) => error,
  )
}

describe('the signed-out state is reachable (§11.5, J6c)', () => {
  test('a signed-out device reports no session', () => {
    expect(createFixtureProvider({ authorized: false }).session).toBeNull()
  })

  for (const [name, call] of NEEDS_A_SESSION) {
    test(`${name}() refuses without a session`, async () => {
      const provider = createFixtureProvider({ authorized: false })
      const error = await caught(call(provider))
      expect(error).toBeInstanceOf(NotAuthorizedError)
      expect((error as NotAuthorizedError)._tag).toBe('NotAuthorized')
    })
  }

  test('signing in reaches the signed-in state, and the library appears', async () => {
    // The state has to be *leavable* as well as reachable, or J6c's "sign in
    // again" has nowhere to land.
    const provider = createFixtureProvider({ authorized: false })
    expect(await caught(provider.libraryList('songs'))).toBeInstanceOf(NotAuthorizedError)

    const session = await provider.authorize()
    expect(session.status).toBe('authorized')
    expect((await provider.libraryList('songs')).total).toBe(provider.catalog.tracks.length)
  })

  test('signing out returns to it', async () => {
    const provider = createFixtureProvider()
    expect((await provider.libraryList('songs')).total).toBe(provider.catalog.tracks.length)

    await provider.unauthorize()

    expect(provider.session).toBeNull()
    expect(await caught(provider.libraryList('songs'))).toBeInstanceOf(NotAuthorizedError)
    expect(await caught(provider.search({ term: 'vienna', scope: 'catalog', kinds: ['track'] }))).toBeInstanceOf(
      NotAuthorizedError,
    )
  })

  test('unauthorize is idempotent — signing out twice is not an error', async () => {
    const provider = createFixtureProvider({ authorized: false })
    await provider.unauthorize()
    expect(await caught(provider.unauthorize())).toBeNull()
  })

  test('configure and the capability surface stay available while signed out', async () => {
    // These are what a signed-out screen is allowed to call. Gating them would
    // make it impossible to render the sign-in screen at all.
    const provider = createFixtureProvider({ authorized: false })
    expect(await caught(provider.configure())).toBeNull()
    expect(provider.supports('libraryRead')).toBe(true)
    expect(provider.unsupportedReason('libraryRead')).toBeNull()
    expect(provider.playback.status).toBe('idle')
  })
})

describe('the signed-in-but-silent state is reachable (§14.3 row 3)', () => {
  test('a free-tier session says so', () => {
    const provider = createFixtureProvider({ canPlay: false })
    expect(provider.session?.status).toBe('authorized')
    expect(provider.session?.canPlay).toBe(false)
  })

  test('play() refuses, and nothing starts', async () => {
    const provider = createFixtureProvider({ canPlay: false })
    const album = provider.catalog.albums[0]
    if (album === undefined) throw new Error('empty fixture catalogue')

    const error = await caught(provider.play({ kind: 'album', album }))
    expect(error).toBeInstanceOf(PlaybackNotPermittedError)
    expect(provider.playback.status).not.toBe('playing')
    expect(provider.playback.now).toBeNull()
  })

  test('browsing still works — the posture is refuse-playback, not refuse-everything', async () => {
    // §14.3 row 3: free-tier Spotify is browse-only. Refusing the library here
    // would produce a screen §14.3 does not describe.
    const provider = createFixtureProvider({ canPlay: false })
    expect((await provider.libraryList('songs')).total).toBe(provider.catalog.tracks.length)
    expect((await provider.search({ term: 'vienna', scope: 'library', kinds: ['track'] })).tracks.length).toBeGreaterThan(0)
    expect(await caught(provider.queueAppend([firstTrack(provider)]))).toBeNull()
    expect(await caught(provider.setVolume(30))).toBeNull()
  })

  test('the tier is not a capability — supports("transport") stays true', () => {
    // A matrix answers for the service and is the same for every user; the
    // subscription tier is a property of this session. Collapsing them would
    // hide the transport controls for a free account, and §14.3 row 3 says the
    // wheel keeps working and S13 explains why nothing plays.
    const provider = createFixtureProvider({ canPlay: false })
    expect(provider.supports('transport')).toBe(true)
    expect(provider.unsupportedReason('transport')).toBeNull()
  })

  test('the three refusals are distinguishable by tag', async () => {
    const signedOut = createFixtureProvider({ authorized: false })
    const freeTier = createFixtureProvider({ canPlay: false })
    const noStations = createFixtureProvider({ supports: { stations: false } })

    expect(await caught(signedOut.play())).toBeInstanceOf(NotAuthorizedError)
    expect(await caught(freeTier.play())).toBeInstanceOf(PlaybackNotPermittedError)
    expect(await caught(noStations.stationsList())).toBeInstanceOf(CapabilityUnsupportedError)
  })
})
