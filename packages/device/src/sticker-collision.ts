import type {PackedCollisionTree} from './packed-collision-tree';
import {collisionSteps} from './sticker-collision-cooperative';
import {drainSteps} from './sticker-computation-steps';
import { Box3, type Matrix4, Ray, Triangle, Vector3, type BufferGeometry } from 'three';

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
export interface StickerCollisionSnapshot {
  readonly coordinates: Float64Array;
  readonly provenance: Uint32Array;
  readonly metadata: { source: string; kind: 'surface' | 'bridge'; adhesiveSupport: boolean }[];
  readonly root: PackedCollisionTree;
  readonly nodeCount: number;
}
const EPSILON = 1e-7;

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
export function createStickerCollision(faces: readonly StickerCollisionFace[], prepared?: StickerCollisionSnapshot) {
  let snapshot:StickerCollisionSnapshot|null=prepared??drainSteps(collisionSteps(faces));
  let {coordinates,provenance,metadata}=snapshot;
  let root:PackedCollisionTree|null=snapshot.root;
  const box=new Box3();
  const nodeBox=(node:number):Box3=>{if(!root)throw Error('Sticker collider was disposed');box.min.fromArray(root.bounds,node*6);box.max.fromArray(root.bounds,node*6+3);return box;};
  const working = new Triangle();
  // Calls are synchronous and invoke no external callbacks. Returned hits own
  // their vectors; this bounded scratch never escapes the collider.
  const segmentRay = new Ray(), segmentDirection = new Vector3(), segmentHitPoint = new Vector3(), segmentBoxPoint = new Vector3(), segmentNormal = new Vector3(), segmentBestPoint = new Vector3(), segmentStack: number[] = [];

  const read = (id: number, target: Triangle) => {
    target.a.fromArray(coordinates, id * 9); target.b.fromArray(coordinates, id * 9 + 3); target.c.fromArray(coordinates, id * 9 + 6); return target;
  };
  const ensure=()=>{if(!root)throw Error('Sticker collider was disposed');return root;};
  const stats={triangleCount:provenance.length,nodeCount:snapshot.nodeCount,typedBytes:coordinates.byteLength+provenance.byteLength+root.bounds.byteLength+root.links.byteLength+root.triangles.byteLength};
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
      const visit = (node: number) => {
        supportStats.nodes++;
        if (nodeBox(node).distanceToPoint(point) > (best?.distance ?? maximumDistance)) return;
        for(let cursor=tree.links[node*4+2]??0,end=cursor+(tree.links[node*4+3]??0);cursor<end;cursor++){const id=tree.triangles[cursor]??0;if(id!==initialFacet)consider(id);}
        const left=(tree.links[node*4]??0)-1,right=(tree.links[node*4+1]??0)-1;
        if (left>=0 && right>=0) {
          if (nodeBox(left).distanceToPoint(point) < nodeBox(right).distanceToPoint(point)) { visit(left); visit(right); } else { visit(right); visit(left); }
        } else { if (left>=0) visit(left); if (right>=0) visit(right); }
      };
      visit(0); return best;
  };
  return {
    stats,
    /** Immutable borrowed snapshot; transfer only buffers held by an explicitly private worker owner. */
    snapshot(): StickerCollisionSnapshot {
      ensure();if(!snapshot)throw Error('Sticker collider was disposed');return snapshot;
    },
    /** Earliest transverse facet contact on a finite segment. Coplanar sliding is handled by the triangle-overlap gate. */
    castSegment(start: Vector3, end: Vector3): StickerCollisionHit | null {
      const tree = ensure();
      if (!Number.isFinite(start.x) || !Number.isFinite(start.y) || !Number.isFinite(start.z) || !Number.isFinite(end.x) || !Number.isFinite(end.y) || !Number.isFinite(end.z)) throw new Error('Nonfinite collision segment');
      segmentDirection.copy(end).sub(start); const length = segmentDirection.length(); if (length < EPSILON) return null;
      segmentDirection.multiplyScalar(1 / length); segmentRay.set(start, segmentDirection);
      const startLength = start.length(); let bestDistance = Infinity, bestId = -1;
      segmentStack.length = 0; segmentStack.push(0);
      while (segmentStack.length) {
        const node = segmentStack.pop(); if (node===undefined) break;
        if (!segmentRay.intersectBox(nodeBox(node), segmentBoxPoint)) continue;
        const limit = Math.min(bestDistance, length) + EPSILON;
        // For an outside origin, intersectBox returns the entry point. Its ray
        // distance is a tighter bound than the nearest Euclidean box distance.
        // An inside origin must retain the node even when its exit is beyond end.
        if (!box.containsPoint(start) && segmentBoxPoint.distanceToSquared(start) > limit * limit) continue;
        for(let cursor=tree.links[node*4+2]??0,end=cursor+(tree.links[node*4+3]??0);cursor<end;cursor++){
          const id=tree.triangles[cursor]??0;
          read(id, working); let point = segmentRay.intersectTriangle(working.a, working.b, working.c, false, segmentHitPoint);
          if (!point) {
            // Preserve the exact shared-edge roundoff fallback without allocating
            // vectors and arrays for ordinary triangle misses in every ray.
            const normal = working.getNormal(segmentNormal), denominator = normal.dot(segmentDirection);
            if (Math.abs(denominator) > Number.EPSILON * 128) {
              const along = (normal.x * (working.a.x - start.x) + normal.y * (working.a.y - start.y) + normal.z * (working.a.z - start.z)) / denominator;
              if (along >= 0 && along <= length) {
                segmentRay.at(along, segmentHitPoint);
                const scale = Math.max(1, length, startLength, working.a.length(), working.b.length(), working.c.length());
                const tolerance = Number.EPSILON * 128 * scale;
                for (let edgeIndex = 0; edgeIndex < 3; edgeIndex++) {
                  const a = edgeIndex === 0 ? working.a : edgeIndex === 1 ? working.b : working.c;
                  const b = edgeIndex === 0 ? working.b : edgeIndex === 1 ? working.c : working.a;
                  const ex = b.x - a.x, ey = b.y - a.y, ez = b.z - a.z, squared = ex * ex + ey * ey + ez * ez;
                  if (squared === 0) continue;
                  const fraction = Math.max(0, Math.min(1, ((segmentHitPoint.x - a.x) * ex + (segmentHitPoint.y - a.y) * ey + (segmentHitPoint.z - a.z) * ez) / squared));
                  const dx = a.x + ex * fraction - segmentHitPoint.x, dy = a.y + ey * fraction - segmentHitPoint.y, dz = a.z + ez * fraction - segmentHitPoint.z;
                  if (dx * dx + dy * dy + dz * dz <= tolerance * tolerance) { point = segmentHitPoint; break; }
                }
              }
            }
          }
          if (!point) continue;
          const distance = point.distanceTo(start); if (distance > length + EPSILON || distance >= bestDistance) continue;
          bestDistance = distance; bestId = id; segmentBestPoint.copy(point);
        }
        // Match the old left-then-right traversal and tie behavior.
        const right=(tree.links[node*4+1]??0)-1,left=(tree.links[node*4]??0)-1;
        if(right>=0)segmentStack.push(right);if(left>=0)segmentStack.push(left);
      }
      if (bestId < 0) return null;
      const owner = metadata[provenance[bestId] ?? -1]; if (!owner) throw new Error('Missing collision provenance');
      read(bestId, working);
      return { point: segmentBestPoint.clone(), normal: working.getNormal(new Vector3()), distance: bestDistance, ...owner };
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
      const visit = (node: number): boolean => {
        if (!nodeBox(node).intersectsTriangle(query)) return false;
        for(let cursor=tree.links[node*4+2]??0,end=cursor+(tree.links[node*4+3]??0);cursor<end;cursor++){
          const id=tree.triangles[cursor]??0;
          read(id, working);
          const coplanar = [working.a, working.b, working.c].every(p => Math.abs(p.clone().sub(a).dot(queryNormal)) < EPSILON);
          if (coplanar ? coplanarOverlap(query, working, queryNormal) : edgesCross(query, working) || edgesCross(working, query)) return true;
        }
        const left=(tree.links[node*4]??0)-1,right=(tree.links[node*4+1]??0)-1;
        return (left>=0&&visit(left))||(right>=0&&visit(right));
      };
      return visit(0);
    },
    dispose() { segmentStack.length = 0; root = null; snapshot = null; coordinates = new Float64Array(); provenance = new Uint32Array(); metadata = []; },
  };
}
