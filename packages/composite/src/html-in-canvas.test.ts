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

  test('keeps one interactive DOM panel on the native HTMLTexture path', async () => {
    const source = await Bun.file(new URL('./html-in-canvas.ts', import.meta.url)).text()

    expect(source).toContain("canvas.setAttribute('layoutsubtree', 'true')")
    expect(source).toContain('canvas.appendChild(panelElement)')
    expect(source).toContain("panelElement.setAttribute('drawable', '')")
    expect(source).toContain("panelElement.dataset['pixelSource'] = 'html-in-canvas'")
    expect(source).toContain('new HTMLTexture(panelElement)')
    expect(source).toContain('texture.generateMipmaps = false')
    expect(source).toContain('texture.minFilter = LinearFilter')
    expect(source).toContain('texture.magFilter = LinearFilter')
    expect(source).toContain('new InteractionManager()')
    expect(source).toContain('proxy.matrixWorld.copy(transform.worldMatrix)')
    expect(source).toContain('interactions.update()')
    expect(source).not.toContain('LCD_OPTICAL_OVERLAY')
    expect(source).not.toContain('overlayMesh')
    expect(source).toContain('resolvePanelRasterFrame(')
    expect(source).toContain('screen.panel.scale')
    expect(source).toContain('content.style.transform =')
    expect(source).toContain('canvas.requestPaint()')
    expect(source).not.toContain('new CanvasTexture(')
    expect(source).not.toContain('drawElementImage(')
    expect(source).not.toContain('appendScaleTransform(')
    expect(source).not.toContain('updateElementGeometry')
    expect(source).not.toMatch(/texElement(?:Sub)?Image2D\s*\(/)
  })
})
