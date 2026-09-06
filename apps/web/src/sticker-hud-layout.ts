import type { StickerProjectedQuad, StickerScreenPoint } from '@webpod/device'

export const HUD_TARGET = 44
export interface HudLayout { readonly corner: number; readonly edge: number; readonly resizeOffset: StickerScreenPoint; readonly rotateOffset: StickerScreenPoint; readonly tools: StickerScreenPoint }
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n))
const hits = (p: StickerScreenPoint, b: { left: number; top: number; right: number; bottom: number }) => p.x + 22 > b.left && p.x - 22 < b.right && p.y + 22 > b.top && p.y - 22 < b.bottom
const overlap = (a: StickerScreenPoint, b: StickerScreenPoint, gap = 48) => Math.abs(a.x - b.x) < gap && Math.abs(a.y - b.y) < gap
/** Outboard handles keep their own 44px targets away from the visible body. */
export function chooseHudLayout(quad: StickerProjectedQuad, width: number, height: number, occupied: readonly { left: number; top: number; right: number; bottom: number }[] = []): HudLayout {
  const safe = (p: StickerScreenPoint) => ({ x: clamp(p.x, 30, width - 30), y: clamp(p.y, 64, height - 30) })
  const outside = (p: StickerScreenPoint, distance: number) => {
    const dx = p.x - quad.center.x, dy = p.y - quad.center.y, length = Math.hypot(dx, dy) || 1
    return safe({ x: p.x + dx / length * distance, y: p.y + dy / length * distance })
  }
  let best: HudLayout | null = null, bestScore = Infinity
  for (let corner = 0; corner < 4; corner++) for (let edge = 0; edge < 4; edge++) {
    const c = quad.corners[corner] ?? quad.corners[2], e = quad.edges[edge] ?? quad.edges[0], resize = outside(c, 34), rotate = outside(e, 42)
    if (overlap(resize, rotate)) continue
    const minX = Math.min(...quad.corners.map(p => p.x)), maxX = Math.max(...quad.corners.map(p => p.x))
    const minY = Math.min(...quad.corners.map(p => p.y)), maxY = Math.max(...quad.corners.map(p => p.y))
    const candidates = [{ x: quad.center.x - 88, y: maxY + 72 }, { x: quad.center.x - 88, y: minY - 100 }, { x: maxX + 58, y: quad.center.y - 22 }, { x: minX - 234, y: quad.center.y - 22 }]
    for (const raw of candidates) {
      const tools = { x: clamp(raw.x, 16, width - 192), y: clamp(raw.y, 64, height - 64) }
      const centers = [0, 1, 2, 3].map(i => ({ x: tools.x + 22 + i * 44, y: tools.y + 22 }))
      const insideBody = (p: StickerScreenPoint) => hits(p, { left: minX, right: maxX, top: minY, bottom: maxY }) || occupied.some(b => hits(p, b))
      if (centers.some(p => overlap(p, resize) || overlap(p, rotate) || insideBody(p)) || insideBody(resize) || insideBody(rotate)) continue
      const score = Math.hypot(tools.x + 88 - quad.center.x, tools.y + 22 - quad.center.y) + (corner === 2 ? 0 : 12) + (edge === 0 ? 0 : 6)
      if (score < bestScore) { bestScore = score; best = { corner, edge, resizeOffset: { x: resize.x - c.x, y: resize.y - c.y }, rotateOffset: { x: rotate.x - e.x, y: rotate.y - e.y }, tools } }
    }
  }
  if (best !== null) return best
  // At viewport edges, use distinct outboard seats with explicit connectors.
  // Search actual free rectangles; never return overlapping/clipped defaults.
  const minX = Math.min(...quad.corners.map(p => p.x)), maxX = Math.max(...quad.corners.map(p => p.x))
  const minY = Math.min(...quad.corners.map(p => p.y)), maxY = Math.max(...quad.corners.map(p => p.y))
  const free: StickerScreenPoint[] = []
  for (let y = 86; y <= height - 38; y += 48) for (let x = 38; x <= width - 38; x += 48) {
    if (!(x + 22 > minX && x - 22 < maxX && y + 22 > minY && y - 22 < maxY) && !occupied.some(b => hits({ x, y }, b))) free.push({ x, y })
  }
  free.sort((a, b) => Math.hypot(a.x - quad.center.x, a.y - quad.center.y) - Math.hypot(b.x - quad.center.x, b.y - quad.center.y))
  for (const resize of free) for (const rotate of free) {
    if (overlap(resize, rotate)) continue
    for (const first of free) {
      const centers = [0, 1, 2, 3].map(i => ({ x: first.x + i * 44, y: first.y }))
      if (centers.some(p => p.x + 22 > width - 16 || occupied.some(b => hits(p, b)) || overlap(p, resize) || overlap(p, rotate) || (p.x + 22 > minX && p.x - 22 < maxX && p.y + 22 > minY && p.y - 22 < maxY))) continue
      const c = quad.corners[2], e = quad.edges[0]
      return { corner: 2, edge: 0, resizeOffset: { x: resize.x - c.x, y: resize.y - c.y }, rotateOffset: { x: rotate.x - e.x, y: rotate.y - e.y }, tools: { x: first.x - 22, y: first.y - 22 } }
    }
  }
  throw new Error('No reachable sticker HUD layout in this viewport')
}
