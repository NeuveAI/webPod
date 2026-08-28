import { describe, expect, test } from 'bun:test'

import { mutationAffectsPanelPixels } from './html-in-canvas'

describe('html-in-canvas invariants', () => {
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
    expect(source).toContain('new InteractionManager()')
    expect(source).not.toMatch(/texElement(?:Sub)?Image2D\s*\(/)
    expect(source).not.toContain('updateElementGeometry')
  })
})
