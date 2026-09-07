export interface StickerInsertRect { readonly centerX: number; readonly centerY: number; readonly width: number; readonly height: number; readonly cornerR: number }
/** Local film ramp into one known recessed insert. Outside the insert, actual
 * support is unchanged. Both endpoints come from the supplied real envelope.
 * This is a candidate support height, not a collision-clearance certificate.
 */
export function stickerInsertBridgeHeight(x: number, y: number, rect: StickerInsertRect, support: (x: number, y: number) => number | null, span = 6): number | null {
  const height = support(x, y);
  if (height === null) return null;
  const lx = x - rect.centerX, ly = y - rect.centerY;
  const hx = rect.width / 2 - rect.cornerR, hy = rect.height / 2 - rect.cornerR;
  const qx = Math.abs(lx) - hx, qy = Math.abs(ly) - hy;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
  const distance = Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - rect.cornerR;
  const inside = -distance;
  if (inside <= 0 || inside >= span) return height;
  let nx: number, ny: number;
  if (ox > 0 || oy > 0) { const norm = Math.hypot(ox, oy); nx = Math.sign(lx) * ox / norm; ny = Math.sign(ly) * oy / norm; }
  else if (qx > qy) { nx = Math.sign(lx); ny = 0; }
  else { nx = 0; ny = Math.sign(ly); }
  const bx = x + nx * inside, by = y + ny * inside;
  const high = support(bx + nx * .02, by + ny * .02);
  const farther = support(bx + nx * .12, by + ny * .12);
  const low = support(bx - nx * span, by - ny * span);
  if (high === null || farther === null || low === null) return height;
  if (Math.hypot(span + .02, high - low) > 12) throw new Error('Insert bridge exceeds endpoint span');
  const slope = -(farther - high) / .1;
  const boundaryHeight = high + slope * .02;
  const t = inside / span, t2 = t * t, t3 = t2 * t;
  const bridge = (2 * t3 - 3 * t2 + 1) * boundaryHeight + (t3 - 2 * t2 + t) * span * slope + (-2 * t3 + 3 * t2) * low;
  return Math.max(height, bridge);
}
