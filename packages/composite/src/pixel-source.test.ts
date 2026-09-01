import { describe, expect, test } from 'bun:test'

import {
  HTML_IN_CANVAS_REQUIREMENTS,
  type PanelPixelSource,
} from './pixel-source'

const rendererlessSource = {
  tier: 'T4',
  requires: {
    renderer: 'none',
    materialVariant: 'flat-dom',
    shaderVariants: [],
    textureSet: [],
  },
  attach(attachment) {
    attachment.panelElement.dataset['rendererlessProof'] = attachment.kind
  },
  syncGeometry() {},
  detach() {},
} satisfies PanelPixelSource<'none'>

describe('panel pixel source seam', () => {
  test('declares the one T1 variant that flows end to end', () => {
    expect(HTML_IN_CANVAS_REQUIREMENTS).toEqual({
      renderer: 'webgl',
      materialVariant: 'canvas-raster-lcd',
      shaderVariants: [],
      textureSet: ['panel-raster-canvas'],
    })
  })

  test('freezes nested requirement lists so a consumer cannot mutate the contract', () => {
    expect(Object.isFrozen(HTML_IN_CANVAS_REQUIREMENTS)).toBe(true)
    expect(Object.isFrozen(HTML_IN_CANVAS_REQUIREMENTS.shaderVariants)).toBe(true)
    expect(Object.isFrozen(HTML_IN_CANVAS_REQUIREMENTS.textureSet)).toBe(true)
  })

  test('admits a renderer-less tier without fake WebGL or device values', () => {
    expect(rendererlessSource.requires.renderer).toBe('none')
    expect(rendererlessSource.attach.length).toBe(1)
  })
})
