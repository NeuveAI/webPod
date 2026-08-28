import { describe, expect, test } from 'bun:test'

import { InvalidLocalKeyError } from './errors.ts'
import { asLocalKey, isLocalKey, localKeyOf, mintLocalKey } from './identity.ts'
import type { LocalKey, TrackRef } from './identity.ts'

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
    // @ts-expect-error libraryId is a provider id and must not be a key — §14.5
    takesAKey(ref.libraryId)
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
})
