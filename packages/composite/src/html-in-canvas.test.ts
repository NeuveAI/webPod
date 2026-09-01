import { describe, expect, test } from 'bun:test'

import {
  mutationAffectsPanelPixels,
  resolvePanelRasterDensity,
  resolvePanelRasterFrame,
} from './html-in-canvas'

describe('html-in-canvas invariants', () => {
  test('quantizes the authored LCD into stable 1×/2×/3× raster sources', () => {
    expect(resolvePanelRasterDensity(1)).toBe(1)
    expect(resolvePanelRasterDensity(1.25)).toBe(2)
    expect(resolvePanelRasterDensity(2)).toBe(2)
    expect(resolvePanelRasterDensity(2.01)).toBe(3)
    expect(resolvePanelRasterDensity(3)).toBe(3)
  })

  test('ignores host style writes so raster sizing does not request itself forever', () => {
    const panel = {} as HTMLElement
    const child = {} as Node

    expect(mutationAffectsPanelPixels(panel, panel, 'style')).toBe(false)
    expect(mutationAffectsPanelPixels(panel, panel, 'class')).toBe(true)
    expect(mutationAffectsPanelPixels(panel, child, 'style')).toBe(true)
    expect(mutationAffectsPanelPixels(panel, child, null)).toBe(true)
  })

  test('keeps the native 320×240 LCD source on stable 1×/2×/3× raster grids', () => {
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

  test('uses an offscreen 2D raster canvas, preserves the 320×240 source grid, and keeps shader sharpness out of the path', async () => {
    const source = await Bun.file(new URL('./html-in-canvas.ts', import.meta.url)).text()

    expect(source).toContain("rasterCanvas.className = 'wp-composite-raster-canvas'")
    expect(source).toContain("captureViewport.className = 'wp-composite-raster-viewport'")
    expect(source).toContain("rasterCanvas.setAttribute('layoutsubtree', 'true')")
    expect(source).toContain("captureViewport.setAttribute('drawable', '')")
    expect(source).toContain("panelElement.setAttribute('drawable', '')")
    expect(source).toContain("panelElement.dataset['pixelSource'] = 'html-in-canvas'")
    expect(source).toContain('const surfaceWidth = Math.max(1, Math.round(rasterFrame.width / density))')
    expect(source).toContain('panelElement.style.transform = `scale(${String(scaleX)}, ${String(scaleY)})`')
    expect(source).toContain('new CanvasTexture(rasterCanvas)')
    expect(source).toContain('texture.generateMipmaps = false')
    expect(source).toContain('texture.minFilter = LinearFilter')
    expect(source).toContain('texture.magFilter = LinearFilter')
    expect(source).not.toContain('LCD_OPTICAL_OVERLAY')
    expect(source).not.toContain('overlayMesh')
    expect(source).toContain('resolvePanelRasterFrame(')
    expect(source).toContain('screen.panel.scale')
    expect(source).toContain('rasterContext.drawElementImage(')
    expect(source).toContain('captureViewport,')
    expect(source).toContain("rasterCanvas.requestPaint()")
    expect(source).not.toContain('new HTMLTexture(')
    expect(source).not.toContain('new InteractionManager()')
    expect(source).not.toContain('appendScaleTransform(')
    expect(source).not.toContain('updateElementGeometry')
    expect(source).not.toMatch(/texElement(?:Sub)?Image2D\s*\(/)
  })
})
