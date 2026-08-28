import { describe, expect, test } from 'bun:test'

import { createMicroNoiseRoughnessMap, createSteelAnisotropyMap } from './textures'

describe('deterministic physical textures', () => {
  test('roughness noise is byte-stable for the default seed', () => {
    const first = createMicroNoiseRoughnessMap(0.02, 16)
    const second = createMicroNoiseRoughnessMap(0.02, 16)
    expect(Array.from(first.image.data as Uint8Array)).toEqual(Array.from(second.image.data as Uint8Array))
    first.dispose()
    second.dispose()
  })

  test('steel grain encodes horizontal direction and bounded strength', () => {
    const texture = createSteelAnisotropyMap(16)
    const data = texture.image.data as Uint8Array
    for (let offset = 0; offset < data.length; offset += 4) {
      expect(data[offset]).toBe(255)
      expect(data[offset + 1]).toBe(128)
      expect(data[offset + 2]).toBeGreaterThanOrEqual(230)
      expect(data[offset + 2]).toBeLessThanOrEqual(255)
    }
    texture.dispose()
  })
})
