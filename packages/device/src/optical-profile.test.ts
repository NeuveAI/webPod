import { describe, expect, test } from 'bun:test'
import { createOpticalNormalMap } from './optical-profile'

describe('moulded-surface optical profile', () => {
  test('encodes top-to-bottom tilt as a deterministic tangent-space normal map', () => {
    const first = createOpticalNormalMap([[0, -30], [1, 30]], 3)
    const second = createOpticalNormalMap([[0, -30], [1, 30]], 3)
    const a = Array.from(first.image.data as Uint8Array)
    const b = Array.from(second.image.data as Uint8Array)
    expect(a).toEqual(b)
    expect(a[1]).toBeGreaterThan(a[9] ?? 255)
    expect(a[6]).toBe(255)
    first.dispose()
    second.dispose()
  })
})
