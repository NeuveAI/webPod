import { describe, expect, test } from 'bun:test'

import { evaluate, LUMINANCE_TOLERANCE } from './luminance-probe'

describe('§12.3 luminance tolerance', () => {
  test('preserves mirrored readings instead of hiding asymmetry in the average', () => {
    const target = { surface: 'body-black' as const, token: 'raw', at: 0.5, expectedHex: '#808080', y: 0, z: 0, xs: [-1, 1] }
    const [result] = evaluate([{ target, samples: [[20, 30, 40], [80, 90, 100]] }])
    expect(result?.measuredSamples).toEqual([[20, 30, 40], [80, 90, 100]])
    expect(result?.measuredRgb).toEqual([50, 60, 70])
  })
  test('admits floating-point noise at the exact ±4 boundary', () => {
    const expected = '#808080'
    const boundaryChannel = 128 + LUMINANCE_TOLERANCE + 2.8e-14
    const [result] = evaluate([
      {
        target: {
          surface: 'steel-back', token: '--steel-5', at: 0.5, expectedHex: expected,
          y: 0, z: 0, xs: [0],
        },
        samples: [[boundaryChannel, boundaryChannel, boundaryChannel]],
      },
    ])

    expect(result?.pass).toBe(true)
    expect(result?.delta).toBeGreaterThan(LUMINANCE_TOLERANCE)
  })

  test('still rejects a materially out-of-band reading', () => {
    const channel = 128 + LUMINANCE_TOLERANCE + 1e-6
    const [result] = evaluate([
      {
        target: {
          surface: 'steel-back', token: '--steel-5', at: 0.5, expectedHex: '#808080',
          y: 0, z: 0, xs: [0],
        },
        samples: [[channel, channel, channel]],
      },
    ])

    expect(result?.pass).toBe(false)
  })
})
