import { describe, expect, test } from 'bun:test'

import { mutationAffectsPanelPixels, resolvePanelRasterDensity } from './html-in-canvas'

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

  test('delegates experimental upload and geometry APIs to Three', async () => {
    const source = await Bun.file(new URL('./html-in-canvas.ts', import.meta.url)).text()

    expect(source).toContain('new HTMLTexture(')
    expect(source).toContain('texture.generateMipmaps = false')
    expect(source).toContain('texture.minFilter = NearestFilter')
    expect(source).toContain('texture.magFilter = NearestFilter')
    expect(source).not.toContain('wpScanline')
    expect(source).not.toContain('wpTriad')
    expect(source).toContain('new InteractionManager()')
    expect(source).not.toMatch(/texElement(?:Sub)?Image2D\s*\(/)
    expect(source).not.toContain('updateElementGeometry')
  })
})
