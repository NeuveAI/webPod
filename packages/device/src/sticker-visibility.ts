import {stickerAssemblyRevision} from './sticker-assembly-revision';
import { prepareCollisionInWorker } from './sticker-collision-preparation';
import { Matrix4, Mesh, Vector3, type Camera, type Object3D } from 'three';
import { createStickerCollision, type StickerCollisionFace } from './sticker-collision';

/** One synchronous query shares its camera/content transform across all samples.
 * A subsequent query refreshes both transforms and the actual assembly identity.
 */
export function stickerVisibilityQuery(visibility: ReturnType<typeof createStickerVisibility>, content: Object3D, camera: Camera): (world: Vector3) => boolean {
  visibility.update(content);
  const inverse = content.matrixWorld.clone().invert();
  const cameraPoint = camera.getWorldPosition(new Vector3()).applyMatrix4(inverse), localPoint = new Vector3();
  return world => visibility.visible(cameraPoint, localPoint.copy(world).applyMatrix4(inverse));
}

/** One bounded collider for the actual visible assembly. Sticker surfaces are
 * tested separately; geometry, local transforms and visibility form its identity.
 * All meshes are borrowed. Only copied collision arrays/BVH belong to this cache.
 */
export function createStickerVisibility(options: { readonly workerOnly?: boolean } = {}) {
  let key = '', collider: ReturnType<typeof createStickerCollision> | null = null;
  let disposed = false, revision = 0;
  const identities = new WeakMap<object, number>(); let nextIdentity = 0;
  const identity = (value: object) => { const saved = identities.get(value); if (saved !== undefined) return saved; const id = ++nextIdentity; identities.set(value, id); return id; };
  let pending: { key: string; controller: AbortController; promise: Promise<void> } | null = null;
  let ready = false, epoch = 0, failedKey: string | null = null, failedAt = 0;
  const listeners = new Set<() => void>();
  const publish = () => { epoch++; for (const listener of listeners) listener(); };
  let assemblyRevision = 0, signature: number[] = [], scratch: number[] = [];
  let cachedFaces: StickerCollisionFace[] = [];
  let inspectedContent:Object3D|null=null,authority:ReturnType<typeof stickerAssemblyRevision>,authorityRevision=-1;
  const inspectionStats={walks:0,cacheHits:0};
  const transform = new Matrix4();
  const inspect = (content: Object3D) => {
      const nextAuthority=stickerAssemblyRevision(content);
      if(nextAuthority&&inspectedContent===content&&nextAuthority===authority&&nextAuthority.revision===authorityRevision){
        content.updateWorldMatrix(true,false);inspectionStats.cacheHits++;return {faces:cachedFaces,nextKey:String(assemblyRevision)};
      }
      inspectedContent=content;authority=nextAuthority;authorityRevision=nextAuthority?.revision??-1;inspectionStats.walks++;
      content.updateWorldMatrix(true, true);
      scratch.length = 0;
      const meshes: Mesh[] = [];
      content.traverse(object => {
        if (!(object instanceof Mesh) || object.name.startsWith('sticker-')) return;
        for (let parent: Object3D | null = object; parent; parent = parent.parent) {
          if (!parent.visible || parent.name === 'device-equipped-stickers') return;
          if (parent === content) break;
        }
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        if (!materials.some(material => material.visible && material.opacity > 0)) return;
        // Compose authored local ancestors. Cancelling two world matrices adds
        // roundoff under camera/device motion and would rebuild an unchanged BVH.
        transform.identity();
        for (let node: Object3D | null = object; node && node !== content; node = node.parent) transform.premultiply(node.matrix);
        const position = object.geometry.getAttribute('position'), index = object.geometry.index;
        const version = 'version' in position ? position.version : position.data.version;
        const backing = 'data' in position ? identity(position.data) : identity(position.array);
        scratch.push(identity(object), identity(object.geometry), identity(position), backing, position.count, version, index ? identity(index) : -1, index ? identity(index.array) : -1, index?.count ?? 0, index?.version ?? 0, ...transform.elements, materials.length);
        for (const material of materials) scratch.push(Number(material.visible), material.opacity);
        meshes.push(object);
      });
    if (scratch.length !== signature.length || scratch.some((value, index) => value !== signature[index])) {
      [signature, scratch] = [scratch, signature]; assemblyRevision++;
      cachedFaces = meshes.map(object => {
        const local = new Matrix4();
        for (let node: Object3D | null = object; node && node !== content; node = node.parent) local.premultiply(node.matrix);
        return { geometry: object.geometry, transform: local, source: object.name || object.uuid, kind: 'surface' };
      });
    }
    return { faces: cachedFaces, nextKey: String(assemblyRevision) };
  };
  return {
    get revision(): number { return revision; },
    getInspectionStats(){return {...inspectionStats};},
    /** False during cold/changed preparation; callers retain their last safe pose. */
    get ready(): boolean { return ready; },
    /** Borrow immutable prepared data. Consumers may borrow for read-only queries or structured-clone once across a worker boundary; never transfer these buffers. */
    snapshot() { if (!ready || !collider) throw new Error('Sticker visibility is not prepared'); return collider.snapshot(); },
    getSnapshot: () => epoch,
    subscribe(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; },
    /** Build once while the front is shown; pose changes do not alter local collision geometry. */
    prepare(content: Object3D): Promise<void> {
      if (disposed) return Promise.resolve();
      const { faces, nextKey } = inspect(content);
      if (nextKey === key && collider !== null) { ready = true; return Promise.resolve(); }
      if (pending?.key === nextKey) return pending.promise;
      if (failedKey === nextKey && performance.now() - failedAt < 1_000) return Promise.resolve();
      pending?.controller.abort();
      ready = false;
      const controller = new AbortController();
      const promise = prepareCollisionInWorker(faces, controller.signal).then(snapshot => {
        if (disposed || controller.signal.aborted) return;
        // Only install the snapshot for the exact assembly that was copied.
        if (inspect(content).nextKey !== nextKey) return;
        const next = createStickerCollision([], snapshot);
        collider?.dispose(); collider = next; key = nextKey; revision++; ready = true; failedKey = null;
      }).catch(() => { if (!controller.signal.aborted) { failedKey = nextKey; failedAt = performance.now(); } }).finally(() => {
        if (pending?.controller === controller) { pending = null; if (!disposed) publish(); }
      });
      pending = { key: nextKey, controller, promise };
      return promise;
    },
    update(content: Object3D): void {
      if (disposed) throw new Error('Sticker visibility was disposed');
      const { faces, nextKey } = inspect(content);
      if (nextKey === key && collider !== null) { ready = true; return; }
      if (options.workerOnly) { ready = false; void this.prepare(content); return; }
      pending?.controller.abort(); pending = null;
      const next = createStickerCollision(faces);
      collider?.dispose(); collider = next; key = nextKey; revision++; ready = true;
    },
    visible(camera: Vector3, point: Vector3): boolean {
      if (disposed || collider === null || !ready) return false;
      const hit = collider.castSegment(camera, point);
      // Segment endpoints are the actual raised print, not the underlying shell.
      // Only roundoff at an exact endpoint is tolerated, never the film thickness.
      return hit === null || hit.distance >= camera.distanceTo(point) - 1e-5;
    },
    /** Borrow the same assembly BVH for a bounded material contact sweep. */
    castSegment(start: Vector3, end: Vector3) {
      if (disposed || collider === null || !ready) throw new Error('Sticker visibility is not prepared');
      return collider.castSegment(start, end);
    },
    dispose(): void { if (disposed) return; disposed = true; ready = false; pending?.controller.abort(); pending = null; collider?.dispose(); collider = null; key = ''; cachedFaces = []; inspectedContent=null;authority=undefined;signature = []; scratch = []; listeners.clear(); },
  };
}
