import { Box3, BufferAttribute, BufferGeometry, Matrix4, Mesh, Ray, Sphere, Vector3, type Intersection, type Raycaster } from 'three';
import { prepareShellPickingIndex } from './shell-picking-preparation';
import type { ShellPickingIndex } from './shell-picking-index';

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
  const stack: number[] = [], found: Intersection[] = [];
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
      stack.length = 0; found.length = 0; stack.push(0);
      while (stack.length) {
        const node = stack.pop(); if (node===undefined) continue;
        box.min.fromArray(root.bounds,node*6); box.max.fromArray(root.bounds,node*6+3);
        if (!ray.intersectBox(box, point)) continue;
        const count=root.links[node*4+3]??0;
        if (count > 0) {
          geometry.setDrawRange((root.links[node*4+2]??0)*3,count*3);
          Mesh.prototype.raycast.call(proxy, raycaster, found);
        }
        const right=(root.links[node*4+1]??0)-1,left=(root.links[node*4]??0)-1;
        if(right>=0)stack.push(right);if(left>=0)stack.push(left);
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

interface SharedIndex {
 readonly position:ReturnType<BufferGeometry['getAttribute']>;readonly originalIndex:BufferGeometry['index'];
 readonly positionVersion:number;readonly indexVersion:number|undefined;
 readonly controller:AbortController;readonly promise:Promise<ShellPickingIndex>;owners:number;
}
const sharedIndices=new WeakMap<BufferGeometry,SharedIndex>();
/** Each immutable geometry/version has one private preparation and shared packed
 * result. Independent mesh owners retain their own query scratch/proxy, while
 * transfer copies and BVH construction are coalesced until the last owner leaves. */
function retainShellIndex(source:BufferGeometry):{promise:Promise<ShellPickingIndex>;release:()=>void} {
 const position=source.getAttribute('position'),originalIndex=source.index;
 let entry=sharedIndices.get(source);
 if(entry&&(entry.position!==position||entry.originalIndex!==originalIndex||entry.positionVersion!==version(position)||entry.indexVersion!==originalIndex?.version)){entry.controller.abort();sharedIndices.delete(source);entry=undefined;}
 if(!entry){
  const controller=new AbortController();let positions:Float32Array;
  if(position instanceof BufferAttribute&&position.itemSize===3&&position.array instanceof Float32Array)positions=position.array.slice();
  else{positions=new Float32Array(position.count*3);for(let i=0;i<position.count;i++){positions[i*3]=position.getX(i);positions[i*3+1]=position.getY(i);positions[i*3+2]=position.getZ(i);}}
  const indices=originalIndex?Uint32Array.from(originalIndex.array):null;
  entry={position,originalIndex,positionVersion:version(position),indexVersion:originalIndex?.version,controller,promise:prepareShellPickingIndex({positions,indices},controller.signal),owners:0};
  sharedIndices.set(source,entry);
 }
 entry.owners++;const owned=entry;let released=false;
 return {promise:owned.promise,release:()=>{if(released)return;released=true;if(--owned.owners===0){owned.controller.abort();if(sharedIndices.get(source)===owned)sharedIndices.delete(source);}}};
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
      const position = source.getAttribute('position'), originalIndex = source.index;
      const positionVersion = version(position), indexVersion = originalIndex?.version;
      let release=()=>{};
      if (!position.normalized && position.array instanceof Float32Array) {
        const shared=retainShellIndex(source);release=shared.release;
        void shared.promise.then((index) => {
          if (generation !== ownGeneration || source.getAttribute('position') !== position || version(position) !== positionVersion || source.index !== originalIndex || originalIndex?.version !== indexVersion) return;
          prepared = createIndexedShellRaycast(source, index);
        }).catch(() => { /* Exact source raycast remains available on failure. */ });
      }
      const stop = release;
      cancelPreparation = stop;
      return () => { if (generation === ownGeneration) { generation++; prepared?.dispose(); prepared = null; } stop(); };
    },
    raycast(this: Mesh, raycaster: Raycaster, hits: Intersection[]): void {
      if (prepared?.current()) prepared.raycast.call(this, raycaster, hits);
      else Mesh.prototype.raycast.call(this, raycaster, hits);
    },
  };
}
