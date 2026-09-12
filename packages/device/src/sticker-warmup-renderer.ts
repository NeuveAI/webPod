import { Group, Mesh, type Texture } from 'three';
import type { NativePackFrame } from '../../composite/src/native-pack-resources';
import { prepareStickerPackRenderFrame } from './sticker-pack-render-frame';

/** Build actual earned/locked/placed program owners without presenting a root.
 * Caller compiles root with the CURRENT camera and full target scene through the
 * serialized backend owner, then ACKs. Installed Three185 Renderer.compileAsync
 * uses targetScene for cache keys and traverses its visible lights; a detached
 * root alone is not sufficient evidence of matching lighting/output programs.
 * Environment must be the same initialized studio map used by visible prints.
 * Keep this owner alive after successful compile to retain material programs.
 * An empty frame is a replacement barrier only, never shader readiness.
 */
export async function prepareStickerWarmup(frame: NativePackFrame, environment: Texture | null, signal: AbortSignal) {
  let delegated = false;
  try {
  signal.throwIfAborted();
  if (frame.prints.length === 0) {
    if (frame.geometry.length || frame.damage.length || frame.artworks.length) throw new Error('Invalid empty sticker warmup');
    const root = new Group();
    return {root, dispose() { root.removeFromParent(); root.clear(); }};
  }
  if (!environment) throw new Error('Sticker warmup requires the initialized studio environment');
  if (frame.prints.length > 30 || frame.geometry.length > 10 || frame.damage.length > 10 || frame.artworks.length > 10) throw new Error('Sticker warmup resource capacity exceeded');
  const appearances = new Map<string, Set<string>>();
  for (const print of frame.prints) {
    if (typeof print.finishEnabled !== 'boolean' || print.wear !== 0) throw new Error('Sticker warmup program inputs mismatch');
    const variants = appearances.get(print.id) ?? new Set<string>();
    if (variants.has(print.appearance)) throw new Error('Duplicate sticker warmup appearance');
    variants.add(print.appearance); appearances.set(print.id, variants);
  }
  if ([...appearances.values()].some(value => value.size !== 3 || !value.has('earned') || !value.has('locked') || !value.has('placed'))) throw new Error('Incomplete sticker warmup appearances');
  const pixels = frame.artworks.reduce((sum, artwork) => sum + artwork.bitmap.image.width * artwork.bitmap.image.height * 4, 0);
  if (!Number.isFinite(pixels) || pixels > 64 * 1024 * 1024) throw new Error('Sticker warmup bitmap byte capacity exceeded');
  delegated = true;
  const owner = await prepareStickerPackRenderFrame(frame, environment, signal);
  try {
    let meshes = 0;
    owner.root.traverse(object => { object.visible = true; if (object instanceof Mesh) { object.frustumCulled = false; meshes++; } });
    if (meshes !== frame.prints.length * 2) throw new Error('Sticker warmup omitted a material pair');
    owner.root.updateMatrixWorld(true);
    return {root: owner.root, dispose: owner.dispose};
  } catch (error) { owner.dispose(); throw error; }
  } catch (error) {
    if (!delegated) { for (const resource of [...frame.geometry, ...frame.damage]) resource.port.close(); for (const artwork of frame.artworks) artwork.bitmap.image.close(); }
    throw error;
  }
}
