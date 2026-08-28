import { describe, expect, test } from 'bun:test'

import { InvalidLocalKeyError } from './errors.ts'
import { asLocalKey, isLocalKey, localKeyOf, mintLocalKey } from './identity.ts'
import type { LocalKey, ProviderId, TrackRef } from './identity.ts'
import { createFixtureCatalog } from './fixture/catalog.ts'
import { createFixtureProvider } from './fixture/fixture-provider.ts'

const UUID_V7_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('LocalKey minting', () => {
  test('mints a canonical UUIDv7', () => {
    expect(mintLocalKey()).toMatch(UUID_V7_SHAPE)
  })

  test('never repeats, even in a tight burst', () => {
    const keys = new Set<string>()
    for (let i = 0; i < 20_000; i++) keys.add(mintLocalKey())
    expect(keys.size).toBe(20_000)
  })

  test('sorts by mint order, which is the property v4 does not have', () => {
    // The Engraving renders newest-first and dedupe passes rely on ordering,
    // so a burst inside one millisecond must still come out ordered. This is
    // the counter in `rand_a`, not the timestamp, doing the work.
    const keys: string[] = []
    for (let i = 0; i < 5000; i++) keys.push(mintLocalKey())
    expect([...keys].sort()).toEqual(keys)
  })

  test('carries the timestamp it was minted at', () => {
    const before = Date.now()
    const key = mintLocalKey()
    const after = Date.now()
    const ms = Number.parseInt(key.slice(0, 8) + key.slice(9, 13), 16)
    expect(ms).toBeGreaterThanOrEqual(before)
    expect(ms).toBeLessThanOrEqual(after)
  })
})

describe('LocalKey narrowing at the edges', () => {
  test('accepts a key it minted', () => {
    expect(isLocalKey(mintLocalKey())).toBe(true)
    expect(() => asLocalKey(mintLocalKey())).not.toThrow()
  })

  test.each([
    ['an Apple catalog id', '1440857781'],
    ['an Apple library id', 'i.gLrJKQEsl5eL2q'],
    ['a Spotify track id', '4uLU6hMCjMI75M1A2tKUQC'],
    ['a Spotify uri', 'spotify:track:4uLU6hMCjMI75M1A2tKUQC'],
    ['a UUIDv4', '9f8b1c2d-3e4f-4a5b-8c9d-0e1f2a3b4c5d'],
    ['an empty string', ''],
  ])('rejects %s', (_label, value) => {
    expect(isLocalKey(value)).toBe(false)
    expect(() => asLocalKey(value)).toThrow(InvalidLocalKeyError)
  })

  test('the rejection is tagged, not just an Error', () => {
    try {
      asLocalKey('1440857781')
      throw new Error('expected asLocalKey to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidLocalKeyError)
      expect((error as InvalidLocalKeyError)._tag).toBe('InvalidLocalKey')
    }
  })
})

describe('§14.5 — a provider id cannot occupy a key position', () => {
  // These assertions are checked by `tsc`, not at runtime. If the brand ever
  // stops rejecting a raw string the build fails on the unused directive,
  // which is why they are written as `@ts-expect-error` rather than as a
  // comment saying the same thing.

  // Returns the key so the parameter is genuinely consumed; the assertions
  // below are about what the compiler will let through the parameter slot.
  function takesAKey(key: LocalKey): LocalKey {
    return key
  }

  const ref: TrackRef = {
    kind: 'track',
    key: mintLocalKey(),
    provider: 'apple',
    catalogId: '1440857781',
    libraryId: 'i.gLrJKQEsl5eL2q',
    title: 'Vienna',
    artistName: 'The Fray',
    durationMs: 224_000,
    playable: true,
  }

  test('a bare string is not a LocalKey', () => {
    // @ts-expect-error a plain string must not satisfy LocalKey — §14.5
    takesAKey('1440857781')
    expect(true).toBe(true)
  })

  test('a catalogId is not a LocalKey', () => {
    // @ts-expect-error catalogId is a provider id and must not be a key — §14.5
    takesAKey(ref.catalogId)
    expect(true).toBe(true)
  })

  test('a libraryId is not a LocalKey — a third id space, and still not ours', () => {
    // ⚑ `?? ''` is load-bearing. `ref.libraryId` is `string | undefined`, so
    // without it this directive is satisfied by the **optionality** and passes
    // unchanged against an unbranded `type LocalKey = string`. It was recorded
    // as one of three brand proofs and only two were; the plant that removes
    // the brand must turn all three red, not two.
    const libraryId: string = ref.libraryId ?? ''
    // @ts-expect-error libraryId is a provider id and must not be a key — §14.5
    takesAKey(libraryId)
    expect(true).toBe(true)
  })

  test('a Spotify uri is not a LocalKey either', () => {
    const uri: string = 'spotify:track:4uLU6hMCjMI75M1A2tKUQC'
    // @ts-expect-error a provider URI is a provider id and must not be a key — §14.5
    takesAKey(uri)
    expect(true).toBe(true)
  })

  test('a minted key is', () => {
    takesAKey(mintLocalKey())
    takesAKey(localKeyOf(ref))
    expect(isLocalKey(ref.key)).toBe(true)
  })

  test('a LocalKey is still a string at runtime and to the compiler', () => {
    const asString: string = ref.key
    expect(typeof asString).toBe('string')
    expect(asString).toMatch(UUID_V7_SHAPE)
  })

  test('the package spends the brand on the structures it owns', () => {
    // §14.5's rule is about *our* structures, and `LocalKeyed` was written for
    // exactly this. Exporting the type and then declaring the only two maps in
    // the package as `ReadonlyMap<string, …>` left the guarantee unspent in
    // the one structure W3 consumes directly.
    const catalog = createFixtureCatalog()
    const album = catalog.albums[0]
    if (album === undefined) throw new Error('empty fixture catalogue')

    expect(catalog.tracksByAlbum.get(album.key)).toBeDefined()

    // @ts-expect-error a catalogId must not index a structure of ours — §14.5
    catalog.tracksByAlbum.get(album.catalogId)
    // @ts-expect-error an Apple library id must not index a structure of ours — §14.5
    catalog.tracksByAlbum.get('i.gLrJKQEsl5eL2q')
    // @ts-expect-error a Spotify uri must not index a structure of ours — §14.5
    catalog.tracksByPlaylist.get('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M')
  })
})

describe('D-053(b) — ProviderId membership is a ruling, so it is asserted', () => {
  /**
   * Transcribed by hand from D-053(b) and §14.2, not imported.
   *
   * `"apple" | "spotify"` is §14.2's; `"fixture"` is the one accepted widening.
   * Without this, adding a fourth member left 230 tests green and `tsc` at 0 —
   * a settled ruling with nothing standing on it (D-050).
   */
  const RULED_PROVIDER_IDS: readonly string[] = ['apple', 'spotify', 'fixture']

  test('there are exactly three, and they are these', () => {
    const declared: Record<ProviderId, true> = { apple: true, spotify: true, fixture: true }
    expect(Object.keys(declared).sort()).toEqual([...RULED_PROVIDER_IDS].sort())
  })

  test('every provider this package ships reports one of them', () => {
    for (const id of [createFixtureProvider().id, 'apple', 'spotify']) {
      expect(RULED_PROVIDER_IDS).toContain(id)
    }
  })
})
