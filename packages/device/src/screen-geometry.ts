import { ExtrudeGeometry } from "three";

import { roundedRectShape } from "./shapes";

/**
 * Build the D-056 screen surface with texture coordinates in normalized panel
 * space. Three's default ExtrudeGeometry generator writes shape coordinates
 * directly into cap UVs; for a 272 × 204 screen that makes every sample clamp
 * to a texture edge. The composite seam requires the conventional texture
 * orientation: TL (0,1), TR (1,1), BR (1,0), BL (0,0).
 */
export function createScreenGeometry(
  width: number,
  height: number,
  cornerRadius: number,
): ExtrudeGeometry {
  const geometry = new ExtrudeGeometry(
    roundedRectShape(width, height, cornerRadius, 8),
    {
      depth: 0.1,
      bevelEnabled: false,
      curveSegments: 1,
    },
  );
  const positions = geometry.getAttribute("position");
  const uvs = geometry.getAttribute("uv");

  for (let index = 0; index < positions.count; index += 1) {
    uvs.setXY(
      index,
      positions.getX(index) / width + 0.5,
      positions.getY(index) / height + 0.5,
    );
  }
  uvs.needsUpdate = true;
  return geometry;
}
