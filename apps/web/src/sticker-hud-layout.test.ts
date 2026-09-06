import { expect, test } from 'bun:test'
import { chooseHudLayout } from './sticker-hud-layout'
import type { StickerProjectedContour } from '@webpod/device'
test('minimum and normal art have separate reachable grips and tools at desktop/mobile edges', () => {
  for (const width of [375, 1280]) for (const size of [28, 100]) for (const x of [70, width / 2, width - 70]) for (const y of [160, 400, 650]) {
    const corners: StickerProjectedContour['anchors'] = [{x:x-size/2,y:y-size/2},{x:x+size/2,y:y-size/2},{x:x+size/2,y:y+size/2},{x:x-size/2,y:y+size/2}]
    const quad: StickerProjectedContour = { center: {x,y}, anchors:corners, paths:[corners] }
    const layout = chooseHudLayout(quad,width,812)
    const points = [...quad.anchors.map((p,i)=>({x:p.x+(layout.offsets[i]?.x ?? 0),y:p.y+(layout.offsets[i]?.y ?? 0)})), ...[0,1].map(i=>({x:layout.tools.x+22+i*44,y:layout.tools.y+22}))]
    for (const p of points) { expect(p.x-22).toBeGreaterThanOrEqual(0); expect(p.x+22).toBeLessThanOrEqual(width); expect(p.y-22).toBeGreaterThanOrEqual(0); expect(p.y+22).toBeLessThanOrEqual(812) }
    for (let i=0;i<4;i++) for (let j=i+1;j<points.length;j++) { const a = points[i], b = points[j]; if (a === undefined || b === undefined) throw new Error('Missing target'); expect(Math.abs(a.x-b.x)>=44 || Math.abs(a.y-b.y)>=44).toBe(true) }
  }
})
