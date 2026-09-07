function required<T>(value: T | undefined): T { if (value === undefined) throw new Error("Missing strip section"); return value; }
/** Piecewise-linear material arclength of one actual shell section.
 * Negative distance continues onto the unchanged rear plane. No global radial
 * angle or longitudinal scaling participates in this developable coordinate.
 */
export function createStickerStripProfile(points: readonly { readonly x: number; readonly z: number }[], rearCount: number) {
  if (points.length < 2 || rearCount < 2 || rearCount > points.length || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.z))) throw new Error('Invalid sticker strip section');
  const sections = points.map(p => ({ ...p, distance: 0 }));
  for (let i = 1; i < sections.length; i++) {
    const a = required(sections[i - 1]), b = required(sections[i]);
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < 1e-10) throw new Error('Degenerate sticker strip segment');
    b.distance = a.distance + length;
  }
  const first = required(sections[0]), last = required(sections.at(-1));
  return {
    length: last.distance,
    rearDistance(x: number): number {
      if (!Number.isFinite(x)) throw new Error('Invalid rear coordinate');
      if (x <= first.x) return x - first.x;
      for (let i = 1; i < rearCount; i++) {
        const a = required(sections[i - 1]), b = required(sections[i]);
        if (x <= b.x + 1e-7) return a.distance + (b.distance - a.distance) * Math.min(1, (x - a.x) / (b.x - a.x));
      }
      throw new Error('Rear center exceeds section');
    },
    sample(distance: number): { x: number; z: number } {
      if (!Number.isFinite(distance) || distance > last.distance) throw new Error(`Sticker exceeds supported strip: ${distance} > ${last.distance}`);
      if (distance <= 0) return { x: first.x + distance, z: first.z };
      let low = 0, high = sections.length - 1;
      while (high - low > 1) { const middle = (low + high) >> 1; if (required(sections[middle]).distance < distance) low = middle; else high = middle; }
      const a = required(sections[low]), b = required(sections[high]);
      const t = (distance - a.distance) / (b.distance - a.distance);
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    },
  };
}
