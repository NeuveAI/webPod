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

/** Local face a probe ray is cast through. */
export type ProbeFace = "front" | "back" | "left" | "right";

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

function visibleProbeHitFromIntersection(
  intersection: Intersection<Object3D>,
): VisibleProbeHit | null {
  if (!isVisibleInScene(intersection.object)) return null;
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
  if (!material.visible) return null;
  if (material.transparent && material.opacity === 0) return null;
  if (isTransparentLabelTexel(hit, material)) return null;
  return {
    objectName: hit.object.name || undefined,
    materialNames: [material.name || undefined],
    point: hit.point.clone(),
  };
}

function isDuplicateVisibleHit(
  current: VisibleProbeHit,
  previous: VisibleProbeHit | undefined,
): boolean {
  return (
    previous !== undefined &&
    previous.objectName === current.objectName &&
    previous.materialNames[0] === current.materialNames[0] &&
    previous.point.distanceToSquared(current.point) <= 1e-12
  );
}

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
 * Visible hit stack in the same distance order Three reports.
 *
 * Consecutive duplicate hits from the same named surface collapse into one
 * entry so a double-sided plane or triangle pair cannot hide the material that
 * sits directly behind it.
 */
export function visibleProbeHits(
  intersections: ReadonlyArray<Intersection<Object3D>>,
): Array<VisibleProbeHit> {
  const hits: Array<VisibleProbeHit> = [];
  for (const intersection of intersections) {
    const hit = visibleProbeHitFromIntersection(intersection);
    if (hit === null || isDuplicateVisibleHit(hit, hits.at(-1))) continue;
    hits.push(hit);
  }
  return hits;
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
  return visibleProbeHits(intersections)[0] ?? null;
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
  lateral: number,
  y: number,
  face: ProbeFace,
  castDistance: number,
): ResolvedProbeSurface {
  if (!(castDistance > 0) || !Number.isFinite(castDistance)) {
    throw new Error(`probe cast distance must be positive; got ${castDistance}`);
  }
  model.updateWorldMatrix(true, true);
  const origin = new Vector3(
    face === "right" ? castDistance : face === "left" ? -castDistance : lateral,
    y,
    face === "front" ? castDistance : face === "back" ? -castDistance : lateral,
  );
  model.localToWorld(origin);
  const direction = new Vector3(
    face === "right" ? -1 : face === "left" ? 1 : 0,
    0,
    face === "front" ? -1 : face === "back" ? 1 : 0,
  )
    .transformDirection(model.matrixWorld)
    .normalize();
  const raycaster = new Raycaster(origin, direction, 0, castDistance * 2);
  const intersection = raycaster
    .intersectObject(model, true)
    .find((hit) => hitMatchesIdentity(hit, target));
  if (intersection === undefined) {
    throw new Error(
      `probe surface missed ${target.objectName}/${target.materialNames[0] ?? ""} at (${lateral}, ${y}) on ${face}`,
    );
  }
  const worldPoint = intersection.point.clone();
  const localPoint = model.worldToLocal(worldPoint.clone());
  const solvedLateral =
    face === "front" || face === "back" ? localPoint.x : localPoint.z;
  if (
    Math.abs(solvedLateral - lateral) > 1e-4 ||
    Math.abs(localPoint.y - y) > 1e-4
  ) {
    throw new Error(
      `probe surface drifted off its local cast: wanted (${lateral}, ${y}) on ${face}, got (${solvedLateral}, ${localPoint.y})`,
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
  intendedLateral: number,
  intendedY: number,
  face: ProbeFace,
  solvedLocal: Vector3,
  visibleLocal: Vector3,
  pixelDrift: number,
): boolean {
  const lateralAxis = face === "front" || face === "back" ? "x" : "z";
  const depthAxis = face === "front" || face === "back" ? "z" : "x";
  return (
    Math.abs(solvedLocal[lateralAxis] - intendedLateral) <= 1e-4 &&
    Math.abs(solvedLocal.y - intendedY) <= 1e-4 &&
    Math.abs(visibleLocal[lateralAxis] - intendedLateral) <= pixelDrift &&
    Math.abs(visibleLocal.y - intendedY) <= pixelDrift &&
    Math.abs(visibleLocal[depthAxis] - solvedLocal[depthAxis]) <= pixelDrift
  );
}
