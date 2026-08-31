import { describe, expect, test } from 'bun:test'

import {
  mutationAffectsPanelPixels,
  resolvePanelRasterDensity,
  resolvePanelRasterFrame,
} from './html-in-canvas'

describe('html-in-canvas invariants', () => {
  test('quantizes the logical 320×240 panel into stable 1×/2×/3× raster sources', () => {
    expect(resolvePanelRasterDensity(1)).toBe(1)
    expect(resolvePanelRasterDensity(1.25)).toBe(2)
    expect(resolvePanelRasterDensity(2)).toBe(2)
    expect(resolvePanelRasterDensity(2.01)).toBe(3)
    expect(resolvePanelRasterDensity(3)).toBe(3)
  })
  test('ignores only InteractionManager geometry writes on the panel host', () => {
    const panel = {} as HTMLElement
    const child = {} as Node

    expect(mutationAffectsPanelPixels(panel, panel, 'style')).toBe(false)
    expect(mutationAffectsPanelPixels(panel, panel, 'class')).toBe(true)
    expect(mutationAffectsPanelPixels(panel, child, 'style')).toBe(true)
    expect(mutationAffectsPanelPixels(panel, child, null)).toBe(true)
  })

  test('upscales the 272×204 authored LCD to the 320×240 html-in-canvas grid before raster quantization', () => {
    expect(resolvePanelRasterFrame(272, 204, 1, 0.85)).toEqual({
      width: 320,
      height: 240,
      scale: 1 / 0.85,
    })
    expect(resolvePanelRasterFrame(272, 204, 2, 0.85)).toEqual({
      width: 640,
      height: 480,
      scale: 2 / 0.85,
    })
    expect(resolvePanelRasterFrame(340, 255, 1, 0.85)).toEqual({
      width: 400,
      height: 300,
      scale: 1 / 0.85,
    })
  })

  test('delegates experimental upload and geometry APIs to Three', async () => {
    const source = await Bun.file(new URL('./html-in-canvas.ts', import.meta.url)).text()

    expect(source).toContain('new HTMLTexture(')
    expect(source).toContain('texture.generateMipmaps = false')
    expect(source).toContain('texture.minFilter = LinearFilter')
    expect(source).toContain('texture.magFilter = NearestFilter')
    expect(source).toContain('texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())')
    expect(source).toContain('resolvePanelRasterFrame(')
    expect(source).toContain('screen.panel.scale')
    expect(source).not.toContain('wpScanline')
    expect(source).not.toContain('wpTriad')
    expect(source).toContain('new InteractionManager()')
    expect(source).not.toMatch(/texElement(?:Sub)?Image2D\s*\(/)
    expect(source).not.toContain('updateElementGeometry')
  })
})
