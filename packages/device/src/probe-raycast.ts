import {
  CanvasTexture,
  type Intersection,
  type Material,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
} from "three";

/** The one rendered overlay whose empty texels may be ignored by the probe. */
export const WHEEL_LABEL_DECAL_NAME = "wheel-label-decal";

export type ProbeHitIdentity = {
  readonly objectName: string | undefined;
  readonly materialNames: ReadonlyArray<string | undefined>;
};

function isVisibleInScene(object: Object3D): boolean {
  let current: Object3D | null = object;
  while (current !== null) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

function hitMaterial(
  hit: Intersection<Mesh>,
): Material | null {
  const source = hit.object.material;
  if (!Array.isArray(source)) return source;
  const index = hit.face?.materialIndex;
  return index === undefined ? null : (source[index] ?? null);
}

/**
 * Returns true only when the generated label decal contributes no pixel.
 *
 * The invariant is intentionally narrow. Three raycasts geometry rather than
 * texture alpha, while the decal is a transparent CanvasTexture over the wheel.
 * Its empty texels are the only intersections the framebuffer does not contain.
 * Missing UVs, a changed material/map type, a tainted canvas, or an unreadable
 * context all fail closed and keep the decal as an occluder.
 */
function isTransparentLabelTexel(
  hit: Intersection<Mesh>,
  material: Material,
): boolean {
  if (
    hit.object.name !== WHEEL_LABEL_DECAL_NAME ||
    !(material instanceof MeshBasicMaterial) ||
    !material.transparent ||
    !(material.map instanceof CanvasTexture) ||
    hit.uv === undefined ||
    typeof HTMLCanvasElement === "undefined" ||
    !(material.map.image instanceof HTMLCanvasElement)
  ) {
    return false;
  }

  const canvas = material.map.image;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) return false;
  const uv = material.map.transformUv(hit.uv.clone());
  const x = Math.min(canvas.width - 1, Math.max(0, Math.floor(uv.x * canvas.width)));
  const y = Math.min(
    canvas.height - 1,
    Math.max(0, Math.floor(uv.y * canvas.height)),
  );
  try {
    const alpha = context.getImageData(x, y, 1, 1).data[3];
    return alpha === 0 || material.opacity === 0;
  } catch {
    // A generated same-origin canvas should be readable. If that invariant ever
    // changes, rejecting calibration is safer than approving a hidden surface.
    return false;
  }
}

/**
 * Identifies the first intersection that can contribute to the rendered pixel.
 *
 * `Raycaster.intersectObjects()` is distance sorted in Three 0.185. The order is
 * consumed as-is: searching later hits would allow a hidden expected mesh to
 * validate a pixel produced by a nearer shell, glass sheet, surround, or decal.
 */
export function firstVisibleProbeHit(
  intersections: ReadonlyArray<Intersection<Object3D>>,
): ProbeHitIdentity | null {
  for (const intersection of intersections) {
    if (!isVisibleInScene(intersection.object)) continue;
    if (!(intersection.object instanceof Mesh)) {
      return {
        objectName: intersection.object.name || undefined,
        materialNames: [],
      };
    }

    const hit: Intersection<Mesh> = {
      ...intersection,
      object: intersection.object,
    };
    const material = hitMaterial(hit);
    if (material === null) {
      return {
        objectName: hit.object.name || undefined,
        materialNames: [],
      };
    }
    if (!material.visible) continue;
    if (material.transparent && material.opacity === 0) continue;
    if (isTransparentLabelTexel(hit, material)) continue;
    return {
      objectName: hit.object.name || undefined,
      materialNames: [material.name || undefined],
    };
  }
  return null;
}
