import { describe, expect, test } from 'bun:test'

import { CapabilityUnsupportedError } from '../errors.ts'
import type { RepeatMode, ShuffleMode } from '../domain.ts'
import { createFixtureProvider } from './fixture-provider.ts'

/** §11.1's B02 lists exactly these. The literals are the requirement (D-050). */
const B02_SHUFFLE_MODES: readonly (readonly [ShuffleMode])[] = [['off'], ['songs'], ['albums']]
const B02_REPEAT_MODES: readonly (readonly [RepeatMode])[] = [['off'], ['one'], ['all']]

describe('§14.3 row 27 / D-052 — shuffle and repeat go through the provider', () => {
  test('both default to off, per B02', () => {
    const provider = createFixtureProvider()
    expect(provider.playback.shuffle).toBe('off')
    expect(provider.playback.repeat).toBe('off')
  })

  test.each(B02_SHUFFLE_MODES)('setShuffle(%p) is read back through playback', async (mode) => {
    const provider = createFixtureProvider()
    await provider.setShuffle(mode)
    expect(provider.playback.shuffle).toBe(mode)
  })

  test.each(B02_REPEAT_MODES)('setRepeat(%p) is read back through playback', async (mode) => {
    const provider = createFixtureProvider()
    await provider.setRepeat(mode)
    expect(provider.playback.repeat).toBe(mode)
  })

  test('the mode is provider state, so a playback subscriber sees it change', async () => {
    // The point of D-052's "through the provider, not device state" ruling: a
    // consumer reads the mode from the same snapshot it reads everything else
    // from, and cannot end up rendering a local flag that changes nothing.
    const provider = createFixtureProvider()
    const seen: ShuffleMode[] = []
    provider.onPlaybackChange((s) => seen.push(s.shuffle))
    await provider.setShuffle('albums')
    await provider.setShuffle('off')
    expect(seen).toEqual(['albums', 'off'])
  })

  test('both are gated on transport, which is what §14.3 row 27 makes them part of', async () => {
    const provider = createFixtureProvider({ supports: { transport: false } })
    for (const call of [provider.setShuffle('songs'), provider.setRepeat('all')]) {
      let thrown: unknown = null
      await call.catch((error: unknown) => {
        thrown = error
      })
      expect(thrown).toBeInstanceOf(CapabilityUnsupportedError)
      expect((thrown as CapabilityUnsupportedError).capability).toBe('transport')
    }
  })
})
