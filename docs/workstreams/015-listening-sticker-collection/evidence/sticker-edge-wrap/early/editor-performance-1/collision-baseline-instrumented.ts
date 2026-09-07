export const collisionProfile={calls:0,nodeVisits:0,triangleTests:0,fallbacks:0,edgeChecks:0,winningHits:0};
import { Box3, Matrix4, Ray, Triangle, Vector3, type BufferGeometry } from '/Users/vinicius/code/webPod/packages/device/node_modules/three/build/three.module.js';

export interface StickerCollisionFace {
  readonly geometry: BufferGeometry;
  /** Transform into the same content coordinates used by sticker vertices. */
  readonly transform?: Matrix4;
  readonly source: string;
  readonly kind: 'surface' | 'bridge';
  /** Explicitly partitioned exterior only; never inferred from triangle proximity. */
  readonly adhesiveSupport?: boolean;
}
export interface StickerCollisionHit {
  readonly point: Vector3;
  readonly normal: Vector3;
  readonly distance: number;
  readonly source: string;
  readonly kind: 'surface' | 'bridge';
}
interface Node { readonly box: Box3; readonly left?: Node; readonly right?: Node; readonly triangles?: readonly number[] }
const EPSILON = 1e-7;
const LEAF_SIZE = 8;

function coplanarOverlap(a: Triangle, b: Triangle, normal: Vector3): boolean {
  const axis = Math.abs(normal.x) > Math.abs(normal.y) ? (Math.abs(normal.x) > Math.abs(normal.z) ? 'x' : 'z') : (Math.abs(normal.y) > Math.abs(normal.z) ? 'y' : 'z');
  const project = (p: Vector3): readonly [number, number] => axis === 'x' ? [p.y, p.z] : axis === 'y' ? [p.x, p.z] : [p.x, p.y];
  const aa = [a.a, a.b, a.c].map(project), bb = [b.a, b.b, b.c].map(project);
  const orient = (p: readonly number[], q: readonly number[], r: readonly number[]) => ((q[0] ?? 0) - (p[0] ?? 0)) * ((r[1] ?? 0) - (p[1] ?? 0)) - ((q[1] ?? 0) - (p[1] ?? 0)) * ((r[0] ?? 0) - (p[0] ?? 0));
  // Separating-axis test includes touching and coplanar containment.
  for (const polygon of [aa, bb]) for (let i = 0; i < 3; i++) {
    const p = polygon[i], q = polygon[(i + 1) % 3]; if (!p || !q) continue;
    const first = aa.map(v => orient(p, q, v)), second = bb.map(v => orient(p, q, v));
    if (Math.max(...first) < Math.min(...second) - EPSILON || Math.max(...second) < Math.min(...first) - EPSILON) return false;
  }
  return true;
}

/** Actual triangle contacts, not an exterior/inside classifier or a closest adhesive-support oracle.
 * A ray through an unbridged opening can first hit hidden hardware: provenance is preserved.
 * Final triangle tests also require an exterior-start/sweep or containment invariant in the caller.
 */
export function createStickerCollision(faces: readonly StickerCollisionFace[]) {
  const raw: number[] = [], owners: number[] = [];
  const metadata = faces.map(face => ({ source: face.source, kind: face.kind, adhesiveSupport: face.adhesiveSupport === true }));
  const vertex = new Vector3();
  for (const [owner, face] of faces.entries()) {
    const position = face.geometry.getAttribute('position'), index = face.geometry.index;
    const count = index?.count ?? position.count;
    if (count % 3 !== 0) throw new Error('Sticker collider requires triangle geometry');
    for (let i = 0; i < count; i += 3) {
      for (let k = 0; k < 3; k++) {
        const j = index ? index.getX(i + k) : i + k;
        vertex.set(position.getX(j), position.getY(j), position.getZ(j));
        if (face.transform) vertex.applyMatrix4(face.transform);
        if (![vertex.x, vertex.y, vertex.z].every(Number.isFinite)) throw new Error('Nonfinite sticker collision geometry');
        raw.push(vertex.x, vertex.y, vertex.z);
      }
      owners.push(owner);
    }
  }
  let coordinates = new Float64Array(raw), provenance = new Uint32Array(owners);
  const working = new Triangle();
  const read = (id: number, target: Triangle) => {
    target.a.fromArray(coordinates, id * 9); target.b.fromArray(coordinates, id * 9 + 3); target.c.fromArray(coordinates, id * 9 + 6); return target;
  };
  let nodeCount = 0;
  const build = (ids: number[]): Node => {
    nodeCount++;
    const box = new Box3();
    for (const id of ids) { read(id, working); box.expandByPoint(working.a); box.expandByPoint(working.b); box.expandByPoint(working.c); }
    if (ids.length <= LEAF_SIZE) return { box, triangles: ids };
    const extent = box.getSize(new Vector3());
    const axis = extent.x >= extent.y && extent.x >= extent.z ? 0 : extent.y >= extent.z ? 1 : 2;
    const center = (id: number) => (coordinates[id * 9 + axis] ?? 0) + (coordinates[id * 9 + 3 + axis] ?? 0) + (coordinates[id * 9 + 6 + axis] ?? 0);
    ids.sort((a, b) => center(a) - center(b)); const half = ids.length >> 1;
    return { box, left: build(ids.slice(0, half)), right: build(ids.slice(half)) };
  };
  let root: Node | null = build(Array.from({ length: owners.length }, (_, i) => i));
  const ensure = () => { if (!root) throw new Error('Sticker collider was disposed'); return root; };
  const stats = { triangleCount: owners.length, nodeCount, typedBytes: coordinates.byteLength + provenance.byteLength };
  raw.length = 0; owners.length = 0;
  const supportStats = { queries: 0, nodes: 0, triangles: 0 };
  const closestSupport = (point: Vector3, maximumDistance: number, initialFacet = -1): (StickerCollisionHit & { readonly signedDistance: number; readonly facetIndex: number }) | null => {
      const tree = ensure();
      if (![point.x, point.y, point.z, maximumDistance].every(Number.isFinite) || maximumDistance < 0) throw new Error('Invalid support query');
      let best: (StickerCollisionHit & { readonly signedDistance: number; readonly facetIndex: number }) | null = null;
      supportStats.queries++;
      const closest = new Vector3();
      const consider = (id: number) => {
        const owner = metadata[provenance[id] ?? -1]; if (!owner?.adhesiveSupport) return;
        supportStats.triangles++;
        read(id, working).closestPointToPoint(point, closest);
        const distance = closest.distanceTo(point);
        if (distance > (best?.distance ?? maximumDistance) || (best && distance === best.distance && id >= best.facetIndex)) return;
        const normal = working.getNormal(new Vector3());
        best = { point: closest.clone(), normal, distance, signedDistance: point.clone().sub(closest).dot(normal), source: owner.source, kind: owner.kind, facetIndex: id };
      };
      if (initialFacet >= 0 && initialFacet < provenance.length) consider(initialFacet);
      const visit = (node: Node) => {
        supportStats.nodes++;
        if (node.box.distanceToPoint(point) > (best?.distance ?? maximumDistance)) return;
        for (const id of node.triangles ?? []) if (id !== initialFacet) consider(id);
        const left = node.left, right = node.right;
        if (left && right) {
          if (left.box.distanceToPoint(point) < right.box.distanceToPoint(point)) { visit(left); visit(right); } else { visit(right); visit(left); }
        } else { if (left) visit(left); if (right) visit(right); }
      };
      visit(tree); return best;
  };
  return {
    stats,
    /** Earliest transverse facet contact on a finite segment. Coplanar sliding is handled by the triangle-overlap gate. */
    castSegment(start: Vector3, end: Vector3): StickerCollisionHit | null {
      collisionProfile.calls++;
      const tree = ensure();
      if (![start, end].every(p => [p.x, p.y, p.z].every(Number.isFinite))) throw new Error('Nonfinite collision segment');
      const direction = end.clone().sub(start), length = direction.length(); if (length < EPSILON) return null;
      direction.multiplyScalar(1 / length); const ray = new Ray(start, direction), hitPoint = new Vector3(), boxPoint = new Vector3();
      let result: StickerCollisionHit | null = null;
      const visit = (node: Node) => { collisionProfile.nodeVisits++;
        if (!ray.intersectBox(node.box, boxPoint) || node.box.distanceToPoint(start) > (result?.distance ?? length) + EPSILON) return;
        for (const id of node.triangles ?? []) {
          collisionProfile.triangleTests++; read(id, working); let point = ray.intersectTriangle(working.a, working.b, working.c, false, hitPoint);
          if (!point) { collisionProfile.fallbacks++;
            // Strict barycentric signs can miss a ray aimed exactly at a shared
            // edge. Admit only roundoff-sized distance from a real edge, never
            // an arbitrary gap or a coplanar segment.
            const normal = working.getNormal(new Vector3());
            const denominator = normal.dot(direction);
            if (Math.abs(denominator) > Number.EPSILON * 128) {
              const along = normal.dot(working.a.clone().sub(start)) / denominator;
              if (along >= 0 && along <= length) {
                ray.at(along, hitPoint);
                const scale = Math.max(1, length, start.length(), working.a.length(), working.b.length(), working.c.length());
                const tolerance = Number.EPSILON * 128 * scale;
                for (const [a, b] of [[working.a, working.b], [working.b, working.c], [working.c, working.a]]) {
                  collisionProfile.edgeChecks++; if (!a || !b) continue;
                  const edge = b.clone().sub(a), squared = edge.lengthSq();
                  if (squared === 0) continue;
                  const fraction = Math.max(0, Math.min(1, hitPoint.clone().sub(a).dot(edge) / squared));
                  if (a.clone().addScaledVector(edge, fraction).distanceToSquared(hitPoint) <= tolerance * tolerance) { point = hitPoint; break; }
                }
              }
            }
          }
          if (!point) continue;
          const distance = point.distanceTo(start); if (distance > length + EPSILON || distance >= (result?.distance ?? Infinity)) continue;
          const owner = metadata[provenance[id] ?? -1]; if (!owner) throw new Error('Missing collision provenance');
          collisionProfile.winningHits++; result = { point: point.clone(), normal: working.getNormal(new Vector3()), distance, ...owner };
        }
        if (node.left) visit(node.left); if (node.right) visit(node.right);
      };
      visit(tree); return result;
    },
    /** Nearest explicitly approved support facet. Caller owns exposure/bridge classification.
     * This cannot authorize an attraction step through the solid; sweep/contact gates still apply.
     */
    closestApprovedSupport(point: Vector3, maximumDistance: number) { return closestSupport(point, maximumDistance); },
    getSupportStats() { return { ...supportStats }; },
    /** One bounded warm facet hint. Every query still proves the exact minimum via BVH lower bounds.
     * A hint is never reused across collider identity, and query disposal drops it immediately.
     */
    createSupportQuery() {
      ensure(); let facet = -1, disposed = false;
      return {
        sample(point: Vector3, maximumDistance: number) {
          if (disposed) throw new Error('Sticker support query was disposed');
          const result = closestSupport(point, maximumDistance, facet);
          facet = result?.facetIndex ?? -1; return result;
        },
        dispose() { disposed = true; facet = -1; },
      };
    },
    /** Tests complete triangle overlap, including collider edges crossing its interior.
     * Does not detect a triangle wholly contained inside a closed solid without surface overlap.
     */
    intersectsTriangle(a: Vector3, b: Vector3, c: Vector3): boolean {
      const tree = ensure(), query = new Triangle(a, b, c), queryNormal = query.getNormal(new Vector3());
      if (![a, b, c].every(p => [p.x, p.y, p.z].every(Number.isFinite)) || queryNormal.lengthSq() < .5) throw new Error('Invalid collision triangle');
      const hit = new Vector3(), ray = new Ray();
      const edgesCross = (from: Triangle, to: Triangle) => {
        const vertices = [from.a, from.b, from.c];
        for (let i = 0; i < 3; i++) {
          const first = vertices[i], second = vertices[(i + 1) % 3]; if (!first || !second) continue;
          const delta = second.clone().sub(first), length = delta.length(); if (length < EPSILON) continue;
          ray.set(first, delta.multiplyScalar(1 / length));
          if (ray.intersectTriangle(to.a, to.b, to.c, false, hit) && first.distanceTo(hit) <= length + EPSILON) return true;
        }
        return false;
      };
      const visit = (node: Node): boolean => {
        if (!node.box.intersectsTriangle(query)) return false;
        for (const id of node.triangles ?? []) {
          read(id, working);
          const coplanar = [working.a, working.b, working.c].every(p => Math.abs(p.clone().sub(a).dot(queryNormal)) < EPSILON);
          if (coplanar ? coplanarOverlap(query, working, queryNormal) : edgesCross(query, working) || edgesCross(working, query)) return true;
        }
        return (node.left ? visit(node.left) : false) || (node.right ? visit(node.right) : false);
      };
      return visit(tree);
    },
    dispose() { root = null; coordinates = new Float64Array(); provenance = new Uint32Array(); metadata.length = 0; },
  };
}
