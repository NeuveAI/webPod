import type { BufferGeometry } from "three";

/** Smooth cylindrical crown shared by renderer and calibration projection. */
export function verticalCrownOffset(
  y: number,
  halfHeight: number,
  crown: number,
): number {
  const unitY = Math.min(1, Math.max(-1, y / halfHeight));
  return crown * (1 - unitY * unitY);
}

/**
 * Bends an extruded front plate without adding stop-local facets.
 *
 * The quadratic is one physical degree of freedom: its integral is a smooth
 * cylindrical shell, zero at the top/bottom join and maximal at the waist.
 */
export function applyVerticalCrown(
  geometry: BufferGeometry,
  halfHeight: number,
  crown: number,
): BufferGeometry {
  if (crown === 0) return geometry;
  const position = geometry.getAttribute("position");
  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index);
    position.setZ(
      index,
      position.getZ(index) + verticalCrownOffset(y, halfHeight, crown),
    );
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
