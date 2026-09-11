import type { StickerBoundsIndex } from './sticker-bounds-index';
import type { PaperGeometryTransfer } from './sticker-paper-transfer';

export interface CarryRenderStamp {
  readonly ownerId: number; readonly workerGeneration: number; readonly jobId: number;
  readonly computationEpoch: number; readonly owner: string; readonly assemblyRevision: number;
}
export interface CarryRenderPayload {
  readonly version: 1; readonly stamp: CarryRenderStamp; readonly geometry: PaperGeometryTransfer;
  readonly bounds: StickerBoundsIndex; readonly wearGeometry: PaperGeometryTransfer | null;
  readonly wearRevision: number; readonly pointerError: number | null;
}
export type CarryRenderRequest =
  | {readonly type: 'carry-render-release'; readonly stamp: CarryRenderStamp}
  | {readonly type: 'carry-render-copy'; readonly stamp: CarryRenderStamp; readonly requestId: number; readonly port: MessagePort};
export interface CarryRenderAck {readonly type: 'carry-render-start' | 'carry-render-copied'; readonly stamp: CarryRenderStamp; readonly requestId: number; readonly error?: string}
export interface CarryRendererLease {readonly stamp: CarryRenderStamp; readonly bytes: number; release(): void}
export const MAX_CARRY_RENDER_RESOURCE_BYTES = 8 * 1024 * 1024;
const MAX_BYTES = 64 * 1024 * 1024;
export function sameCarryRenderStamp(a: CarryRenderStamp, b: CarryRenderStamp): boolean {
  return a.ownerId === b.ownerId && a.workerGeneration === b.workerGeneration && a.jobId === b.jobId
    && a.computationEpoch === b.computationEpoch && a.owner === b.owner && a.assemblyRevision === b.assemblyRevision;
}
/** Only call on privately owned wire data; borrowed mounted buffers never transfer. */
export function carryRenderBuffers(value: CarryRenderPayload): ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>();
  for (const geometry of [value.geometry, value.wearGeometry]) if (geometry) {
    for (const array of [geometry.position, geometry.normal, geometry.uv, geometry.index]) {
      if (array?.buffer instanceof ArrayBuffer) buffers.add(array.buffer);
    }
  }
  for (const array of [value.bounds.bounds, value.bounds.nodes, value.bounds.seeds]) if (array.buffer instanceof ArrayBuffer) buffers.add(array.buffer);
  return [...buffers];
}
interface Resource {readonly stamp: CarryRenderStamp; readonly bytes: number; current: boolean; acquiring: boolean}
interface PrivateOwner {readonly stamp: CarryRenderStamp; readonly bytes: number; readonly port: MessagePort; pending: boolean; started: boolean;
  timer?: ReturnType<typeof setTimeout>; resolve: (lease: CarryRendererLease) => void; reject: (error: Error) => void; release: () => void}
/** Per-carry producer accounting, not a second geometry cache/worker. At most two
 * canonical completed frames and two renderer owners (old+candidate). A private
 * owner is admitted before posting and charged twice until the producer ACK,
 * once until renderer replacement/release. Pending abort retires the producer
 * before reservation release; settled leases survive producer loss until their
 * renderer explicitly releases them. No main dense copy participates.
 */
export function createCarryRenderResources(send: (message: CarryRenderRequest, transfer?: Transferable[]) => void, retireProducer: () => void, changed: () => void) {
  const resources = new Map<number, Resource>(), leases = new Map<number, PrivateOwner>();
  let requestId = 0, preparing = false;
  const bytes = () => [...resources.values()].reduce((total, value) => total + value.bytes * 2, 0)
    + [...leases.values()].reduce((total, value) => total + value.bytes * (value.pending ? 2 : 1), 0)
    + (preparing ? MAX_CARRY_RENDER_RESOURCE_BYTES * 2 : 0);
  const collect = (resource: Resource) => {
    if (resource.current || resource.acquiring || resources.get(resource.stamp.jobId) !== resource) return;
    resources.delete(resource.stamp.jobId);
    send({type: 'carry-render-release', stamp: resource.stamp}); changed();
  };
  return {
    begin(): boolean {
      if (preparing || resources.size >= 2 || bytes() + MAX_CARRY_RENDER_RESOURCE_BYTES * 2 > MAX_BYTES) return false;
      preparing = true; return true;
    },
    complete(stamp?: CarryRenderStamp, size?: number): void {
      preparing = false;
      if (!stamp) return;
      if (size === undefined || !Number.isSafeInteger(size) || size < 0 || size > MAX_CARRY_RENDER_RESOURCE_BYTES || resources.size >= 2) throw Error('Carry render resource capacity exceeded');
      resources.set(stamp.jobId, {stamp, bytes: size, current: true, acquiring: false});
    },
    releaseFrame(stamp: CarryRenderStamp): void {
      const resource = resources.get(stamp.jobId);
      if (!resource || !sameCarryRenderStamp(resource.stamp, stamp)) return;
      resource.current = false; collect(resource);
    },
    acquire(stamp: CarryRenderStamp, port: MessagePort, signal: AbortSignal, releaseFramePin: () => void): Promise<CarryRendererLease> {
      const resource = resources.get(stamp.jobId);
      if (signal.aborted || !resource || !sameCarryRenderStamp(resource.stamp, stamp) || resource.acquiring || leases.size >= 2 || bytes() + resource.bytes * 2 > MAX_BYTES) {
        port.close(); releaseFramePin(); return Promise.reject(Error(signal.aborted ? 'Carry renderer acquisition cancelled' : 'Carry renderer resource unavailable or capacity exceeded'));
      }
      resource.acquiring = true;
      const id = ++requestId;
      let released = false;
      let resolve: PrivateOwner['resolve'] = () => {}, reject: PrivateOwner['reject'] = () => {};
      const result = new Promise<CarryRendererLease>((accept, decline) => {resolve = accept; reject = decline;});
      const release = () => {
        if (released) return; released = true;
        const current = leases.get(id); if (current) clearTimeout(current.timer);
        signal.removeEventListener('abort', abort); leases.delete(id); resource.acquiring = false;
        releaseFramePin(); collect(resource); changed();
      };
      const abort = () => { const current = leases.get(id); if (!current?.pending) return; retireProducer(); };
      leases.set(id, {stamp, bytes: resource.bytes, port, pending: true, started: false, resolve, reject, release});
      signal.addEventListener('abort', abort, {once: true});
      try { send({type: 'carry-render-copy', stamp, requestId: id, port}, [port]); }
      catch { retireProducer(); }
      return result;
    },
    acknowledge(data: CarryRenderAck): void {
      const lease = leases.get(data.requestId);
      if (!lease?.pending || !sameCarryRenderStamp(lease.stamp, data.stamp)) return;
      if (data.type === 'carry-render-start') {
        if (!lease.started) {lease.started = true; lease.timer = setTimeout(retireProducer, 15_000);}
        return;
      }
      clearTimeout(lease.timer);
      if (data.error) {lease.reject(Error(data.error)); lease.release(); return;}
      lease.pending = false;
      lease.resolve({stamp: lease.stamp, bytes: lease.bytes, release: lease.release});
    },
    retired(): void {
      preparing = false; resources.clear();
      for (const lease of [...leases.values()]) if (lease.pending) {
        lease.port.close(); lease.reject(Error('Carry producer retired')); lease.release();
      }
    },
    inspect: () => ({canonical: resources.size, privateOwners: leases.size, pendingPrivate: [...leases.values()].filter(value => value.pending).length, preparing, bytes: bytes()}),
  };
}
