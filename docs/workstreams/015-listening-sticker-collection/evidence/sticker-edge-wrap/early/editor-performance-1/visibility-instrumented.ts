import { Matrix4, Mesh, Vector3, type Camera, type Object3D } from '/Users/vinicius/code/webPod/packages/device/node_modules/three/build/three.module.js';
import { createStickerCollision, type StickerCollisionFace } from './collision-baseline-instrumented';

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
export function createStickerVisibility() {
  let key = '', collider: ReturnType<typeof createStickerCollision> | null = null;
  let disposed = false, revision = 0;
  const identities = new WeakMap<object, number>(); let nextIdentity = 0;
  const identity = (value: object) => { const saved = identities.get(value); if (saved !== undefined) return saved; const id = ++nextIdentity; identities.set(value, id); return id; };
  return {
    get revision(): number { return revision; },
    update(content: Object3D): void {
      if (disposed) throw new Error('Sticker visibility was disposed');
      content.updateWorldMatrix(true, true);
      const faces: StickerCollisionFace[] = [], parts: string[] = [];
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
        const transform = new Matrix4();
        for (let node: Object3D | null = object; node && node !== content; node = node.parent) transform.premultiply(node.matrix);
        const position = object.geometry.getAttribute('position'), index = object.geometry.index;
        const version = 'version' in position ? position.version : position.data.version;
        const backing = 'data' in position ? identity(position.data) : identity(position.array);
        parts.push(object.uuid, object.geometry.uuid, `${identity(position)}:${backing}:${position.count}:${version}`, index ? `${identity(index)}:${identity(index.array)}:${index.count}:${index.version}` : 'no-index', transform.elements.join(','), ...materials.map(material => `${material.visible}:${material.opacity}`));
        faces.push({ geometry: object.geometry, transform, source: object.name || object.uuid, kind: 'surface' });
      });
      const nextKey = parts.join('|');
      if (nextKey === key && collider !== null) return;
      const next = createStickerCollision(faces);
      collider?.dispose(); collider = next; key = nextKey; revision++;
    },
    visible(camera: Vector3, point: Vector3): boolean {
      if (disposed || collider === null) return false;
      const hit = collider.castSegment(camera, point);
      // Segment endpoints are the actual raised print, not the underlying shell.
      // Only roundoff at an exact endpoint is tolerated, never the film thickness.
      return hit === null || hit.distance >= camera.distanceTo(point) - 1e-5;
    },
    /** Borrow the same assembly BVH for a bounded material contact sweep. */
    castSegment(start: Vector3, end: Vector3) {
      if (disposed || collider === null) throw new Error('Sticker visibility is not prepared');
      return collider.castSegment(start, end);
    },
    dispose(): void { if (disposed) return; disposed = true; collider?.dispose(); collider = null; key = ''; },
  };
}
