import { Box3, BufferAttribute, BufferGeometry, Matrix4, Mesh, Ray, Sphere, Vector3, type Intersection, type Raycaster } from 'three';
import { prepareShellPickingIndex } from './shell-picking-preparation';
import type { ShellPickingIndex, ShellPickingNode } from './shell-picking-index';

const version = (attribute: ReturnType<BufferGeometry['getAttribute']>) => 'version' in attribute ? attribute.version : attribute.data.version;

/** Install only on an immutable, single-material shell. Unsupported morph/group
 * material/draw-range cases retain exact Three behavior. The worker-derived BVH
 * selects leaves; Three itself still constructs UVs, normals, side tests and hits.
 * Disposal releases only private CPU picking geometry, never borrowed attributes. */
export function createIndexedShellRaycast(source: BufferGeometry, index: ShellPickingIndex) {
  const position = source.getAttribute('position'), originalIndex = source.index;
  const positionVersion = version(position), indexVersion = originalIndex?.version;
  const geometry = new BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute);
  geometry.setIndex(new BufferAttribute(index.indices, 1));
  const root = index.root;
  geometry.boundingBox = new Box3(new Vector3().fromArray(root.bounds), new Vector3().fromArray(root.bounds, 3));
  geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new Sphere());
  const proxy = new Mesh(geometry), inverse = new Matrix4(), ray = new Ray(), point = new Vector3();
  if (!Array.isArray(proxy.material)) proxy.material.dispose(); // The non-rendered proxy borrows the live shell material below.
  const box = new Box3();
  const stack: ShellPickingNode[] = [], found: Intersection[] = [];
  let disposed = false;
  const current = () => !disposed && source.getAttribute('position') === position && version(position) === positionVersion && source.index === originalIndex && originalIndex?.version === indexVersion;
  return {
    current,
    raycast(this: Mesh, raycaster: Raycaster, hits: Intersection[]): void {
      if (!current() || this.geometry !== source || position.normalized || !(position.array instanceof Float32Array) || Array.isArray(this.material) || source.drawRange.start !== 0 || source.drawRange.count < (originalIndex?.count ?? position.count) || Object.keys(source.morphAttributes).length !== 0) {
        Mesh.prototype.raycast.call(this, raycaster, hits); return;
      }
      // Non-position attributes are borrowed live and can be replaced independently.
      for (const name of Object.keys(geometry.attributes)) if (source.getAttribute(name) === undefined) geometry.deleteAttribute(name);
      for (const [name, attribute] of Object.entries(source.attributes)) if (geometry.getAttribute(name) !== attribute) geometry.setAttribute(name, attribute);
      proxy.material = this.material; proxy.matrixWorld.copy(this.matrixWorld);
      inverse.copy(this.matrixWorld).invert(); ray.copy(raycaster.ray).applyMatrix4(inverse);
      stack.length = 0; found.length = 0; stack.push(root);
      while (stack.length) {
        const node = stack.pop(); if (!node) continue;
        box.min.fromArray(node.bounds); box.max.fromArray(node.bounds, 3);
        if (!ray.intersectBox(box, point)) continue;
        if (node.count > 0) {
          geometry.setDrawRange(node.start, node.count);
          Mesh.prototype.raycast.call(proxy, raycaster, found);
        }
        if (node.right) stack.push(node.right); if (node.left) stack.push(node.left);
      }
      for (const hit of found) {
        if (hit.faceIndex !== undefined && hit.faceIndex !== null) hit.faceIndex = index.faces[hit.faceIndex];
        hit.object = this;
      }
      // Preserve Three's original triangle iteration order, including distance ties.
      found.sort((a, b) => (a.faceIndex ?? 0) - (b.faceIndex ?? 0));
      hits.push(...found); found.length = 0;
    },
    dispose() { disposed = true; stack.length = 0; found.length = 0; geometry.dispose(); },
  };
}

/** Matching immutable preparation replaces the exact fallback. All shell owners
 * share one bounded preparation worker through prepareShellPickingIndex. */
export function createShellPicking() {
  let prepared: ReturnType<typeof createIndexedShellRaycast> | null = null;
  let generation = 0;
  let cancelPreparation: (() => void) | undefined;
  return {
    prepare(source: BufferGeometry): () => void {
      cancelPreparation?.();
      const ownGeneration = ++generation;
      prepared?.dispose(); prepared = null;
      const controller = new AbortController();
      const position = source.getAttribute('position'), originalIndex = source.index;
      const positionVersion = version(position), indexVersion = originalIndex?.version;
      if (!position.normalized && position.array instanceof Float32Array) {
        const positions = new Float32Array(position.count * 3);
        for (let i = 0; i < position.count; i++) { positions[i * 3] = position.getX(i); positions[i * 3 + 1] = position.getY(i); positions[i * 3 + 2] = position.getZ(i); }
        const indices = originalIndex ? Uint32Array.from(originalIndex.array) : null;
        void prepareShellPickingIndex({ positions, indices }, controller.signal).then((index) => {
          if (controller.signal.aborted || generation !== ownGeneration || source.getAttribute('position') !== position || version(position) !== positionVersion || source.index !== originalIndex || originalIndex?.version !== indexVersion) return;
          prepared = createIndexedShellRaycast(source, index);
        }).catch(() => { /* Exact source raycast remains available on failure. */ });
      }
      const stop = () => controller.abort();
      cancelPreparation = stop;
      return () => { if (generation === ownGeneration) { generation++; prepared?.dispose(); prepared = null; } stop(); };
    },
    raycast(this: Mesh, raycaster: Raycaster, hits: Intersection[]): void {
      if (prepared?.current()) prepared.raycast.call(this, raycaster, hits);
      else Mesh.prototype.raycast.call(this, raycaster, hits);
    },
  };
}
