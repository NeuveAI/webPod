import type { Texture, BufferGeometry } from 'three';
import type { DeviceStickerScene, DeviceStickerPlacement, StickerArtwork } from '../../device/src/sticker-contract';
import { isStickerCarried } from '../../device/src/sticker-contract';
import type { DeviceFormParams } from '../../device/src/form';
import { acquireStickerTexture } from '../../device/src/sticker-textures';
import { prepareSurface } from '../../device/src/sticker-prepared-surface';
import { preparePrint, type PreparedPrint } from '../../device/src/sticker-prepared-damage';
import { commitPreparedStickerSurface, preparedStickerResources } from '../../device/src/sticker-transaction-client';
import { acquirePrivateStickerTransaction } from '../../device/src/sticker-transaction-broker';
import type { StickerWrapSurface } from '../../device/src/sticker-wrap';
import type { DeviceFontBitmap } from '../../device/src/device-font-assets';

export interface NativeStickerPrint {
  readonly id: string; readonly geometryResource: number; readonly damageResource: number;
  readonly artwork: string; readonly wear: number; readonly visible: boolean; readonly renderOrder: number;
  readonly appearance: 'earned' | 'locked' | 'placed'; readonly finishEnabled: boolean;
}
export interface NativeStickerResourcePort { readonly id: number; readonly port: MessagePort }
export interface NativeStickerArtwork { readonly id: string; readonly bitmap: DeviceFontBitmap }

export async function acquireArtwork(art: StickerArtwork, signal: AbortSignal) {
  let notify = () => {};
  const lease = acquireStickerTexture(art.url, () => notify());
  try {
    const texture = await new Promise<Texture>((resolve, reject) => {
      const abort = () => { signal.removeEventListener('abort', abort); reject(signal.reason ?? new DOMException('Cancelled', 'AbortError')); };
      notify = () => {
        const state = lease.read();
        if (!state.texture && !state.failed) return;
        signal.removeEventListener('abort', abort);
        if (state.texture) resolve(state.texture); else reject(new Error(`Sticker artwork unavailable: ${art.id}`));
      };
      signal.addEventListener('abort', abort, {once: true});
      if (signal.aborted) abort(); else notify();
    });
    return {texture, release: lease.release};
  } catch (error) { lease.release(); throw error; }
}
export async function snapshotArtwork(texture: Texture, signal: AbortSignal, budget: number): Promise<DeviceFontBitmap> {
  const source: unknown = texture.image;
  if (!(source instanceof HTMLImageElement) && !(source instanceof HTMLCanvasElement) && !(source instanceof ImageBitmap)) throw new Error('Unsupported decoded artwork source');
  const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width, height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  if (!(width > 0 && height > 0) || width * height * 4 > budget) throw new Error('Native artwork allocation budget exceeded');
  const image = await createImageBitmap(source, {imageOrientation: texture.flipY ? 'flipY' : 'none',
    premultiplyAlpha: texture.premultiplyAlpha ? 'premultiply' : 'none', colorSpaceConversion: 'none'});
  if (signal.aborted) { image.close(); signal.throwIfAborted(); }
  return {image, colorSpace: texture.colorSpace, wrapS: texture.wrapS, wrapT: texture.wrapT,
    minFilter: texture.minFilter, magFilter: texture.magFilter, generateMipmaps: texture.generateMipmaps, anisotropy: texture.anisotropy};
}

/** One atomic equipped-print candidate. It calls exactly the GL surface/print
 * preparation functions and grants private copies from their existing broker.
 * No mounted geometry is cloned or transferred by main. Caller releases only
 * after its renderer generation retires the candidate or replaced frame. */
export async function prepareNativeEquippedFrame(input: {
  readonly scene: DeviceStickerScene; readonly form: DeviceFormParams; readonly rear: BufferGeometry; readonly wrap: StickerWrapSurface;
}, signal: AbortSignal) {
  const releases: (() => void)[] = [], ports: NativeStickerResourcePort[] = [], artworks: NativeStickerArtwork[] = [];
  const prints: NativeStickerPrint[] = [], queries: {readonly placement: DeviceStickerPlacement; readonly print: PreparedPrint; readonly renderOrder: number; readonly visible: boolean}[] = [];
  const textures = new Map<string, Texture>();
  let transferred = false, retired = false, artworkBytes = 0;
  const release = () => {
    if (retired) return; retired = true;
    for (const resource of ports) resource.port.close();
    if (!transferred) for (const art of artworks) art.bitmap.image.close();
    for (const dispose of releases.reverse()) dispose();
  };
  try {
    for (const [index, placement] of input.scene.placements.entries()) {
      signal.throwIfAborted();
      const art = input.scene.assets.find(asset => asset.id === placement.stickerId); if (!art) continue;
      let texture = textures.get(art.url);
      if (!texture) {
        const artwork = await acquireArtwork(art, signal); releases.push(artwork.release); texture = artwork.texture; textures.set(art.url, texture);
        const bitmap = await snapshotArtwork(texture, signal,64*1024*1024-artworkBytes);
        artworkBytes += bitmap.image.width * bitmap.image.height * 4;
        if (artworkBytes > 64 * 1024 * 1024) { bitmap.image.close(); throw new Error('Native artwork allocation budget exceeded'); }
        artworks.push({id: art.url, bitmap});
      }
      const {stickerId, surface, x, y, width, rotationDeg} = placement;
      const exactPlacement = {stickerId, surface, x, y, width, rotationDeg};
      const surfaceFrame = await prepareSurface({input: {kind:'surface', art, placement:exactPlacement, form:input.form},
        custom:{art, placement:exactPlacement, rear:input.rear, wrap:input.wrap}}, signal);
      releases.push(surfaceFrame.release); commitPreparedStickerSurface(surfaceFrame.geometry, placement);
      const print = await preparePrint({texture, id:art.id, geometry:surfaceFrame.geometry, wearGeometry:surfaceFrame.geometry, wear:placement.wear ?? 0}, signal);
      releases.push(print.release);
      let geometryResource: number | null = null, damageResource: number | null = null;
      for (const descriptor of preparedStickerResources(print.geometry)) {
        const channel = new MessageChannel();
        try {
          const lease = await acquirePrivateStickerTransaction(descriptor.key, descriptor.input, channel.port1, signal, descriptor.input.kind==='damage'?{purpose:'render-damage'}:undefined);
          releases.push(lease.release); ports.push({id:lease.resourceId,port:channel.port2});
          if (descriptor.input.kind === 'surface') geometryResource = lease.resourceId;
          else if (descriptor.input.kind === 'damage') damageResource = lease.resourceId;
        } catch (error) { channel.port1.close(); channel.port2.close(); throw error; }
      }
      if (geometryResource === null || damageResource === null) throw new Error('Incomplete private sticker frame');
      const renderOrder = 3 + index / (input.scene.placements.length + 1), visible = !isStickerCarried(input.scene.pack, art.id);
      prints.push({id:art.id, artwork:art.url, geometryResource, damageResource, wear:print.wear, appearance:'earned', visible, renderOrder, finishEnabled:input.scene.finishEnabled !== false});
      queries.push({placement:{...surfaceFrame.placement,wear:print.wear},print,renderOrder,visible});
    }
    signal.throwIfAborted();
    return {prints,ports,artworks,queries,release, transferred() {transferred = true;}};
  } catch (error) { release(); throw error; }
}
