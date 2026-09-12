import {packedTreeBuffers} from './packed-collision-tree';
import { BufferAttribute, BufferGeometry, Matrix4 } from 'three';
import { createStickerCollision } from './sticker-collision';
import type { CollisionWorkerFace } from './sticker-collision-preparation';

self.onmessage = (event: MessageEvent<{id:number;faces:CollisionWorkerFace[]}>) => {
  const faces = event.data.faces.map(face => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(face.positions, 3));
    if (face.indices) geometry.setIndex(new BufferAttribute(face.indices, 1));
    return { geometry, transform: new Matrix4().fromArray(face.transform), source: face.source, kind: face.kind, adhesiveSupport: face.adhesiveSupport };
  });
  try {
    const collider = createStickerCollision(faces);
    const snapshot = collider.snapshot();
    self.postMessage({ id:event.data.id,snapshot }, { transfer: [snapshot.coordinates.buffer, snapshot.provenance.buffer,...packedTreeBuffers(snapshot.root)] });
    collider.dispose();
  } catch (error) {
    self.postMessage({ id:event.data.id,error: error instanceof Error ? error.message : 'Collision preparation failed' });
  } finally { for (const face of faces) face.geometry.dispose(); }
};
