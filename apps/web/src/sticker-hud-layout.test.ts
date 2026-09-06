import { expect, test } from 'bun:test'
import { chooseHudLayout } from './sticker-hud-layout'
import type { StickerProjectedQuad } from '@webpod/device'
test('minimum and normal art have separate reachable grips and tools at desktop/mobile edges', () => {
  for (const width of [375, 1280]) for (const size of [28, 100]) for (const x of [70, width / 2, width - 70]) for (const y of [160, 400, 650]) {
    const quad: StickerProjectedQuad = { center: { x, y }, corners: [{ x: x-size/2, y: y-size/2 }, { x: x+size/2, y: y-size/2 }, { x: x+size/2, y: y+size/2 }, { x: x-size/2, y: y+size/2 }], edges: [{ x, y: y-size/2 }, { x: x+size/2, y }, { x, y: y+size/2 }, { x: x-size/2, y }] }
    const layout = chooseHudLayout(quad, width, 812), c = quad.corners[layout.corner] ?? quad.corners[2], e = quad.edges[layout.edge] ?? quad.edges[0]
    const points = [{ x: c.x+layout.resizeOffset.x, y: c.y+layout.resizeOffset.y }, { x: e.x+layout.rotateOffset.x, y: e.y+layout.rotateOffset.y }, ...[0,1,2,3].map(i => ({ x: layout.tools.x+22+i*44, y: layout.tools.y+22 }))]
    for (const p of points) { expect(p.x-22).toBeGreaterThanOrEqual(0); expect(p.x+22).toBeLessThanOrEqual(width); expect(p.y-22).toBeGreaterThanOrEqual(0); expect(p.y+22).toBeLessThanOrEqual(812) }
    for (let i=0;i<2;i++) for (let j=i+1;j<points.length;j++) { const a = points[i], b = points[j]; if (a === undefined || b === undefined) throw new Error('Missing target'); expect(Math.abs(a.x-b.x)>=44 || Math.abs(a.y-b.y)>=44).toBe(true) }
  }
})
