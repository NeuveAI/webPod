import { Matrix4, Vector3 } from 'three';
import { createStickerCollision } from './sticker-collision';
import { projectPreparedStickerContour } from './sticker-contour';
import { projectStickerQuadSamples } from './sticker-transform-projection';
import type { PreparedStickerContour } from './sticker-contour-preparation-data';
import type { StickerTransactionResult } from './sticker-transaction-data';
import type { StickerContourQueryRequest, StickerContourQueryResponse } from './sticker-contour-query-data';

const colliders = new Map<number, ReturnType<typeof createStickerCollision>>();
const prints = new Map<number, { contour: PreparedStickerContour; quad: Float64Array }>();
const pending = new Set<() => void>();
let generation: number | null = null, retired = false, credit: number | null = null, lastSequence = 0;
const send = (message: StickerContourQueryResponse) => { if (!retired) self.postMessage(message); };
function receiveContour(port: MessagePort, id: number): Promise<PreparedStickerContour> {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (error?: Error, contour?: PreparedStickerContour) => {
      if (done) return; done = true; clearTimeout(timer); pending.delete(cancel);
      port.onmessage = null; port.onmessageerror = null; port.close();
      if (error) reject(error); else if (contour) resolve(contour);
    };
    const cancel = () => finish(new Error('Contour resource retired'));
    const timer = setTimeout(() => finish(new Error('Contour resource delivery timed out')), 15000);
    pending.add(cancel);
    port.onmessageerror = () => finish(new Error('Contour resource decode failed'));
    port.onmessage = ({ data }: MessageEvent<{version: number; id: number; result: StickerTransactionResult}>) => {
      if (data.version !== 1 || data.id !== id || data.result?.kind !== 'contour') { finish(new Error('Contour resource identity mismatch')); return; }
      const value = data.result.contour;
      if (!(value.anchors instanceof Float64Array) || (value.anchors.length !== 0 && value.anchors.length !== 12) || !Array.isArray(value.paths)
        || value.paths.some(path => !(path.points instanceof Float64Array) || !(path.visiblePoints instanceof Float64Array) || path.points.length % 3 !== 0 || path.visiblePoints.length % 3 !== 0)) {
        finish(new Error('Invalid prepared contour')); return;
      }
      finish(undefined, value);
    };
    port.start();
  });
}
const matrix = (values: readonly number[]) => values.length === 16 && values.every(Number.isFinite);
self.onmessage = (event: MessageEvent<StickerContourQueryRequest>) => {
  const message = event.data;
  void (async () => {
    const received = message.type === 'query' ? message.stamp.generation : message.generation;
    if (retired || (generation !== null && received !== generation)) { if (message.type === 'install-print') message.port.close(); return; }
    if (message.version !== 1 || !Number.isSafeInteger(received) || received < 1) throw new Error('Invalid contour query envelope');
    generation ??= received;
    if (message.type === 'install-collider') {
      if (colliders.size >= 2 || colliders.has(message.id)) throw new Error('Contour collider admission exceeded');
      const s = message.snapshot;
      if (!(s.coordinates instanceof Float64Array) || !(s.provenance instanceof Uint32Array) || !(s.root.bounds instanceof Float64Array)
        || !(s.root.links instanceof Uint32Array) || !(s.root.triangles instanceof Uint32Array)
        || s.coordinates.length !== s.provenance.length * 9 || s.root.bounds.length !== s.nodeCount * 6 || s.root.links.length !== s.nodeCount * 4) throw new Error('Invalid contour collider snapshot');
      colliders.set(message.id, createStickerCollision([], s));
      send({type:'installed',version:1,generation,kind:'collider',id:message.id,revision:message.revision});
    } else if (message.type === 'install-print') {
      if (prints.size + pending.size >= 2 || prints.has(message.id) || !(message.quad instanceof Float64Array) || message.quad.length !== 27) { message.port.close(); throw new Error('Contour print admission exceeded'); }
      const contour = await receiveContour(message.port, message.resourceId);
      if (retired) return;
      prints.set(message.id, {contour,quad:message.quad});
      send({type:'installed',version:1,generation,kind:'print',id:message.id,revision:message.revision});
    } else if (message.type === 'query') {
      const {stamp,projection} = message;
      if (credit !== null || stamp.sequence <= lastSequence) throw new Error('Contour query credit/sequence mismatch');
      const collider = colliders.get(stamp.colliderId), print = prints.get(stamp.printId);
      if (!collider || !print) throw new Error('Contour query resource unavailable');
      if (![projection.world,projection.cameraInverse,projection.cameraProjection,message.contentWorld,message.cameraWorld].every(matrix)) throw new Error('Invalid contour projection matrix');
      lastSequence = stamp.sequence; credit = stamp.sequence;
      const startedAt = performance.timeOrigin + performance.now();
      const inverse = new Matrix4().fromArray(message.contentWorld).invert();
      const camera = new Vector3().setFromMatrixPosition(new Matrix4().fromArray(message.cameraWorld)).applyMatrix4(inverse);
      const local = new Vector3();
      const visible = (world: Vector3) => {
        local.copy(world).applyMatrix4(inverse);
        const hit = collider.castSegment(camera, local);
        return hit === null || hit.distance >= camera.distanceTo(local) - 1e-5;
      };
      const quad = projectStickerQuadSamples(print.quad, projection);
      const contour = quad ? projectPreparedStickerContour(print.contour, projection, quad.center, visible) : null;
      send({type:'result',version:1,stamp,contour,startedAt,completedAt:performance.timeOrigin + performance.now()});
    } else if (message.type === 'result-ack') {
      if (credit === message.sequence) credit = null;
    } else if (message.type === 'release-resource') {
      if (message.kind === 'collider') { colliders.get(message.id)?.dispose(); colliders.delete(message.id); }
      else prints.delete(message.id);
      send({type:'released',version:1,generation,kind:message.kind,id:message.id});
    } else if (message.type === 'cancel') {
      // Owner cancellation suppresses publication immediately. No concurrent
      // kernel exists: a sweep finishes before this message can execute.
    } else if (message.type === 'dispose') {
      for (const stop of [...pending]) stop(); for (const collider of colliders.values()) collider.dispose(); colliders.clear(); prints.clear();
      send({type:'disposed',version:1,generation}); retired = true;
    }
  })().catch(error => {
    if (generation !== null) send({type:'failed',version:1,generation,stage:message.type === 'query' ? 'query' : 'install',message:error instanceof Error ? error.message : 'Contour worker failed'});
  });
};
