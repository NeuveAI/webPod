import type { BufferGeometry } from 'three';
import { restorePaperGeometry, type PaperGeometryTransfer } from './sticker-paper-transfer';
interface Resource { readonly geometry: BufferGeometry; owners: number }
const release = (resource: Resource) => { if (--resource.owners === 0) resource.geometry.dispose(); };
/** One immutable worker surface plus leases held by displayed/retired frames.
 * Cache eviction cannot dispose a surface still borrowed by a mounted frame. */
export function createCarryWearCache() {
  let revision: number | undefined, resource: Resource | null = null;
  return {
    accept(nextRevision: number | undefined, payload: PaperGeometryTransfer | null | undefined) {
      if (nextRevision === undefined) throw new Error('Missing carry wear revision');
      if (revision === nextRevision) return;
      if (payload === undefined) throw new Error('Missing carry wear resource');
      const next = payload ? { geometry: restorePaperGeometry(payload), owners: 1 } : null;
      if (resource) release(resource);
      resource = next; revision = nextRevision;
    },
    retain() {
      const retained = resource;
      if (retained) retained.owners++;
      let active = true;
      return { geometry: retained?.geometry ?? null, release() { if (active) { active = false; if (retained) release(retained); } } };
    },
    clear() { if (resource) release(resource); resource = null; revision = undefined; },
  };
}
