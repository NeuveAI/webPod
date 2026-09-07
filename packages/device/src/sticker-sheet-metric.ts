import { Vector3 } from 'three';

export interface StickerMaterialPoint { readonly x: number; readonly y: number }
export interface StickerSheetMetric {
  readonly minimumStretch: number;
  readonly maximumStretch: number;
  readonly areaRatio: number;
  /** Unnormalized actual triangle normal; orientation requires local contact/topology context. */
  readonly normal: Vector3;
}

/** Deformation singular values of the actual rendered triangle against its flat material triangle.
 * Measures a piecewise-linear sheet, not an inferred curved path between its vertices.
 * A valid metric does not establish collision freedom or absence of self-intersection.
 */
export function stickerSheetTriangleMetric(
  material: readonly [StickerMaterialPoint, StickerMaterialPoint, StickerMaterialPoint],
  rendered: readonly [Vector3, Vector3, Vector3],
): StickerSheetMetric | null {
  if (!material.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)) ||
    !rendered.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))) return null;
  const [a, b, c] = material;
  const ux = b.x - a.x, uy = b.y - a.y, vx = c.x - a.x, vy = c.y - a.y;
  const determinant = ux * vy - uy * vx;
  if (Math.abs(determinant) < 1e-12) return null;
  const ab = rendered[1].clone().sub(rendered[0]);
  const ac = rendered[2].clone().sub(rendered[0]);
  const du = ab.clone().multiplyScalar(vy / determinant).addScaledVector(ac, -uy / determinant);
  const dv = ab.clone().multiplyScalar(-vx / determinant).addScaledVector(ac, ux / determinant);
  const g00 = du.lengthSq(), g11 = dv.lengthSq(), g01 = du.dot(dv);
  const discriminant = Math.hypot(g00 - g11, 2 * g01);
  const maximumSquared = (g00 + g11 + discriminant) / 2;
  // Product form avoids cancellation of the smaller eigenvalue near strong anisotropy.
  const gramDeterminant = du.clone().cross(dv).lengthSq();
  if (maximumSquared < 1e-20 || gramDeterminant < 1e-20) return null;
  return {
    minimumStretch: Math.sqrt(gramDeterminant / maximumSquared),
    maximumStretch: Math.sqrt(maximumSquared),
    areaRatio: Math.sqrt(gramDeterminant),
    normal: ab.cross(ac),
  };
}
