import {DataTexture, Group, Mesh, NearestFilter, RedFormat, type Texture} from 'three';
import {restoreShell} from './immutable-shell-transfer';
import {restoreDeviceFontTexture} from './device-font-assets';
import {createStickerNodeMaterials} from './sticker-material-nodes';
import {createStickerRoughness} from './sticker-textures';
import type {StickerRenderDamage,StickerTransactionResult} from './sticker-transaction-data';
import type {NativeStickerArtwork, NativeStickerPrint, NativeStickerResourcePort} from '../../composite/src/native-sticker-resources';

export interface NativeEquippedFrameMessage {
  readonly sequence: number; readonly computationEpoch: number;
  readonly prints: readonly NativeStickerPrint[]; readonly resources: readonly NativeStickerResourcePort[];
  readonly artworks: readonly NativeStickerArtwork[];
}
export function closeStickerFrameMessage(message:NativeEquippedFrameMessage):void {
  for(const resource of message.resources)resource.port.close();
  for(const art of message.artworks)art.bitmap.image.close();
}
/** Adopts renderer-private payloads; main retains unrelated immutable query
 * bytes. A candidate is never attached until every resource/material compiles. */
export async function prepareStickerRenderFrame(message: NativeEquippedFrameMessage, environment: Texture | null, signal: AbortSignal) {
  const root = new Group(); root.name = 'device-equipped-stickers';
  const releases: (() => void)[] = [], pending: (() => void)[] = [];
  let disposed = false;
  const dispose = () => { if (disposed) return; disposed = true; for (const stop of pending.splice(0)) stop(); root.clear(); for (const release of releases.reverse()) release(); };
  for (const {bitmap} of message.artworks) releases.push(() => bitmap.image.close());
  for (const {port} of message.resources) releases.push(() => port.close());
  try {
    if (message.prints.length > 32 || message.resources.length > 64 || message.artworks.length > 32) throw new Error('Native sticker frame exceeds resource admission');
    const results = new Map<number, StickerTransactionResult|StickerRenderDamage>();
    await Promise.all(message.resources.map(resource => new Promise<void>((resolve,reject) => {
      let settled = false;
      const finish = (error?: Error) => { if (settled) return; settled = true; clearTimeout(timer); signal.removeEventListener('abort',abort); resource.port.onmessage = null; resource.port.onmessageerror = null; if (error) reject(error); else resolve(); };
      const abort = () => finish(new DOMException('Sticker renderer candidate retired','AbortError'));
      const timer = setTimeout(() => finish(new Error('Native sticker resource delivery timed out')),15000);
      pending.push(abort); signal.addEventListener('abort',abort,{once:true});
      resource.port.onmessage = ({data}:MessageEvent<{version:number;id:number;result:StickerTransactionResult|StickerRenderDamage}>) => {
        if (data.version !== 1 || data.id !== resource.id || results.has(data.id)) { finish(new Error('Sticker resource identity mismatch')); return; }
        results.set(data.id,data.result); finish();
      };
      resource.port.onmessageerror = () => finish(new Error('Sticker resource could not decode'));
      resource.port.start(); if (signal.aborted) abort();
    })));
    pending.length = 0; signal.throwIfAborted();
    const textures = new Map<string, Texture>();
    for (const art of message.artworks) {
      if (textures.has(art.id)) throw new Error('Duplicate native artwork identity');
      const texture = restoreDeviceFontTexture(art.bitmap); textures.set(art.id,texture); releases.push(() => texture.dispose());
    }
    const roughness = createStickerRoughness(); releases.push(() => roughness.dispose());
    for (const print of message.prints) {
      const surface = results.get(print.geometryResource), damage = results.get(print.damageResource), map = textures.get(print.artwork);
      if (!surface || surface.kind !== 'surface' || !damage || damage.kind !== 'render-damage' || damage.stickerId !== print.id || !map) throw new Error('Native print resource contract mismatch');
      const geometry = restoreShell(surface.geometry); releases.push(() => geometry.dispose());
      const damageTexture = new DataTexture(damage.gpu,damage.width,damage.height,RedFormat);
      damageTexture.minFilter = NearestFilter; damageTexture.magFilter = NearestFilter; damageTexture.flipY = false; damageTexture.generateMipmaps = false; damageTexture.needsUpdate = true;
      releases.push(() => damageTexture.dispose());
      const materials = createStickerNodeMaterials({id:print.id,map,roughness,environment,finishEnabled:print.finishEnabled,appearance:print.appearance,wear:print.wear,damage:{id:print.id,texture:damageTexture}});
      releases.push(() => materials.dispose());
      const group = new Group(); group.name = `sticker-print-${print.id}`; group.visible = print.visible;
      const front = new Mesh(geometry,materials.front), back = new Mesh(geometry,materials.back);
      front.name = `sticker-${print.id}`; back.name = `sticker-backing-${print.id}`;
      front.renderOrder = print.renderOrder; back.renderOrder = print.renderOrder;
      front.raycast = () => {}; back.raycast = () => {};
      group.add(front,back);root.add(group);
    }
    return {root,dispose};
  } catch (error) {dispose();throw error;}
}
