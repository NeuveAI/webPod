import {
  type CanvasTexture,
  type Intersection,
  type Material,
  Mesh,
  type MeshBasicMaterial,
  type Object3D,
  Raycaster,
  type Texture,
  Vector3,
} from "three";

/** The one rendered overlay whose empty texels may be ignored by the probe. */
export const WHEEL_LABEL_DECAL_NAME = "wheel-label-decal";

export type ProbeHitIdentity = {
  readonly objectName: string | undefined;
  readonly materialNames: ReadonlyArray<string | undefined>;
};

export type VisibleProbeHit = ProbeHitIdentity & {
  /** World-space point contributing to the sampled pixel. */
  readonly point: Vector3;
};

export type ResolvedProbeSurface = {
  /** Exact intersection with the expected rendered mesh. */
  readonly worldPoint: Vector3;
  /** The same point in the device model's body-local frame. */
  readonly localPoint: Vector3;
};

function isVisibleInScene(object: Object3D): boolean {
  let current: Object3D | null = object;
  while (current !== null) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}

/**
 * Three's documented `is*` flags are stable across duplicated module graphs.
 * `instanceof` is not: Vite may serve `three` once to the app and once through
 * a workspace package, even though both objects implement the same runtime
 * contract. The flags are set by the constructors themselves and are the same
 * checks Three uses internally (`Box3`, `PropertyBinding`, and friends).
 */
function isThreeMesh(object: Object3D): object is Mesh {
  return "isMesh" in object && object.isMesh === true && "material" in object;
}

function isThreeMeshBasicMaterial(
  material: Material,
): material is MeshBasicMaterial {
  return (
    "isMeshBasicMaterial" in material && material.isMeshBasicMaterial === true
  );
}

function isThreeCanvasTexture(
  texture: Texture | null,
): texture is CanvasTexture {
  return (
    texture !== null &&
    "isCanvasTexture" in texture &&
    texture.isCanvasTexture === true
  );
}

function hitMaterial(hit: Intersection<Mesh>): Material | null {
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
    !isThreeMeshBasicMaterial(material) ||
    !material.transparent ||
    !isThreeCanvasTexture(material.map) ||
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
  const x = Math.min(
    canvas.width - 1,
    Math.max(0, Math.floor(uv.x * canvas.width)),
  );
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
): VisibleProbeHit | null {
  for (const intersection of intersections) {
    if (!isVisibleInScene(intersection.object)) continue;
    if (!isThreeMesh(intersection.object)) {
      return {
        objectName: intersection.object.name || undefined,
        materialNames: [],
        point: intersection.point.clone(),
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
        point: hit.point.clone(),
      };
    }
    if (!material.visible) continue;
    if (material.transparent && material.opacity === 0) continue;
    if (isTransparentLabelTexel(hit, material)) continue;
    return {
      objectName: hit.object.name || undefined,
      materialNames: [material.name || undefined],
      point: hit.point.clone(),
    };
  }
  return null;
}

function hitMatchesIdentity(
  hit: Intersection<Object3D>,
  target: ProbeHitIdentity,
): boolean {
  if (!isThreeMesh(hit.object)) return false;
  const narrowed: Intersection<Mesh> = { ...hit, object: hit.object };
  const material = hitMaterial(narrowed);
  return (
    hit.object.name === target.objectName &&
    material?.name === target.materialNames[0]
  );
}

/**
 * Intersects the expected mesh along the device-local z axis.
 *
 * This is a surface solve, not the visibility admission pass: it may select
 * the named surface from model-only hits because the camera ray is checked
 * separately by {@link firstVisibleProbeHit}. Its purpose is to project the
 * geometry Three actually renders instead of a nominal z equation.
 */
export function resolveProbeSurface(
  model: Object3D,
  target: ProbeHitIdentity,
  x: number,
  y: number,
  face: "front" | "back",
  castDistance: number,
): ResolvedProbeSurface {
  if (!(castDistance > 0) || !Number.isFinite(castDistance)) {
    throw new Error(`probe cast distance must be positive; got ${castDistance}`);
  }
  model.updateWorldMatrix(true, true);
  const origin = new Vector3(
    x,
    y,
    face === "front" ? castDistance : -castDistance,
  );
  model.localToWorld(origin);
  const direction = new Vector3(0, 0, face === "front" ? -1 : 1)
    .transformDirection(model.matrixWorld)
    .normalize();
  const raycaster = new Raycaster(origin, direction, 0, castDistance * 2);
  const intersection = raycaster
    .intersectObject(model, true)
    .find((hit) => hitMatchesIdentity(hit, target));
  if (intersection === undefined) {
    throw new Error(
      `probe surface missed ${target.objectName}/${target.materialNames[0] ?? ""} at (${x}, ${y})`,
    );
  }
  const worldPoint = intersection.point.clone();
  const localPoint = model.worldToLocal(worldPoint.clone());
  if (
    Math.abs(localPoint.x - x) > 1e-4 ||
    Math.abs(localPoint.y - y) > 1e-4
  ) {
    throw new Error(
      `probe surface drifted off its local cast: wanted (${x}, ${y}), got (${localPoint.x}, ${localPoint.y})`,
    );
  }
  return { worldPoint, localPoint };
}

/**
 * Checks x/y/z coherence between the solved mesh point and the pixel-centre
 * camera hit. The solved point supplies the actual intended z; no nominal
 * surface equation participates.
 */
export function probeSurfaceIsCoherent(
  intendedX: number,
  intendedY: number,
  solvedLocal: Vector3,
  visibleLocal: Vector3,
  pixelDrift: number,
): boolean {
  return (
    Math.abs(solvedLocal.x - intendedX) <= 1e-4 &&
    Math.abs(solvedLocal.y - intendedY) <= 1e-4 &&
    Math.abs(visibleLocal.x - intendedX) <= pixelDrift &&
    Math.abs(visibleLocal.y - intendedY) <= pixelDrift &&
    Math.abs(visibleLocal.z - solvedLocal.z) <= pixelDrift
  );
}
