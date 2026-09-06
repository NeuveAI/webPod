import type { StickerProjectedContour, StickerScreenPoint } from '@webpod/device'
export const HUD_TARGET = 44
export interface HudLayout { readonly offsets: readonly StickerScreenPoint[]; readonly wear: StickerScreenPoint; readonly tools: StickerScreenPoint }
type Rect = { left: number; top: number; right: number; bottom: number }
const overlaps = (a: Rect, b: Rect) => a.left < b.right + 4 && a.right > b.left - 4 && a.top < b.bottom + 4 && a.bottom > b.top - 4
const rect = (p: StickerScreenPoint, width = 44): Rect => ({ left: p.x - width / 2, right: p.x + width / 2, top: p.y - 22, bottom: p.y + 22 })
/** Four distinct contour-sector targets, with reserved top wear and free adjacent actions. */
export function chooseHudLayout(shape: StickerProjectedContour, width: number, height: number, occupied: readonly Rect[] = []): HudLayout {
  const points = shape.paths.flat(), minY = Math.min(...points.map(p => p.y)), maxY = Math.max(...points.map(p => p.y))
  const body = { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)), top: minY, bottom: maxY }
  const fits = (r: Rect) => r.left >= 12 && r.right <= width - 12 && r.top >= 56 && r.bottom <= height - 12
  const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n))
  const bodyCore = { left:shape.center.x-8,right:shape.center.x+8,top:shape.center.y-8,bottom:shape.center.y+8 }
  for (const distance of [8, 16, 24, 32, 42, 56]) {
    const grips = shape.anchors.map(p => {
      const dx = p.x - shape.center.x, dy = p.y - shape.center.y, length = Math.hypot(dx, dy) || 1
      return { x: clamp(p.x + dx / length * distance, 34, width - 34), y: clamp(p.y + dy / length * distance, 78, height - 34) }
    })
    const targets = grips.map(p => rect(p))
    if (targets.some((r, i) => !fits(r) || overlaps(r, bodyCore) || targets.some((other, j) => j < i && overlaps(r, other)))) continue
    const wear = { x: clamp(shape.center.x, 84, width - 84), y: Math.min(...grips.map(p => p.y)) - 52 }
    const wearRect = rect(wear, 144)
    if (!fits(wearRect) || targets.some(r => overlaps(r, wearRect)) || occupied.some(r => overlaps(r, wearRect))) continue
    const candidates = [
      { x: clamp(shape.center.x, 56, width - 56), y: Math.max(...grips.map(p => p.y)) + 52 },
      { x: clamp(body.right + 80, 56, width - 56), y: shape.center.y },
      { x: clamp(body.left - 80, 56, width - 56), y: shape.center.y },
    ]
    const tools = candidates.find(p => { const r = rect(p, 88); return fits(r) && !overlaps(r, body) && !overlaps(r, wearRect) && !targets.some(t => overlaps(t, r)) && !occupied.some(t => overlaps(t, r)) })
    if (tools) return { offsets: grips.map((p, i) => ({ x: p.x - (shape.anchors[i] ?? shape.anchors[0]).x, y: p.y - (shape.anchors[i] ?? shape.anchors[0]).y })), wear: { x: wear.x - 72, y: wear.y - 22 }, tools: { x: tools.x - 44, y: tools.y - 22 } }
  }
  // Edge placements retain all four controls using distinct nearby free seats.
  // Connections still originate at actual contour sectors, never a box frame.
  let wear = { x: Math.max(84, Math.min(width - 84, shape.center.x)), y: Math.max(78, minY - 62) }
  const wearChoices: StickerScreenPoint[] = []
  for (let y = 78; y <= minY - 28; y += 24) for (let x = 84; x <= width - 84; x += 24) { const p = {x,y}; if (!occupied.some(b => overlaps(rect(p,144),b)) && !overlaps(rect(p,144),body)) wearChoices.push(p) }
  wearChoices.sort((a,b)=>Math.hypot(a.x-shape.center.x,a.y-minY)-Math.hypot(b.x-shape.center.x,b.y-minY))
  wear = wearChoices[0] ?? wear
  const wearRect = rect(wear, 144), seats: StickerScreenPoint[] = []
  for (let y = 78; y <= height - 34; y += 48) for (let x = 34; x <= width - 34; x += 48) { const p = { x, y }, r = rect(p); if (!overlaps(r, body) && !overlaps(r, wearRect)) seats.push(p) }
  const grips: StickerScreenPoint[] = []
  for (const anchor of shape.anchors) {
    const seat = seats.filter(p => !grips.some(g => overlaps(rect(g), rect(p)))).sort((a, b) => Math.hypot(a.x - anchor.x, a.y - anchor.y) - Math.hypot(b.x - anchor.x, b.y - anchor.y))[0]
    if (seat === undefined) throw new Error('Four contour grips cannot fit this viewport')
    grips.push(seat)
  }
  const tools = seats.filter(p => { const r = rect(p, 88); return fits(r) && !overlaps(r, body) && !overlaps(r, wearRect) && !grips.some(g => overlaps(rect(g), r)) && !occupied.some(b => overlaps(r, b)) }).sort((a,b) => Math.hypot(a.x-shape.center.x,a.y-shape.center.y)-Math.hypot(b.x-shape.center.x,b.y-shape.center.y))[0]
  if (tools === undefined) throw new Error('Contour actions cannot fit this viewport')
  return { offsets: grips.map((p,i) => ({ x:p.x-(shape.anchors[i] ?? shape.anchors[0]).x, y:p.y-(shape.anchors[i] ?? shape.anchors[0]).y })), wear: { x:wear.x-72,y:wear.y-22 }, tools:{ x:tools.x-44,y:tools.y-22 } }
}
