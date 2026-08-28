import { describe, expect, test } from 'bun:test'

import { HTML_IN_CANVAS_REQUIREMENTS } from './pixel-source'

describe('panel pixel source seam', () => {
  test('declares the one T1 variant that flows end to end', () => {
    expect(HTML_IN_CANVAS_REQUIREMENTS).toEqual({
      renderer: 'webgl',
      materialVariant: 'html-texture-lcd',
      shaderVariants: ['lcd-scanline-subpixel'],
      textureSet: ['panel-dom'],
    })
  })

  test('freezes nested requirement lists so a consumer cannot mutate the contract', () => {
    expect(Object.isFrozen(HTML_IN_CANVAS_REQUIREMENTS)).toBe(true)
    expect(Object.isFrozen(HTML_IN_CANVAS_REQUIREMENTS.shaderVariants)).toBe(true)
    expect(Object.isFrozen(HTML_IN_CANVAS_REQUIREMENTS.textureSet)).toBe(true)
  })
})
